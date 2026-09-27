/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import net from 'node:net';
import dns from 'node:dns/promises';
import {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  Events
} from 'discord.js';

const DATA_FILE = 'servers.json';
const TICK_MS = 30_000;
const DEFAULTS = {
  defaultInterval: 10,
  minInterval: 2,
  maxServersPerGuild: 5,
  statRenameMinutes: 5,
  defaultShowPlayers: true,
  defaultNotify: true,
  allowPrivateHosts: false
};
const SITE = 'vorqul.com';

const LANGS = ['en', 'sk', 'cs', 'de', 'pl', 'ru', 'es', 'ja', 'tr'];

const S = {
  en: {
    online: 'Online', offline: 'Offline', fStatus: 'Status', fPlayers: 'Players', fVersion: 'Version',
    fAddress: 'Address', fPing: 'Response time', fOnlineNow: 'Online now',
    offlineDesc: 'The server did not respond to the status request.',
    footer: 'Updates every {n} min',
    notifyUp: '🟢 **{name}** is back online - {online}/{max} players.',
    notifyDown: '🔴 **{name}** went offline.',
    statName: '{icon} {online}/{max} players', statOffline: '{icon} offline',
    notFound: 'No tracked server called **{name}**.',
    privateHost: 'Private and local addresses are not allowed.',
    noServer: 'No Minecraft server is set up yet. An admin can add one in the dashboard under Plugins.'
  },
  sk: {
    online: 'Online', offline: 'Offline', fStatus: 'Stav', fPlayers: 'Hráči', fVersion: 'Verzia',
    fAddress: 'Adresa', fPing: 'Odozva', fOnlineNow: 'Práve online',
    offlineDesc: 'Server neodpovedal na požiadavku o stav.',
    footer: 'Aktualizuje sa každých {n} min',
    notifyUp: '🟢 **{name}** je znova online - {online}/{max} hráčov.',
    notifyDown: '🔴 **{name}** je offline.',
    statName: '{icon} {online}/{max} hráčov', statOffline: '{icon} offline',
    notFound: 'Sledovaný server **{name}** neexistuje.',
    privateHost: 'Súkromné a lokálne adresy nie sú povolené.',
    noServer: 'Zatiaľ nie je nastavený žiadny Minecraft server. Admin ho môže pridať v dashboarde v Pluginoch.'
  },
  cs: {
    online: 'Online', offline: 'Offline', fStatus: 'Stav', fPlayers: 'Hráči', fVersion: 'Verze',
    fAddress: 'Adresa', fPing: 'Odezva', fOnlineNow: 'Právě online',
    offlineDesc: 'Server neodpověděl na požadavek o stav.',
    footer: 'Aktualizuje se každých {n} min',
    notifyUp: '🟢 **{name}** je znovu online - {online}/{max} hráčů.',
    notifyDown: '🔴 **{name}** je offline.',
    statName: '{icon} {online}/{max} hráčů', statOffline: '{icon} offline',
    notFound: 'Sledovaný server **{name}** neexistuje.',
    privateHost: 'Soukromé a lokální adresy nejsou povoleny.',
    noServer: 'Zatím není nastaven žádný Minecraft server. Admin ho může přidat v dashboardu v Pluginech.'
  },
  de: {
    online: 'Online', offline: 'Offline', fStatus: 'Status', fPlayers: 'Spieler', fVersion: 'Version',
    fAddress: 'Adresse', fPing: 'Antwortzeit', fOnlineNow: 'Jetzt online',
    offlineDesc: 'Der Server hat auf die Statusanfrage nicht geantwortet.',
    footer: 'Aktualisierung alle {n} Min.',
    notifyUp: '🟢 **{name}** ist wieder online - {online}/{max} Spieler.',
    notifyDown: '🔴 **{name}** ist offline gegangen.',
    statName: '{icon} {online}/{max} Spieler', statOffline: '{icon} offline',
    notFound: 'Es gibt keinen überwachten Server namens **{name}**.',
    privateHost: 'Private und lokale Adressen sind nicht erlaubt.',
    noServer: 'Es ist noch kein Minecraft-Server eingerichtet. Ein Admin kann ihn im Dashboard unter Plugins hinzufügen.'
  },
  pl: {
    online: 'Online', offline: 'Offline', fStatus: 'Status', fPlayers: 'Gracze', fVersion: 'Wersja',
    fAddress: 'Adres', fPing: 'Czas odpowiedzi', fOnlineNow: 'Teraz online',
    offlineDesc: 'Serwer nie odpowiedział na zapytanie o status.',
    footer: 'Aktualizacja co {n} min',
    notifyUp: '🟢 **{name}** jest znowu online - {online}/{max} graczy.',
    notifyDown: '🔴 **{name}** jest offline.',
    statName: '{icon} {online}/{max} graczy', statOffline: '{icon} offline',
    notFound: 'Nie ma śledzonego serwera o nazwie **{name}**.',
    privateHost: 'Adresy prywatne i lokalne są niedozwolone.',
    noServer: 'Nie skonfigurowano jeszcze serwera Minecraft. Admin może go dodać w panelu w sekcji Pluginy.'
  },
  ru: {
    online: 'Онлайн', offline: 'Офлайн', fStatus: 'Статус', fPlayers: 'Игроки', fVersion: 'Версия',
    fAddress: 'Адрес', fPing: 'Время ответа', fOnlineNow: 'Сейчас онлайн',
    offlineDesc: 'Сервер не ответил на запрос статуса.',
    footer: 'Обновление каждые {n} мин',
    notifyUp: '🟢 **{name}** снова онлайн - игроков: {online}/{max}.',
    notifyDown: '🔴 **{name}** ушёл в офлайн.',
    statName: '{icon} {online}/{max} игроков', statOffline: '{icon} офлайн',
    notFound: 'Отслеживаемого сервера **{name}** нет.',
    privateHost: 'Частные и локальные адреса запрещены.',
    noServer: 'Minecraft-сервер ещё не настроен. Администратор может добавить его в панели в разделе «Плагины».'
  },
  es: {
    online: 'En línea', offline: 'Fuera de línea', fStatus: 'Estado', fPlayers: 'Jugadores', fVersion: 'Versión',
    fAddress: 'Dirección', fPing: 'Tiempo de respuesta', fOnlineNow: 'Conectados ahora',
    offlineDesc: 'El servidor no respondió a la solicitud de estado.',
    footer: 'Se actualiza cada {n} min',
    notifyUp: '🟢 **{name}** vuelve a estar en línea - {online}/{max} jugadores.',
    notifyDown: '🔴 **{name}** se ha desconectado.',
    statName: '{icon} {online}/{max} jugadores', statOffline: '{icon} sin conexión',
    notFound: 'No hay ningún servidor seguido llamado **{name}**.',
    privateHost: 'No se permiten direcciones privadas ni locales.',
    noServer: 'Aún no hay ningún servidor de Minecraft configurado. Un admin puede añadirlo en el panel, en Plugins.'
  },
  ja: {
    online: 'オンライン', offline: 'オフライン', fStatus: '状態', fPlayers: 'プレイヤー', fVersion: 'バージョン',
    fAddress: 'アドレス', fPing: '応答時間', fOnlineNow: '現在オンライン',
    offlineDesc: 'サーバーがステータス要求に応答しませんでした。',
    footer: '{n}分ごとに更新',
    notifyUp: '🟢 **{name}** がオンラインに復帰しました（{online}/{max} 人）。',
    notifyDown: '🔴 **{name}** がオフラインになりました。',
    statName: '{icon} {online}/{max} 人', statOffline: '{icon} オフライン',
    notFound: '**{name}** という監視対象サーバーはありません。',
    privateHost: 'プライベート／ローカルアドレスは使用できません。',
    noServer: 'Minecraft サーバーはまだ設定されていません。管理者がダッシュボードの「プラグイン」から追加できます。'
  },
  tr: {
    online: 'Çevrimiçi', offline: 'Çevrimdışı', fStatus: 'Durum', fPlayers: 'Oyuncular', fVersion: 'Sürüm',
    fAddress: 'Adres', fPing: 'Yanıt süresi', fOnlineNow: 'Şu an çevrimiçi',
    offlineDesc: 'Sunucu durum isteğine yanıt vermedi.',
    footer: 'Her {n} dk\'da bir güncellenir',
    notifyUp: '🟢 **{name}** yeniden çevrimiçi - {online}/{max} oyuncu.',
    notifyDown: '🔴 **{name}** çevrimdışı oldu.',
    statName: '{icon} {online}/{max} oyuncu', statOffline: '{icon} çevrimdışı',
    notFound: '**{name}** adlı izlenen bir sunucu yok.',
    privateHost: 'Özel ve yerel adreslere izin verilmiyor.',
    noServer: 'Henüz bir Minecraft sunucusu ayarlanmadı. Yönetici bunu panelde Eklentiler bölümünden ekleyebilir.'
  }
};

