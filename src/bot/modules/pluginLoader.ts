/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { logger } from '../../utils/logger.js';
import { EmbedHelper } from '../../utils/embedHelper.js';
import { i18n } from '../../utils/i18n.js';
import { reportError } from '../../utils/errorReporter.js';
import {
  validateManifest,
  resolveSettings,
  resolveGuildSettings,
  sanitizeGuildSettings,
  type PluginSettingField,
  type GuildValues,
  type ValidManifest
} from '../../shared/pluginManifest.js';
import type { Plugin, PluginContext } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PLUGINS_PATH = process.env.PLUGINS_PATH
  ? path.resolve(process.env.PLUGINS_PATH)
  : path.join(__dirname, '..', '..', '..', 'plugins');

const STATUS_FILE = path.resolve(process.env.DATA_PATH || './data', 'plugins_status.json');
const startedAt = new Date().toISOString();

interface StatusRecord {
  state: 'loaded' | 'disabled' | 'error';
  name?: string;
  version?: string;
  commands: string[];
  events: number;
  error?: string;
}

const statusByFolder = new Map<string, StatusRecord>();

function writeStatus(): void {
  try {
    fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
    const tmp = `${STATUS_FILE}.tmp`;
    fs.writeFileSync(
      tmp,
      JSON.stringify(
        { updatedAt: new Date().toISOString(), startedAt, plugins: Object.fromEntries(statusByFolder) },
        null,
        2
      ),
      'utf-8'
    );
    fs.renameSync(tmp, STATUS_FILE);
  } catch (error) {
    logger.debug('Could not write plugin status', error);
  }
}

function fail(folder: string, message: string, name?: string): null {
  logger.warn(`Plugin ${folder}: ${message}`);
  statusByFolder.set(folder, { state: 'error', name, commands: [], events: 0, error: message });
  return null;
}

interface LoadedPlugin {
  plugin: Plugin;
  context: PluginContext;
  folder: string;
  listeners: { name: string; handler: (...args: any[]) => void }[];
  commandNames: string[];
}

const loaded = new Map<string, LoadedPlugin>();

function inside(root: string, target: string): boolean {
  const resolved = path.resolve(target);
  const base = path.resolve(root);
  return resolved === base || resolved.startsWith(base + path.sep);
}

function readManifest(folder: string): ValidManifest | null {
  const manifestPath = path.join(PLUGINS_PATH, folder, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return fail(folder, 'manifest.json is missing');

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (error) {
    return fail(folder, `manifest.json is not valid JSON (${(error as Error).message})`);
  }

  const parsed = validateManifest(raw);
  if (!parsed.ok) return fail(folder, parsed.error);
  const manifest = parsed.manifest;

  if (manifest.name !== folder) {
    return fail(folder, `the folder name must match the plugin name "${manifest.name}"`, manifest.name);
  }

  const pluginRoot = path.join(PLUGINS_PATH, folder);
  const mainFile = path.join(pluginRoot, manifest.main);
  if (!inside(pluginRoot, mainFile)) return fail(folder, '"main" must stay inside the plugin folder', manifest.name);
  if (!fs.existsSync(mainFile)) return fail(folder, `main file not found (${manifest.main})`, manifest.name);

  return manifest;
}

const GUILD_ID = /^[A-Za-z0-9_-]{1,32}$/;

function buildContext(
  client: Client,
  name: string,
  fields: PluginSettingField[],
  guildFields: PluginSettingField[]
): PluginContext {
  const dataDir = path.join(PLUGINS_PATH, name, 'data');

  const readData = <T>(file: string, fallback: T): T => {
    const target = path.join(dataDir, file);
    if (!inside(dataDir, target)) return fallback;
    try {
      return JSON.parse(fs.readFileSync(target, 'utf-8')) as T;
    } catch {
      return fallback;
    }
  };

  const getGlobals = () => resolveSettings(fields, readData<unknown>('settings.json', {}));
  const getGuildSettings = (guildId: string): GuildValues =>
    resolveGuildSettings(
      guildFields,
      GUILD_ID.test(guildId) ? readData<unknown>(`guilds/${guildId}.json`, {}) : {},
      getGlobals()
    );

  return {
    client,
    embed: EmbedHelper,
    logger: {
      info: (m: string, ...a: unknown[]) => logger.info(`[${name}] ${m}`, ...a),
      warn: (m: string, ...a: unknown[]) => logger.warn(`[${name}] ${m}`, ...a),
      error: (m: string, e?: unknown, ...a: unknown[]) => logger.error(`[${name}] ${m}`, e, ...a),
      debug: (m: string, ...a: unknown[]) => logger.debug(`[${name}] ${m}`, ...a)
    },
    t: (key: string, guildId?: string, vars?: Record<string, string>) => i18n.t(key, guildId, vars),
    dataDir,
    readData,
    writeData(file: string, value: unknown): void {
      const target = path.join(dataDir, file);
      if (!inside(dataDir, target)) return;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const tmp = `${target}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf-8');
      fs.renameSync(tmp, target);
    },
    getSettings<T extends Record<string, any>>(): T {
      return getGlobals() as T;
    },
    getGuildSettings,
    listGuildSettings(): Record<string, GuildValues> {
      const out: Record<string, GuildValues> = {};
      let files: string[];
      try {
        files = fs.readdirSync(path.join(dataDir, 'guilds'));
      } catch {
        return out;
      }
      for (const file of files) {
        const id = file.endsWith('.json') ? file.slice(0, -5) : '';
        if (GUILD_ID.test(id)) out[id] = getGuildSettings(id);
      }
      return out;
    },
    saveGuildSettings(guildId: string, input: Record<string, unknown>): GuildValues {
      if (!GUILD_ID.test(guildId)) throw new Error('Invalid guild id');
      const { values, errors } = sanitizeGuildSettings(guildFields, input, getGuildSettings(guildId), getGlobals());
      if (Object.keys(errors).length > 0) throw new Error(`Invalid guild settings: ${JSON.stringify(errors)}`);
      const target = path.join(dataDir, 'guilds', `${guildId}.json`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const tmp = `${target}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(values, null, 2), 'utf-8');
      fs.renameSync(tmp, target);
      return values;
    }
  };
}

