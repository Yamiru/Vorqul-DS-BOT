import { spawn, execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync, readdirSync, readFileSync, appendFileSync, renameSync, unlinkSync, chmodSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { gzipSync } from 'zlib';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let currentLogPath = null;

function ignoreStartupError(error) {
  if (process.env.VORQUL_DEBUG) {
    console.error(`[start] suppressed: ${error && error.message ? error.message : error}`);
  }
}

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

const SECRET_ENV_KEYS = [
  'DISCORD_TOKEN', 'TOKEN', 'DISCORD_CLIENT_SECRET', 'CLIENT_SECRET',
  'NEXTAUTH_SECRET', 'DATABASE_PASSWORD', 'DB_PASSWORD', 'MYSQL_PASSWORD'
];
let secretValues = [];

function collectSecrets(extraEnv = {}) {
  const values = new Set();
  for (const key of SECRET_ENV_KEYS) {
    const v = (process.env[key] || extraEnv[key] || '').trim();
    if (v && v.length >= 6) values.add(v);
  }
  secretValues = [...values];
}

function redact(text) {
  if (text === undefined || text === null) return text;
  let out = String(text);

  for (const v of secretValues) {
    if (v) out = out.split(v).join('***REDACTED***');
  }

  out = out.replace(/https?:\/\/(?:[a-z0-9.-]+\.)?discord(?:app)?\.com\/api\/webhooks\/\S+/gi, 'https://discord.com/api/webhooks/***REDACTED***');

  out = out.replace(/\b[A-Za-z0-9_-]{23,28}\.[A-Za-z0-9_-]{6,7}\.[A-Za-z0-9_-]{27,}\b/g, '***REDACTED_TOKEN***');

  out = out.replace(new RegExp('(' + SECRET_ENV_KEYS.join('|') + ')\\s*[=:]\\s*\\S+', 'gi'), '$1=***REDACTED***');
  return out;
}

function secureFile(filePath, mode = 0o600) {
  try { chmodSync(filePath, mode); } catch (error) { ignoreStartupError(error); }
}

function getMaxLogs() {
  const fileEnv = loadEnvFile();
  const raw = process.env.MAX_LOGS || fileEnv.MAX_LOGS || '10';
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

function pruneOldLogs(logsDir, maxLogs) {
  const archives = readdirSync(logsDir)
    .filter(f => /^\d+\.(tar\.gz|log)$/.test(f))
    .map(f => ({ name: f, num: parseInt(f.split('.')[0], 10) }))
    .filter(x => Number.isFinite(x.num))
    .sort((a, b) => a.num - b.num);

  let removed = 0;
  while (archives.length > maxLogs) {
    const oldest = archives.shift();
    try {
      unlinkSync(join(logsDir, oldest.name));
      removed++;
    } catch (error) { ignoreStartupError(error); }
  }
  return removed;
}

function setupLogging() {
  const logsDir = join(__dirname, 'logs');

  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  secureFile(logsDir, 0o700);

  const files = readdirSync(logsDir).filter(f => f.match(/^\d+\.tar\.gz$/));
  const numbers = files.map(f => parseInt(f.split('.')[0])).filter(n => !isNaN(n));
  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

  const currentLog = join(logsDir, 'current.log');
  if (existsSync(currentLog)) {
    const archivePath = join(logsDir, `${nextNumber}.tar.gz`);
    try {
      const logContent = readFileSync(currentLog);
      const compressed = gzipSync(logContent);
      writeFileSync(archivePath, compressed);
      secureFile(archivePath, 0o600);
      unlinkSync(currentLog);
    } catch {
      try {
        renameSync(currentLog, join(logsDir, `${nextNumber}.log`));
      } catch (e2) { ignoreStartupError(e2); }
    }
  }

  const maxLogs = getMaxLogs();
  const removed = pruneOldLogs(logsDir, maxLogs);

  currentLogPath = currentLog;

  const header = `${'='.repeat(60)}\nVorqul DS BOT Log - ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`;
  writeFileSync(currentLogPath, header);
  secureFile(currentLogPath, 0o600);

  return { nextNumber, maxLogs, removed };
}

function writeLog(message) {
  if (currentLogPath) {
    try {
      appendFileSync(currentLogPath, redact(message) + '\n');
    } catch (e) { ignoreStartupError(e); }
  }
}

function appendLog(text) {
  if (currentLogPath) {
    try {
      appendFileSync(currentLogPath, redact(text));
    } catch (e) { ignoreStartupError(e); }
  }
}

function log(msg, color = c.cyan) {
  const time = new Date().toLocaleTimeString();
  const cleanMsg = msg.replace(/\x1b\[[0-9;]*m/g, '');
  console.log(`${c.bright}[${time}]${c.reset} ${color}${msg}${c.reset}`);
  writeLog(`[${time}] ${cleanMsg}`);
}

function readVersion() {
  try {
    const v = readFileSync(join(__dirname, '.version'), 'utf-8').trim();
    if (v) return v;
  } catch (error) { ignoreStartupError(error); }
  try {
    return JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8')).version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function verifySeal() {
  let lock;
  try {
    lock = JSON.parse(readFileSync(join(__dirname, 'brand.lock.json'), 'utf-8'));
  } catch {
    return ['brand.lock.json'];
  }
  const changed = [];
  for (const [file, expected] of Object.entries(lock.files || {})) {
    try {
      const text = readFileSync(join(__dirname, file), 'utf-8').replace(/\r/g, '');
      if (createHash('sha256').update(text).digest('hex') !== expected) changed.push(file);
    } catch {
      changed.push(file);
    }
  }
  return changed;
}

function banner() {
  const art = [
    '██╗   ██╗ ██████╗ ██████╗  ██████╗ ██╗   ██╗██╗     ',
    '██║   ██║██╔═══██╗██╔══██╗██╔═══██╗██║   ██║██║     ',
    '██║   ██║██║   ██║██████╔╝██║   ██║██║   ██║██║     ',
    '╚██╗ ██╔╝██║   ██║██╔══██╗██║▄▄ ██║██║   ██║██║     ',
    ' ╚████╔╝ ╚██████╔╝██║  ██║╚██████╔╝╚██████╔╝███████╗',
    '  ╚═══╝   ╚═════╝ ╚═╝  ╚═╝ ╚══▀▀═╝  ╚═════╝ ╚══════╝'
  ];

  const width = 55;
  const line = '─'.repeat(width);
  const plain = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');

  const row = (content) => {
    const room = width - plain(content).length;
    return `  ${c.cyan}│${c.reset}${content}${' '.repeat(Math.max(room, 0))}${c.cyan}│${c.reset}`;
  };

  const meta = (label, value) => {
    const room = width - label.length - plain(value).length;
    return `  ${c.gray}${label}${c.reset}${' '.repeat(Math.max(room, 1))}${value}`;
  };

  console.log();
  console.log(`  ${c.cyan}╭${line}╮${c.reset}`);
  console.log(row(''));
  for (const art_row of art) {
    console.log(row(`  ${c.bright}${c.magenta}${art_row}${c.reset}`));
  }
  console.log(row(''));
  console.log(row(`  ${c.bright}DS BOT${c.reset}  ${c.gray}·${c.reset}  ${c.cyan}Discord Community Management Platform${c.reset}`));
  console.log(row(''));
  console.log(`  ${c.cyan}╰${line}╯${c.reset}`);
  console.log();
  console.log(meta('version', `${c.bright}v${readVersion()}${c.reset}`));
  console.log(meta('author', `${c.bright}Yamiru${c.reset}`));
  console.log(meta('website', `${c.cyan}https://vorqul.com${c.reset}`));
  console.log(meta('source', `${c.cyan}https://github.com/Yamiru/Vorqul-DS-BOT${c.reset}`));
  console.log();
}

function loadEnvFile() {
  const envPath = join(__dirname, '.env');

  if (!existsSync(envPath)) {
    return {};
  }

  const content = readFileSync(envPath, 'utf-8');
  const env = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function applyEnvFile() {
  const fileEnv = loadEnvFile();
  for (const [k, v] of Object.entries(fileEnv)) {
    if (k === 'NODE_ENV') continue;
    if (process.env[k] === undefined || process.env[k] === '') {
      process.env[k] = v;
    }
  }

  for (const k of ['NEXTAUTH_URL', 'NEXTAUTH_URL_INTERNAL', 'VERCEL_URL']) {
    if (process.env[k] === '') delete process.env[k];
  }
}

function setupEnv() {
  const fileEnv = loadEnvFile();

  const token = process.env.DISCORD_TOKEN || process.env.TOKEN || fileEnv.DISCORD_TOKEN || '';
  const dbType = process.env.DATABASE_TYPE || fileEnv.DATABASE_TYPE || 'json';
  const prefix = process.env.BOT_PREFIX || process.env.PREFIX || fileEnv.BOT_PREFIX || '!';
  const lang = process.env.BOT_LANGUAGE || fileEnv.BOT_LANGUAGE || 'en';
  const dashboardEnabled = process.env.DASHBOARD_ENABLED || fileEnv.DASHBOARD_ENABLED || 'false';
  const dashboardPort = process.env.DASHBOARD_PORT || fileEnv.DASHBOARD_PORT || process.env.SERVER_PORT || '3000';
  const maxLogs = process.env.MAX_LOGS || fileEnv.MAX_LOGS || '10';

  const pick = (k) => process.env[k] || fileEnv[k] || '';
  const clientId = pick('DISCORD_CLIENT_ID');
  const clientSecret = pick('DISCORD_CLIENT_SECRET');
  const nextauthUrl = pick('NEXTAUTH_URL');
  const nextauthSecret = pick('NEXTAUTH_SECRET');
  const ownerId = pick('BOT_OWNER_ID');
  const dbHost = pick('DB_HOST');
  const dbPort = pick('DB_PORT');
  const dbName = pick('DB_NAME');
  const dbUser = pick('DB_USER');
  const dbPassword = pick('DB_PASSWORD');
  const dashboardPassword = pick('DASHBOARD_PASSWORD');

  collectSecrets(fileEnv);

  if (!existsSync('.env') || !fileEnv.DISCORD_TOKEN) {
    log('ℹ️  Creating/updating the .env file...', c.blue);

    const envContent = `# Vorqul DS BOT Configuration
# Generated automatically

DISCORD_TOKEN=${token}
DISCORD_CLIENT_ID=${clientId}
DISCORD_CLIENT_SECRET=${clientSecret}
BOT_OWNER_ID=${ownerId}
DATABASE_TYPE=${dbType}
DATA_PATH=./data
BOT_PREFIX=${prefix}
BOT_LANGUAGE=${lang}

# Logging
# MAX_LOGS = maximum number of rotated log archives to keep.
# Older archives are deleted automatically (log rotation).
MAX_LOGS=${maxLogs}

# Dashboard Settings
DASHBOARD_ENABLED=${dashboardEnabled}
DASHBOARD_PORT=${dashboardPort}
DASHBOARD_PASSWORD=${dashboardPassword}
NEXTAUTH_URL=${nextauthUrl}
NEXTAUTH_SECRET=${nextauthSecret}

# Database (len pre DATABASE_TYPE=mysql)
DB_HOST=${dbHost}
DB_PORT=${dbPort}
DB_NAME=${dbName}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword}
`;

    writeFileSync('.env', envContent);
    secureFile('.env', 0o600);
    log('✅ .env file ready', c.green);
  } else {
    secureFile('.env', 0o600);
  }

  if (!existsSync('./data')) {
    mkdirSync('./data', { recursive: true });
    log('✅ ./data directory created', c.green);
  }

  log(`🔧 DASHBOARD_ENABLED="${dashboardEnabled}" | DISCORD_CLIENT_ID=${clientId ? clientId.substring(0, 6) + '...' : 'NENASTAVENÉ'} | NEXTAUTH_URL=${nextauthUrl ? 'OK' : 'NENASTAVENÉ'}`, c.cyan);
  log(`🔒 DASHBOARD_PASSWORD ${dashboardPassword ? 'is set' : 'is not set - the password gate is off'}`, c.cyan);

  return token;
}

function checkToken(token) {
  if (!token || token === '' || token === 'YOUR_TOKEN_HERE') {
    log('❌ DISCORD_TOKEN is not set!', c.red);
    log('ℹ️  Set it in the .env file or in your Pterodactyl startup variables', c.blue);
    return false;
  }

  if (token.length < 50) {
    log('⚠️  DISCORD_TOKEN looks too short', c.yellow);
  }

  log('✅ DISCORD_TOKEN found', c.green);
  return true;
}

function depsHash() {
  const hash = createHash('sha256');
  for (const f of ['package.json', 'package-lock.json']) {
    if (existsSync(f)) {
      try { hash.update(f + '\0' + readFileSync(f)); } catch (error) { ignoreStartupError(error); }
    }
  }
  return hash.digest('hex');
}

function nodeModulesUsable() {
  if (!existsSync('node_modules')) return false;
  try {
    for (const pkg of ['discord.js', 'typescript', 'dotenv']) {
      if (!existsSync(join('node_modules', pkg))) return false;
    }
    return readdirSync('node_modules').length > 20;
  } catch {
    return false;
  }
}

function installDependencies() {
  const wanted = depsHash();
  const stampPath = 'node_modules/.vorqul_deps_hash';

  if (existsSync('node_modules')) {
    try {
      const files = readdirSync('node_modules');
      if (files.length > 20 && existsSync(stampPath) && readFileSync(stampPath, 'utf-8').trim() === wanted) {
        log('✅ Dependencies are already installed', c.green);
        return true;
      }
    } catch (e) { ignoreStartupError(e); }
    if (existsSync('node_modules')) {
      log('♻️  package.json sa zmenil - preinštalúvam závislosti...', c.yellow);
    }
  }

  log('📦 Installing npm dependencies...', c.blue);
  log('ℹ️  (This may take 1-2 minutes on the first run)', c.cyan);

  const attempts = [
    { cmd: 'npm install', note: null },
    { cmd: 'npm install --legacy-peer-deps', note: 'Skúšam znova s --legacy-peer-deps (konflikt peer závislostí)...' },
  ];

  for (const attempt of attempts) {
    if (attempt.note) log(`⚠️  ${attempt.note}`, c.yellow);
    try {
      execSync(attempt.cmd, { stdio: 'inherit' });
      try { writeFileSync(stampPath, wanted); } catch (e) { ignoreStartupError(e); }
      log('✅ Dependencies installed', c.green);
      return true;
    } catch (e) { ignoreStartupError(e); }
  }

  if (nodeModulesUsable()) {
    log('❌ npm install zlyhal.', c.red);
    log('⚠️  Pokračujem s existujúcimi node_modules - závislosti sú staršie,', c.yellow);
    log('⚠️  než hovorí package.json. Oprav konflikt a reštartuj.', c.yellow);
    log('ℹ️  Tip: "npm install --legacy-peer-deps" alebo zosúlaď verzie', c.cyan);
    log('ℹ️  typescript a @typescript-eslint/*.', c.cyan);
    return true;
  }

  log('❌ npm install failed a node_modules nie sú použiteľné!', c.red);
  return false;
}

function installPluginDependencies() {
  if (!existsSync('plugins')) return;

  let folders;
  try {
    folders = readdirSync('plugins');
  } catch {
    return;
  }

  for (const folder of folders) {
    if (folder.startsWith('.')) continue;
    const dir = join('plugins', folder);
    const manifest = join(dir, 'package.json');

    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    if (!existsSync(manifest)) continue;

    try {
      const pluginManifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf-8'));
      if (pluginManifest.enabled === false) continue;
    } catch {
      continue;
    }

    const hash = createHash('sha256');
    for (const f of [manifest, join(dir, 'package-lock.json')]) {
      if (existsSync(f)) {
        try { hash.update(f + '\0' + readFileSync(f)); } catch (error) { ignoreStartupError(error); }
      }
    }
    const wanted = hash.digest('hex');
    const stamp = join(dir, 'node_modules', '.vorqul_deps_hash');

    if (existsSync(stamp)) {
      try {
        if (readFileSync(stamp, 'utf-8').trim() === wanted) continue;
      } catch (error) { ignoreStartupError(error); }
    }

    log(`📦 Inštalujem závislosti pluginu ${folder}...`, c.blue);
    try {
      execSync('npm install --omit=dev --no-audit --no-fund', { cwd: dir, stdio: 'inherit' });
      try { writeFileSync(stamp, wanted); } catch (error) { ignoreStartupError(error); }
      log(`✅ Plugin ${folder}: závislosti nainštalované`, c.green);
    } catch {
      log(`⚠️  Plugin ${folder}: inštalácia zlyhala, plugin sa nemusí načítať`, c.yellow);
    }
  }
}

function botSourceHash() {
  const hash = createHash('sha256');

  const roots = ['src/bot', 'src/shared', 'src/utils', 'src/config', 'src/locales'];
  const extraFiles = ['tsconfig.bot.json', 'package.json'];

  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        walk(full);
      } else if (/\.(tsx?|json)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
        try { hash.update(full + '\0' + readFileSync(full)); } catch (error) { ignoreStartupError(error); }
      }
    }
  };

  roots.forEach(walk);
  for (const f of extraFiles) {
    if (existsSync(f)) {
      try { hash.update(f + '\0' + readFileSync(f)); } catch (error) { ignoreStartupError(error); }
    }
  }
  return hash.digest('hex');
}

function buildTypeScript() {
  const sourceHash = botSourceHash();
  const stampPath = 'dist/.VORQUL_BOT_BUILD';

  if (existsSync('dist/bot/index.js') && existsSync('dist/utils/logger.js') && existsSync(stampPath)) {
    try {
      if (readFileSync(stampPath, 'utf-8').trim() === sourceHash) {
        log('✅ Production build found (source unchanged)', c.green);
        return 'dist/bot/index.js';
      }
    } catch (error) { ignoreStartupError(error); }
    log('♻️  Bot source change detected, rebuilding...', c.yellow);
  }

  if (existsSync('dist')) {
    try {
      execSync('rm -rf dist', { stdio: 'inherit' });
    } catch (e) { ignoreStartupError(e); }
  }

  if (!existsSync('src/bot/index.ts')) {
    log('❌ Source files not found!', c.red);
    log('ℹ️  Upload the src/ directory via SFTP', c.blue);
    return null;
  }

  log('🔧 Compiling TypeScript...', c.blue);

  try {
    execSync('npx tsc -p tsconfig.bot.json', { stdio: 'inherit' });

    try {
      execSync('cp -r src/locales dist/locales', { stdio: 'inherit' });
    } catch {
      log('⚠️  Nepodarilo sa skopírovať locales do dist/', c.yellow);
    }
    try { writeFileSync(stampPath, sourceHash); } catch (e) { ignoreStartupError(e); }
    log('✅ TypeScript compiled', c.green);
    return 'dist/bot/index.js';
  } catch {
    log('⚠️  TypeScript compilation failed, falling back to the tsx runtime...', c.yellow);
    return 'tsx';
  }
}

function dashboardSourceHash() {
  const hash = createHash('sha256');
  const roots = [
    'src/dashboard/app',
    'src/dashboard/components',
    'src/dashboard/lib',

    'src/shared',
  ];
  const extraFiles = [
    'src/dashboard/package.json',
    'src/dashboard/next.config.mjs',
    'src/dashboard/postcss.config.js',
    'src/dashboard/tailwind.config.js',
    'src/dashboard/tsconfig.json',
  ];

  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name === '.next' || e.name === 'node_modules') continue;
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        walk(full);
      } else if (/\.(tsx?|css|json|mjs|cjs|js)$/.test(e.name)) {
        try { hash.update(full + '\0' + readFileSync(full)); } catch (error) { ignoreStartupError(error); }
      }
    }
  };

  roots.forEach(walk);
  for (const f of extraFiles) {
    if (existsSync(f)) {
      try { hash.update(f + '\0' + readFileSync(f)); } catch (error) { ignoreStartupError(error); }
    }
  }
  return hash.digest('hex');
}