const LOCALE_MAP = { 'en-US': 'en', 'en-GB': 'en', 'es-ES': 'es', 'es-419': 'es' };

function langFromLocale(locale) {
  if (!locale) return 'en';
  const mapped = LOCALE_MAP[locale] || String(locale).slice(0, 2).toLowerCase();
  return LANGS.includes(mapped) ? mapped : 'en';
}

function tr(lang, key, vars = {}) {
  const table = S[lang] || S.en;
  let text = table[key] ?? S.en[key] ?? key;
  for (const [name, value] of Object.entries(vars)) {
    text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

let ctx;

function cfg() {
  try {
    return { ...DEFAULTS, ...(ctx?.getSettings?.() || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

const STATE_FILE = 'state.json';
const STATE_KEYS = ['messageId', 'online', 'failStreak', 'lastRun', 'lastRename', 'lastName', 'channelId', 'statChannelId'];

let state = {};
let timer = null;
let running = false;
let stateDirty = false;

function saveState() {
  ctx.writeData(STATE_FILE, state);
  stateDirty = false;
}

function stateFor(id) {
  if (!state[id]) {
    state[id] = { messageId: null, online: null, failStreak: 0, lastRun: 0, lastRename: 0, lastName: '', channelId: null, statChannelId: null };
  }
  return state[id];
}

function toTracker(guildId, item) {
  const st = stateFor(item.id);
  const channelId = item.channel || null;
  const statChannelId = item.statChannel || null;
  if (st.channelId !== channelId) {
    st.messageId = null;
    st.channelId = channelId;
  }
  if (st.statChannelId !== statChannelId) {
    st.lastName = '';
    st.lastRename = 0;
    st.statChannelId = statChannelId;
  }
  const settings = cfg();
  return {
    ...st,
    id: item.id,
    guildId,
    name: item.name,
    host: item.host,
    port: item.port ?? null,
    edition: item.edition || 'java',
    channelId,
    statChannelId,
    intervalMin: Math.max(settings.minInterval, Number(item.interval) || settings.defaultInterval),
    showPlayers: item.showPlayers !== false,
    notify: item.notify !== false,
    lang: item.language || 'en'
  };
}

function commit(tracker) {
  const st = stateFor(tracker.id);
  for (const key of STATE_KEYS) st[key] = tracker[key];
  stateDirty = true;
}

function guildItems(guildId) {
  const items = ctx.getGuildSettings(guildId).servers;
  return Array.isArray(items) ? items : [];
}

function writeGuildItems(guildId, items) {
  ctx.saveGuildSettings(guildId, { servers: items });
}

function allTrackers() {
  const out = [];
  for (const [guildId, values] of Object.entries(ctx.listGuildSettings())) {
    for (const item of Array.isArray(values.servers) ? values.servers : []) out.push(toTracker(guildId, item));
  }
  return out;
}

function writeVarInt(value) {
  const out = [];
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v) byte |= 0x80;
    out.push(byte);
  } while (v);
  return Buffer.from(out);
}

function readVarInt(buf, offset) {
  let num = 0;
  let shift = 0;
  let pos = offset;
  for (;;) {
    if (pos >= buf.length) return null;
    const byte = buf[pos++];
    num |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) break;
    shift += 7;
    if (shift > 35) throw new Error('VarInt is too long');
  }
  return { value: num, size: pos - offset };
}

function packet(body) {
  return Buffer.concat([writeVarInt(body.length), body]);
}

function flattenChat(component) {
  if (component == null) return '';
  if (typeof component === 'string') return component;
  if (Array.isArray(component)) return component.map(flattenChat).join('');
  let text = typeof component.text === 'string' ? component.text : '';
  if (Array.isArray(component.extra)) text += component.extra.map(flattenChat).join('');
  return text;
}

function cleanMotd(raw) {
  return flattenChat(raw).replace(/§[0-9a-fk-orx]/gi, '').replace(/[ \t]+\n/g, '\n').trim().slice(0, 300);
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const lower = address.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7));
  return /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
}

class BlockedHostError extends Error {}

async function resolveJava(host, port, explicitPort) {
  let targetHost = host;
  let targetPort = port;
  if (!explicitPort && net.isIP(host) === 0) {
    try {
      const records = await dns.resolveSrv(`_minecraft._tcp.${host}`);
      if (records.length) {
        targetHost = records[0].name;
        targetPort = records[0].port;
      }
    } catch {
      targetHost = host;
    }
  }
  const addresses = net.isIP(targetHost) ? [{ address: targetHost }] : await dns.lookup(targetHost, { all: true });
  if (!addresses.length) throw new Error('DNS lookup returned nothing');
  const allowPrivate = process.env.MC_STATUS_ALLOW_PRIVATE === 'true' || cfg().allowPrivateHosts === true;
  if (!allowPrivate && addresses.some((a) => isPrivateIp(a.address))) {
    throw new BlockedHostError('private address');
  }
  return { address: addresses[0].address, port: targetPort };
}

function pingJava(address, port, handshakeHost, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const socket = net.createConnection({ host: address, port });
    let buffer = Buffer.alloc(0);
    let finished = false;

    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => finish(new Error('timeout')));
    socket.on('error', (error) => finish(error));
    socket.on('close', () => finish(new Error('connection closed')));

    socket.on('connect', () => {
      const hostBytes = Buffer.from(handshakeHost, 'utf8');
      const portBytes = Buffer.alloc(2);
      portBytes.writeUInt16BE(port);
      const handshake = Buffer.concat([
        writeVarInt(0x00),
        writeVarInt(765),
        writeVarInt(hostBytes.length),
        hostBytes,
        portBytes,
        writeVarInt(1)
      ]);
      socket.write(Buffer.concat([packet(handshake), packet(writeVarInt(0x00))]));
    });

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > 1_000_000) return finish(new Error('response too large'));
      try {
        const length = readVarInt(buffer, 0);
        if (!length || buffer.length < length.size + length.value) return;
        const body = buffer.subarray(length.size, length.size + length.value);
        const id = readVarInt(body, 0);
        const jsonLength = id && readVarInt(body, id.size);
        if (!id || !jsonLength) return;
        const start = id.size + jsonLength.size;
        if (body.length < start + jsonLength.value) return;
        const json = JSON.parse(body.subarray(start, start + jsonLength.value).toString('utf8'));
        finish(null, { json, latency: Date.now() - started });
      } catch (error) {
        finish(error);
      }
    });
  });
}