async function loadOne(client: Client, folder: string, bust = false): Promise<boolean> {
  const manifest = readManifest(folder);
  if (!manifest) return false;

  if (!manifest.enabled) {
    logger.debug(`Plugin ${manifest.name} is disabled`);
    statusByFolder.set(folder, { state: 'disabled', name: manifest.name, version: manifest.version, commands: [], events: 0 });
    return false;
  }

  if (loaded.has(manifest.name)) {
    logger.warn(`Plugin ${manifest.name} is already loaded, skipping folder ${folder}`);
    return false;
  }

  const mainFile = path.join(PLUGINS_PATH, folder, manifest.main);
  const context = buildContext(client, manifest.name, manifest.settings, manifest.guildSettings);

  try {
    const href = pathToFileURL(mainFile).href + (bust ? `?v=${Date.now()}` : '');
    const imported = await import(href);
    const plugin: Plugin = imported.default ?? imported;

    if (!plugin || typeof plugin !== 'object') {
      fail(folder, 'the default export is not a plugin object', manifest.name);
      return false;
    }

    const entry: LoadedPlugin = { plugin, context, folder, listeners: [], commandNames: [] };

    for (const command of plugin.commands ?? []) {
      const name = command?.data?.name;
      if (!name) {
        logger.warn(`Plugin ${manifest.name}: a command has no name, skipped`);
        continue;
      }
      if (client.commands.has(name)) {
        logger.warn(`Plugin ${manifest.name}: /${name} already exists, skipped`);
        continue;
      }
      client.commands.set(name, command);
      entry.commandNames.push(name);
    }

    for (const event of plugin.events ?? []) {
      if (!event?.name || typeof event.execute !== 'function') {
        logger.warn(`Plugin ${manifest.name}: an event is malformed, skipped`);
        continue;
      }
      const eventName = String(event.name);
      const handler = (...args: any[]) => {
        try {
          const result = (event.execute as (...a: any[]) => unknown)(client, ...args);
          if (result && typeof (result as Promise<unknown>).then === 'function') {
            (result as Promise<unknown>).catch((error: unknown) =>
              reportError(`plugin:${manifest.name}:${eventName}`, error)
            );
          }
        } catch (error) {
          reportError(`plugin:${manifest.name}:${eventName}`, error);
        }
      };

      if (event.once) {
        client.once(eventName, handler);
      } else {
        client.on(eventName, handler);
      }
      entry.listeners.push({ name: eventName, handler });
    }

    if (typeof plugin.onLoad === 'function') {
      await plugin.onLoad(context);
    }

    loaded.set(manifest.name, entry);
    client.plugins.set(manifest.name, plugin);
    statusByFolder.set(folder, {
      state: 'loaded',
      name: manifest.name,
      version: manifest.version,
      commands: [...entry.commandNames],
      events: entry.listeners.length
    });
    logger.info(`Loaded plugin: ${manifest.name} v${manifest.version ?? '?'}`);
    return true;
  } catch (error) {
    logger.error(`Failed to load plugin ${folder}:`, error as Error);
    statusByFolder.set(folder, {
      state: 'error',
      name: manifest.name,
      version: manifest.version,
      commands: [],
      events: 0,
      error: (error as Error)?.message || 'failed to load'
    });
    return false;
  }
}