function buildDashboard() {
  const enabledValue = process.env.DASHBOARD_ENABLED || loadEnvFile().DASHBOARD_ENABLED || 'false';
  if (enabledValue.trim().toLowerCase() !== 'true') return false;

  const sourceHash = dashboardSourceHash();
  const stampPath = 'src/dashboard/.next/VORQUL_BUILD';

  if (existsSync('src/dashboard/.next/BUILD_ID') && existsSync(stampPath)) {
    try {
      if (readFileSync(stampPath, 'utf-8').trim() === sourceHash) {
        log('✅ Dashboard build found (source unchanged)', c.green);
        return true;
      }
    } catch (error) { ignoreStartupError(error); }
    log('♻️  Dashboard change detected, rebuilding...', c.yellow);
  }

  if (!existsSync('src/dashboard/app')) {
    log('ℹ️  Dashboard source not found, skipping...', c.blue);
    return false;
  }

  log('🔧 Building the Dashboard (Next.js)...', c.blue);
  log('ℹ️  (This may take 1-3 minutes)', c.cyan);

  const nextDir = 'src/dashboard/.next';
  const bakDir = 'src/dashboard/.next_bak';
  const hadPrev = existsSync(`${nextDir}/BUILD_ID`);

  if (hadPrev) {
    try {
      execSync(`rm -rf ${bakDir}`, { stdio: 'ignore' });
      renameSync(nextDir, bakDir);
    } catch (error) { ignoreStartupError(error); }
  }

  try {
    execSync('npx next build src/dashboard', {
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, NODE_ENV: 'production', NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=1536' }
    });

    if (!existsSync(`${nextDir}/BUILD_ID`) || !existsSync(`${nextDir}/prerender-manifest.json`)) {
      throw new Error('Build skončil bez kompletného .next (BUILD_ID/prerender-manifest)');
    }

    if (existsSync(bakDir)) { try { execSync(`rm -rf ${bakDir}`, { stdio: 'ignore' }); } catch (error) { ignoreStartupError(error); } }
    try { writeFileSync(stampPath, sourceHash, 'utf-8'); } catch (error) { ignoreStartupError(error); }
    log('✅ Dashboard built', c.green);
    return true;
  } catch (e) {
    log('⚠️  Dashboard build failed - pozri detail nižšie:', c.yellow);
    const out = `${(e && e.stdout) ? e.stdout.toString() : ''}\n${(e && e.stderr) ? e.stderr.toString() : (e && e.message) || ''}`.trim();
    const tail = out.split('\n').slice(-25).join('\n');
    process.stdout.write(tail + '\n');
    appendLog(tail + '\n');

    try { execSync(`rm -rf ${nextDir}`, { stdio: 'ignore' }); } catch (error) { ignoreStartupError(error); }
    if (existsSync(bakDir)) {
      try {
        renameSync(bakDir, nextDir);
        log('↩️  Obnovený predošlý funkčný build dashboardu.', c.cyan);
        return existsSync(`${nextDir}/BUILD_ID`);
      } catch (error) { ignoreStartupError(error); }
    }
    return false;
  }
}