async function queryBedrock(host, port) {
  const target = port ? `${host}:${port}` : host;
  const response = await fetch(`https://api.mcsrvstat.us/bedrock/3/${encodeURIComponent(target)}`, {
    headers: { 'User-Agent': 'VorqulDSBot-minecraft_status' },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`status API answered ${response.status}`);
  const body = await response.json();
  if (body.online !== true) return { online: false };
  return {
    online: true,
    version: typeof body.version === 'string' ? body.version : body.version?.name,
    playersOnline: body.players?.online ?? 0,
    playersMax: body.players?.max ?? 0,
    sample: [],
    motd: Array.isArray(body.motd?.clean) ? body.motd.clean.join('\n').trim().slice(0, 300) : '',
    latency: null
  };
}

async function queryServer(server) {
  try {
    if (server.edition === 'bedrock') {
      return await queryBedrock(server.host, server.port);
    }
    const explicitPort = server.port != null;
    const target = await resolveJava(server.host, server.port ?? 25565, explicitPort);
    const { json, latency } = await pingJava(target.address, target.port, server.host);
    const sample = Array.isArray(json.players?.sample)
      ? json.players.sample.map((p) => String(p?.name || '')).filter(Boolean)
      : [];
    return {
      online: true,
      version: json.version?.name ? String(json.version.name).replace(/§[0-9a-fk-or]/gi, '') : undefined,
      playersOnline: Number(json.players?.online) || 0,
      playersMax: Number(json.players?.max) || 0,
      sample,
      motd: cleanMotd(json.description),
      latency
    };
  } catch (error) {
    if (error instanceof BlockedHostError) return { online: false, blocked: true };
    return { online: false };
  }
}

function addressOf(server) {
  return server.port ? `${server.host}:${server.port}` : server.host;
}

function bar(current, max) {
  const total = 10;
  const filled = max > 0 ? Math.min(total, Math.round((current / max) * total)) : 0;
  return '▰'.repeat(filled) + '▱'.repeat(total - filled);
}

function buildEmbed(server, status) {
  const lang = server.lang || 'en';
  const online = status.online === true;
  const embed = new EmbedBuilder()
    .setTitle(`${online ? '🟢' : '🔴'} ${server.name}`)
    .setColor(online ? 0x57f287 : 0xed4245)
    .setFooter({ text: `${tr(lang, 'footer', { n: server.intervalMin })} • ${SITE}` })
    .setTimestamp();

  const fields = [{ name: tr(lang, 'fStatus'), value: online ? tr(lang, 'online') : tr(lang, 'offline'), inline: true }];

  if (online) {
    if (status.motd) embed.setDescription(`\`\`\`\n${status.motd.replace(/`/g, "'")}\n\`\`\``);
    fields.push({
      name: tr(lang, 'fPlayers'),
      value: `**${status.playersOnline}/${status.playersMax}**\n${bar(status.playersOnline, status.playersMax)}`,
      inline: true
    });
    if (status.version) fields.push({ name: tr(lang, 'fVersion'), value: String(status.version).slice(0, 100), inline: true });
    fields.push({ name: tr(lang, 'fAddress'), value: `\`${addressOf(server)}\``, inline: true });
    if (status.latency != null) fields.push({ name: tr(lang, 'fPing'), value: `${status.latency} ms`, inline: true });
    if (server.showPlayers && status.sample.length) {
      const shown = status.sample.slice(0, 20).join(', ');
      const more = status.playersOnline > status.sample.length ? ` (+${status.playersOnline - status.sample.length})` : '';
      fields.push({ name: tr(lang, 'fOnlineNow'), value: `${shown}${more}`.slice(0, 1024) });
    }
    if (server.edition !== 'bedrock') {
      embed.setThumbnail(`https://api.mcsrvstat.us/icon/${encodeURIComponent(addressOf(server))}`);
    }
  } else {
    embed.setDescription(tr(lang, 'offlineDesc'));
    fields.push({ name: tr(lang, 'fAddress'), value: `\`${addressOf(server)}\``, inline: true });
  }

  return embed.addFields(fields);
}