export async function loadPlugins(client: Client): Promise<void> {
  if (!fs.existsSync(PLUGINS_PATH)) {
    fs.mkdirSync(PLUGINS_PATH, { recursive: true });
    logger.info('Created plugins directory');
    return;
  }

  const folders = fs
    .readdirSync(PLUGINS_PATH, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();

  statusByFolder.clear();
  for (const folder of folders) {
    await loadOne(client, folder);
  }

  writeStatus();
  logger.info(`Loaded ${loaded.size} plugins`);
}

export async function unloadPlugin(client: Client, pluginName: string): Promise<boolean> {
  const entry = loaded.get(pluginName);
  if (!entry) return false;

  try {
    if (typeof entry.plugin.onUnload === 'function') {
      await entry.plugin.onUnload(entry.context);
    }
  } catch (error) {
    reportError(`plugin:${pluginName}:onUnload`, error);
  }

  for (const listener of entry.listeners) {
    client.off(listener.name, listener.handler);
  }
  for (const name of entry.commandNames) {
    client.commands.delete(name);
  }

  loaded.delete(pluginName);
  client.plugins.delete(pluginName);
  statusByFolder.set(entry.folder, { state: 'disabled', name: pluginName, commands: [], events: 0 });
  writeStatus();
  logger.info(`Unloaded plugin: ${pluginName}`);
  return true;
}

export async function reloadPlugin(client: Client, pluginName: string): Promise<boolean> {
  const folder = loaded.get(pluginName)?.folder ?? pluginName;
  await unloadPlugin(client, pluginName);
  const ok = await loadOne(client, folder, true);
  writeStatus();
  return ok;
}

export function listPlugins(): { name: string; version?: string; commands: string[]; events: number }[] {
  return [...loaded.entries()].map(([name, entry]) => ({
    name,
    version: entry.plugin.version,
    commands: entry.commandNames,
    events: entry.listeners.length
  }));
}

const SYNC_MS = 10_000;
const seenSignature = new Map<string, string>();
let syncTimer: NodeJS.Timeout | null = null;
let syncing = false;

function manifestSignature(folder: string): string | null {
  try {
    const stat = fs.statSync(path.join(PLUGINS_PATH, folder, 'manifest.json'));
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return null;
  }
}

export async function syncPlugins(client: Client): Promise<boolean> {
  let changed = false;
  let folders: string[];
  try {
    folders = fs
      .readdirSync(PLUGINS_PATH, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return false;
  }

  for (const [name, entry] of [...loaded.entries()]) {
    if (!folders.includes(entry.folder)) {
      await unloadPlugin(client, name);
      statusByFolder.delete(entry.folder);
      seenSignature.delete(entry.folder);
      changed = true;
    }
  }

  for (const folder of folders) {
    const signature = manifestSignature(folder) ?? 'missing';
    const previous = seenSignature.get(folder);
    const found = [...loaded.entries()].find(([, item]) => item.folder === folder);
    const entry = found?.[1];
    let wantsEnabled: boolean;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(PLUGINS_PATH, folder, 'manifest.json'), 'utf-8'));
      wantsEnabled = raw?.enabled !== false;
    } catch {
      wantsEnabled = false;
    }

    if (entry && !wantsEnabled) {
      await unloadPlugin(client, found![0]);
      seenSignature.set(folder, signature);
      changed = true;
      continue;
    }

    if (!entry && wantsEnabled && previous !== signature) {
      seenSignature.set(folder, signature);
      if (await loadOne(client, folder, true)) changed = true;
      writeStatus();
      continue;
    }

    if (!entry && !wantsEnabled && previous !== signature) {
      seenSignature.set(folder, signature);
      const state = statusByFolder.get(folder);
      if (state?.state !== 'disabled') {
        await loadOne(client, folder);
        writeStatus();
      }
      continue;
    }

    seenSignature.set(folder, signature);
  }

  if (changed) writeStatus();
  return changed;
}

export function startPluginWatcher(client: Client, onCommandsChanged: () => void | Promise<void>): void {
  if (syncTimer) return;
  for (const folder of statusByFolder.keys()) {
    const signature = manifestSignature(folder);
    if (signature) seenSignature.set(folder, signature);
  }
  syncTimer = setInterval(() => {
    if (syncing) return;
    syncing = true;
    syncPlugins(client)
      .then((changed) => (changed ? onCommandsChanged() : undefined))
      .catch((error) => reportError('plugins:sync', error))
      .finally(() => {
        syncing = false;
      });
  }, SYNC_MS);
  syncTimer.unref?.();
}

export function stopPluginWatcher(): void {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = null;
  seenSignature.clear();
}