function startDashboard() {
  const fileEnv = loadEnvFile();
  const dashboardEnabled = process.env.DASHBOARD_ENABLED || fileEnv.DASHBOARD_ENABLED || 'false';
  const dashboardPort = process.env.DASHBOARD_PORT || fileEnv.DASHBOARD_PORT || process.env.SERVER_PORT || '3000';

  if (dashboardEnabled.trim().toLowerCase() !== 'true') {
    log(`ℹ️  Dashboard je vypnutý (DASHBOARD_ENABLED="${dashboardEnabled}"). Nastav DASHBOARD_ENABLED=true.`, c.blue);
    return null;
  }

  if (!existsSync('src/dashboard/.next/BUILD_ID') || !existsSync('src/dashboard/.next/prerender-manifest.json')) {
    log('⚠️  Dashboard build nie je kompletný, preskakujem (bot beží ďalej)...', c.yellow);
    return null;
  }

  for (const [key, value] of Object.entries(fileEnv)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  if (!process.env.NEXTAUTH_SECRET) {
    try {
      const secDir = './data/secrets';
      const secFile = `${secDir}/nextauth_secret`;
      let secret = '';
      if (existsSync(secFile)) {
        secret = readFileSync(secFile, 'utf-8').trim();
      }
      if (!secret) {
        secret = createHash('sha256').update(Date.now() + ':' + Math.random()).digest('hex');
        if (!existsSync(secDir)) mkdirSync(secDir, { recursive: true });
        writeFileSync(secFile, secret);
        secureFile(secFile, 0o600);
      }
      process.env.NEXTAUTH_SECRET = secret;
      log('🔑 NEXTAUTH_SECRET nie je nastavený - použitý náhodný z data/secrets/', c.yellow);
    } catch {
      process.env.NEXTAUTH_SECRET = createHash('sha256').update(Date.now() + ':' + Math.random()).digest('hex');
    }
  }

  collectSecrets(fileEnv);

  if (process.env.DISCORD_CLIENT_ID) {
    log(`✅ DISCORD_CLIENT_ID loaded: ${process.env.DISCORD_CLIENT_ID.substring(0, 6)}...`, c.green);
  } else {
    log('⚠️  DISCORD_CLIENT_ID is not set!', c.yellow);
  }

  log(`🌐 Starting the Dashboard on port ${dashboardPort}...`, c.green);

  const dashboard = spawn('npx', ['next', 'start', 'src/dashboard', '-p', dashboardPort], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ...(process.env.NEXTAUTH_URL ? {} : { AUTH_TRUST_HOST: 'true' })
    }
  });

  dashboard.stdout.on('data', (data) => {
    const text = data.toString();
    process.stdout.write(`[DASHBOARD] ${text}`);
    appendLog(`[DASHBOARD] ${text}`);
  });

  dashboard.stderr.on('data', (data) => {
    const text = data.toString();
    process.stderr.write(`[DASHBOARD] ${text}`);
    appendLog(`[DASHBOARD ERROR] ${text}`);
  });

  dashboard.on('error', (err) => {
    log(`⚠️  Dashboard error: ${err.message}`, c.yellow);
  });

  return dashboard;
}