async function fetchTextChannel(id) {
  if (!id) return null;
  try {
    const channel = await ctx.client.channels.fetch(id);
    return channel && channel.isTextBased() && !channel.isThread() ? channel : null;
  } catch {
    return null;
  }
}

async function publish(server, channel, embed) {
  if (server.messageId) {
    try {
      const message = await channel.messages.fetch(server.messageId);
      await message.edit({ embeds: [embed], allowedMentions: { parse: [] } });
      return;
    } catch (error) {
      if (error?.code !== 10008) {
        ctx.logger.debug(`could not edit the panel of ${server.name}: ${error?.message || error}`);
        return;
      }
    }
  }
  const message = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  server.messageId = message.id;
}

async function updateStatChannel(server, status) {
  if (!server.statChannelId) return;
  const now = Date.now();
  if (now - (server.lastRename || 0) < Math.max(5, cfg().statRenameMinutes) * 60_000) return;
  const lang = server.lang || 'en';
  const icon = status.online ? '🟢' : '🔴';
  const name = (status.online
    ? tr(lang, 'statName', { icon, online: status.playersOnline, max: status.playersMax })
    : tr(lang, 'statOffline', { icon })).slice(0, 100);
  if (name === server.lastName) return;
  try {
    const channel = await ctx.client.channels.fetch(server.statChannelId);
    if (!channel || !('setName' in channel)) return;
    await channel.setName(name, 'Minecraft status');
    server.lastName = name;
    server.lastRename = now;
  } catch (error) {
    ctx.logger.debug(`could not rename the stat channel of ${server.name}: ${error?.message || error}`);
    server.lastRename = now;
  }
}

function noticeFor(server, status) {
  if (status.online) {
    const wasDown = server.online === false;
    server.online = true;
    server.failStreak = 0;
    return wasDown && server.notify ? 'notifyUp' : null;
  }
  server.failStreak = (server.failStreak || 0) + 1;
  if (server.online === null || server.online === undefined) {
    server.online = false;
    return null;
  }
  if (server.online === true && server.failStreak >= 2) {
    server.online = false;
    return server.notify ? 'notifyDown' : null;
  }
  return null;
}

async function refreshServer(server, prefetched) {
  server.lastRun = Date.now();
  try {
    const status = prefetched || await queryServer(server);
    const notice = noticeFor(server, status);

    const channel = await fetchTextChannel(server.channelId);
    if (!channel) {
      ctx.logger.debug(`channel of ${server.name} is not available`);
      return status;
    }

    try {
      await publish(server, channel, buildEmbed(server, status));
      if (notice) {
        await channel.send({
          content: tr(server.lang, notice, {
            name: server.name,
            online: status.playersOnline ?? 0,
            max: status.playersMax ?? 0
          }),
          allowedMentions: { parse: [] }
        });
      }
    } catch (error) {
      ctx.logger.warn(`could not post the status of ${server.name}: ${error?.message || error}`);
    }
    await updateStatChannel(server, status);
    return status;
  } finally {
    commit(server);
  }
}