function startBot(entryPoint) {
  log('🚀 Starting Vorqul DS BOT...', c.green);
  console.log('-'.repeat(50));
  writeLog('-'.repeat(50));

  let bot;

  if (entryPoint === 'tsx') {
    bot = spawn('npx', ['tsx', 'src/bot/index.ts'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env
    });
  } else {
    bot = spawn('node', [entryPoint], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env
    });
  }

  bot.stdout.on('data', (data) => {
    const text = data.toString();
    process.stdout.write(text);
    appendLog(text);
  });

  bot.stderr.on('data', (data) => {
    const text = data.toString();
    process.stderr.write(text);
    appendLog(`[STDERR] ${text}`);
  });

  bot.on('close', (code) => {
    if (code !== 0) {
      log(`❌ Bot exited with code ${code}`, c.red);
    }
    process.exit(code || 0);
  });

  bot.on('error', (err) => {
    log(`❌ Error while starting: ${err.message}`, c.red);
    process.exit(1);
  });

  return bot;
}

async function main() {
  const { nextNumber, maxLogs, removed } = setupLogging();

  banner();

  const sealBroken = verifySeal();
  if (sealBroken.length > 0) {
    process.env.VORQUL_TAMPERED = '1';
    log('⚠️  Modified build: the protected branding/licence files were changed (' + sealBroken.join(', ') + ').', c.yellow);
    log('⚠️  The Vorqul DS BOT name and vorqul.com link must stay (see LICENSE). Restore the original files.', c.yellow);
  }

  if (nextNumber > 1) {
    log(`📋 Previous log archived as ${nextNumber - 1}.tar.gz`, c.blue);
  }
  log(`🗂️  Log rotation: keeping at most ${maxLogs} archives (set MAX_LOGS to change)`, c.blue);
  if (removed > 0) {
    log(`🧹 Removed ${removed} old log archive(s) over the limit`, c.blue);
  }

  log('🔍 Checking the environment...', c.cyan);
  console.log();

  const token = setupEnv();

  applyEnvFile();

  if (!checkToken(token)) {
    process.exit(1);
  }

  if (!installDependencies()) {
    process.exit(1);
  }

  installPluginDependencies();

  const entryPoint = buildTypeScript();
  if (!entryPoint) {
    process.exit(1);
  }

  buildDashboard();

  console.log();
  log('✅ All checks passed!', c.green);
  console.log();

  const dashboard = startDashboard();

  const bot = startBot(entryPoint);

  const cleanup = () => {
    log('⏹️  Stopping services...', c.yellow);
    bot.kill('SIGTERM');
    if (dashboard) dashboard.kill('SIGTERM');
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

main().catch(err => {
  console.error('Fatal error:', err);
  writeLog(`FATAL ERROR: ${err.message}`);
  process.exit(1);
});