async function tick() {
  if (running || !ctx || !ctx.client.isReady()) return;
  running = true;
  try {
    const trackers = allTrackers();
    const known = new Set(trackers.map((t) => t.id));
    for (const id of Object.keys(state)) {
      if (!known.has(id)) {
        delete state[id];
        stateDirty = true;
      }
    }
    const now = Date.now();
    for (const server of trackers) {
      if (now - (server.lastRun || 0) < server.intervalMin * 60_000 - 2_000) continue;
      await refreshServer(server);
    }
    if (stateDirty) saveState();
  } catch (error) {
    ctx.logger.error('update cycle failed', error);
  } finally {
    running = false;
  }
}

function guildServers(guildId) {
  return guildItems(guildId).map((item) => toTracker(guildId, item));
}

function findServer(guildId, name) {
  const wanted = String(name || '').trim().toLowerCase();
  return guildServers(guildId).find((s) => s.name.toLowerCase() === wanted) || null;
}

function parseAddress(rawHost, rawPort) {
  let host = String(rawHost || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '');
  let port = rawPort ?? null;
  const match = host.match(/^(.*):(\d{1,5})$/);
  if (match) {
    host = match[1];
    if (port == null) port = Number(match[2]);
  }
  host = host.replace(/\/.*$/, '').replace(/\.$/, '');
  const validHost = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/.test(host);
  if (!validHost) return null;
  if (port != null && !(Number.isInteger(port) && port >= 1 && port <= 65535)) return null;
  return { host, port };
}

const minecraftCommand = {
  data: new SlashCommandBuilder()
    .setName('minecraft')
    .setDescription('Show the status and address of the Minecraft server')
    .addStringOption((o) => o.setName('server').setDescription('Which server (all of them when left empty)').setAutocomplete(true)),

  category: 'plugin',
  guildOnly: true,

  execute: async (interaction) => {
    if (!interaction.inGuild()) return;
    const lang = langFromLocale(interaction.locale);
    const all = guildServers(interaction.guildId);
    if (all.length === 0) {
      return interaction.reply({ content: tr(lang, 'noServer'), flags: MessageFlags.Ephemeral });
    }

    const wanted = interaction.options.getString('server');
    let servers = all;
    if (wanted) {
      const server = findServer(interaction.guildId, wanted);
      if (!server) return interaction.reply({ content: tr(lang, 'notFound', { name: wanted }), flags: MessageFlags.Ephemeral });
      servers = [server];
    }

    await interaction.deferReply();
    const embeds = [];
    for (const server of servers.slice(0, 10)) {
      const status = await queryServer(server);
      if (status.blocked) {
        embeds.push(buildEmbed({ ...server, lang: server.lang || lang }, { online: false }));
        continue;
      }
      embeds.push(buildEmbed({ ...server, lang: server.lang || lang }, status));
      await refreshServer(server, status);
    }
    if (stateDirty) saveState();
    return interaction.editReply({ embeds });
  },

  autocomplete: async (interaction) => {
    if (!interaction.guildId) return;
    const typed = String(interaction.options.getFocused() || '').toLowerCase();
    const choices = guildServers(interaction.guildId)
      .filter((s) => s.name.toLowerCase().includes(typed))
      .slice(0, 25)
      .map((s) => ({ name: s.name, value: s.name }));
    await interaction.respond(choices).catch(() => {});
  }
};

const onReady = {
  name: Events.ClientReady,
  once: true,
  execute: async () => {
    await tick();
  }
};

const onGuildDelete = {
  name: Events.GuildDelete,
  execute: async (client, guild) => {
    try {
      const items = guildItems(guild.id);
      if (items.length === 0) return;
      for (const item of items) delete state[item.id];
      writeGuildItems(guild.id, []);
      saveState();
    } catch (error) {
      ctx.logger.debug(`could not clean up a removed server: ${error?.message || error}`);
    }
  }
};

const onChannelDelete = {
  name: Events.ChannelDelete,
  execute: async (client, channel) => {
    try {
      for (const [guildId, values] of Object.entries(ctx.listGuildSettings())) {
        const next = [];
        let changed = false;
        for (const item of Array.isArray(values.servers) ? values.servers : []) {
          if (item.channel === channel.id) {
            delete state[item.id];
            stateDirty = true;
            changed = true;
          } else if (item.statChannel === channel.id) {
            next.push({ ...item, statChannel: '' });
            changed = true;
          } else {
            next.push(item);
          }
        }
        if (changed) writeGuildItems(guildId, next);
      }
      if (stateDirty) saveState();
    } catch (error) {
      ctx.logger.debug(`could not clean up a removed channel: ${error?.message || error}`);
    }
  }
};

function migrateLegacy() {
  const legacy = ctx.readData(DATA_FILE, null);
  if (!legacy || !Array.isArray(legacy.servers) || legacy.servers.length === 0) return;

  const byGuild = new Map();
  for (const old of legacy.servers) {
    if (!old || !old.guildId || !old.id || !old.host) continue;
    if (!byGuild.has(old.guildId)) byGuild.set(old.guildId, []);
    byGuild.get(old.guildId).push(old);
  }
  for (const [guildId, list] of byGuild) {
    try {
      const current = guildItems(guildId);
      const have = new Set(current.map((i) => i.id));
      const added = list
        .filter((old) => !have.has(old.id))
        .map((old) => ({
          id: old.id, name: old.name, host: old.host, port: old.port ?? null, edition: old.edition || 'java',
          channel: old.channelId || '', statChannel: old.statChannelId || '',
          interval: old.intervalMin || cfg().defaultInterval, showPlayers: old.showPlayers !== false,
          notify: old.notify !== false, language: old.lang || 'en'
        }));
      writeGuildItems(guildId, [...current, ...added]);
      for (const old of list) {
        Object.assign(stateFor(old.id), {
          messageId: old.messageId ?? null, online: old.online ?? null, failStreak: old.failStreak || 0,
          lastRun: old.lastRun || 0, lastRename: old.lastRename || 0, lastName: old.lastName || '',
          channelId: old.channelId || null, statChannelId: old.statChannelId || null
        });
      }
    } catch (error) {
      ctx.logger.warn(`could not migrate the servers of ${guildId}: ${error?.message || error}`);
    }
  }
  ctx.writeData(DATA_FILE, { servers: [], migratedAt: new Date().toISOString() });
  saveState();
}

export const _internals = {
  writeVarInt, readVarInt, packet, flattenChat, cleanMotd, isPrivateIp, parseAddress,
  pingJava, langFromLocale, tr, bar, S, LANGS
};

export default {
  name: 'minecraft_status',
  version: '1.0.0',
  author: 'Yamiru',
  description: 'Live Minecraft server status panels',

  commands: [minecraftCommand],
  events: [onReady, onGuildDelete, onChannelDelete],

  onLoad: (context) => {
    ctx = context;
    const saved = ctx.readData(STATE_FILE, {});
    state = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    migrateLegacy();
    timer = setInterval(() => { tick(); }, TICK_MS);
    timer.unref?.();
    const count = Object.values(ctx.listGuildSettings()).reduce((n, v) => n + (Array.isArray(v.servers) ? v.servers.length : 0), 0);
    ctx.logger.info(`tracking ${count} server(s)`);
  },

  onUnload: () => {
    if (timer) clearInterval(timer);
    timer = null;
    if (ctx && stateDirty) saveState();
  }
};
