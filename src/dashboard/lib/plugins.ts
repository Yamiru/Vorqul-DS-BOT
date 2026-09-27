/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  PLUGIN_NAME_PATTERN,
  validateManifest,
  resolveSettings,
  sanitizeSettings,
  resolveGuildSettings,
  sanitizeGuildSettings,
  channelReferences,
  type PluginSettingField,
  type SettingValue,
  type GuildValues
} from '../../shared/pluginManifest';
import { readZip, extractEntry, ZipError, type ZipLimits } from './zip';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ZIP_LIMITS: ZipLimits = { maxFiles: 500, maxTotalBytes: 25 * 1024 * 1024, maxFileBytes: 10 * 1024 * 1024 };
const MAX_MANIFEST_BYTES = 100 * 1024;
const IGNORED = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)(\/|$)/;

export class PluginError extends Error {
  constructor(public code: string, message?: string, public status = 400) {
    super(message || code);
  }
}

export type PluginState =
  | 'running'
  | 'disabled'
  | 'restart_enable'
  | 'restart_disable'
  | 'error'
  | 'invalid'
  | 'unknown';

export interface PluginInfo {
  folder: string;
  name: string;
  valid: boolean;
  error?: string;
  version: string;
  author: string;
  description: string;
  enabled: boolean;
  homepage?: string;
  github?: string;
  license?: string;
  state: PluginState;
  commands: string[];
  events: number;
  runtimeError?: string;
  hasDependencies: boolean;
  settings: { fields: PluginSettingField[]; values: Record<string, SettingValue> };
  guildSettings: { fields: PluginSettingField[]; values: GuildValues };
}

export interface PluginList {
  botStatusKnown: boolean;
  botStatusUpdatedAt?: string;
  plugins: PluginInfo[];
}

interface RuntimeRecord {
  state: 'loaded' | 'disabled' | 'error';
  commands?: string[];
  events?: number;
  error?: string;
}

const pluginsDir = () => path.resolve(process.env.PLUGINS_PATH || path.join(process.cwd(), 'plugins'));
const statusFile = () => path.resolve(process.env.DATA_PATH || './data', 'plugins_status.json');

function inside(root: string, target: string): boolean {
  const resolved = path.resolve(target);
  const base = path.resolve(root);
  return resolved === base || resolved.startsWith(base + path.sep);
}

function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmp, file);
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function readRuntime(): { known: boolean; updatedAt?: string; plugins: Record<string, RuntimeRecord> } {
  try {
    const raw: any = readJson(statusFile());
    if (raw && typeof raw === 'object' && raw.plugins && typeof raw.plugins === 'object') {
      return { known: true, updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined, plugins: raw.plugins };
    }
  } catch {
    return { known: false, plugins: {} };
  }
  return { known: false, plugins: {} };
}

function pluginFolder(name: string): string {
  if (!PLUGIN_NAME_PATTERN.test(String(name))) throw new PluginError('not_found', 'Unknown plugin', 404);
  const folder = path.join(pluginsDir(), name);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(folder);
  } catch {
    throw new PluginError('not_found', 'Unknown plugin', 404);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || !inside(pluginsDir(), folder)) {
    throw new PluginError('not_found', 'Unknown plugin', 404);
  }
  return folder;
}

const GUILD_ID = /^[A-Za-z0-9_-]{1,32}$/;

function describe(folder: string, runtime: ReturnType<typeof readRuntime>, guildId?: string): PluginInfo {
  const dir = path.join(pluginsDir(), folder);
  const base: PluginInfo = {
    folder,
    name: folder,
    valid: false,
    version: '',
    author: '',
    description: '',
    enabled: false,
    state: 'invalid',
    commands: [],
    events: 0,
    hasDependencies: fs.existsSync(path.join(dir, 'package.json')),
    settings: { fields: [], values: {} },
    guildSettings: { fields: [], values: {} }
  };

  let raw: unknown;
  try {
    raw = readJson(path.join(dir, 'manifest.json'));
  } catch (error) {
    return { ...base, error: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'manifest.json is missing' : 'manifest.json is not valid JSON' };
  }

  const parsed = validateManifest(raw);
  if ('error' in parsed) return { ...base, error: parsed.error };
  const manifest = parsed.manifest;
  if (manifest.name !== folder) {
    return { ...base, name: manifest.name, error: `the folder name must match the plugin name "${manifest.name}"` };
  }

  let stored: unknown;
  try {
    stored = readJson(path.join(dir, 'data', 'settings.json'));
  } catch {
    stored = {};
  }

  const globalValues = resolveSettings(manifest.settings, stored);
  let guildStored: unknown = {};
  if (guildId && GUILD_ID.test(guildId)) {
    try {
      guildStored = readJson(path.join(dir, 'data', 'guilds', `${guildId}.json`));
    } catch {
      guildStored = {};
    }
  }

  const record = runtime.plugins[folder];
  let state: PluginState;
  if (record?.state === 'loaded') state = manifest.enabled ? 'running' : 'restart_disable';
  else if (record?.state === 'error') state = manifest.enabled ? 'error' : 'disabled';
  else if (!runtime.known) state = manifest.enabled ? 'unknown' : 'disabled';
  else state = manifest.enabled ? 'restart_enable' : 'disabled';

  return {
    ...base,
    name: manifest.name,
    valid: true,
    version: manifest.version,
    author: manifest.author,
    description: manifest.description,
    enabled: manifest.enabled,
    homepage: manifest.homepage,
    github: manifest.github,
    license: manifest.license,
    state,
    commands: Array.isArray(record?.commands) ? record.commands.map(String).slice(0, 50) : [],
    events: Number(record?.events) || 0,
    runtimeError: state === 'error' ? String(record?.error || '').slice(0, 300) : undefined,
    settings: { fields: manifest.settings, values: globalValues },
    guildSettings: {
      fields: manifest.guildSettings,
      values: resolveGuildSettings(manifest.guildSettings, guildStored, globalValues)
    }
  };
}

export function listPlugins(guildId?: string): PluginList {
  const runtime = readRuntime();
  let folders: string[];
  try {
    folders = fs
      .readdirSync(pluginsDir(), { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.isSymbolicLink() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort();
  } catch {
    folders = [];
  }
  return {
    botStatusKnown: runtime.known,
    botStatusUpdatedAt: runtime.updatedAt,
    plugins: folders.map((folder) => describe(folder, runtime, guildId))
  };
}

export function setPluginEnabled(name: string, enabled: boolean): void {
  const folder = pluginFolder(name);
  const manifestPath = path.join(folder, 'manifest.json');
  let raw: any;
  try {
    raw = readJson(manifestPath);
  } catch {
    throw new PluginError('bad_manifest', 'manifest.json cannot be read');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PluginError('bad_manifest');
  raw.enabled = enabled;
  writeJsonAtomic(manifestPath, raw);
}

export function removePlugin(name: string): void {
  const folder = pluginFolder(name);
  fs.rmSync(folder, { recursive: true, force: true });
}

export function savePluginSettings(
  name: string,
  input: unknown
): { ok: true; values: Record<string, SettingValue> } | { ok: false; errors: Record<string, string> } {
  const folder = pluginFolder(name);
  const info = describe(name, readRuntime());
  if (!info.valid) throw new PluginError('bad_manifest', info.error);
  if (info.settings.fields.length === 0) throw new PluginError('no_settings', 'This plugin has no settings');

  const { values, errors } = sanitizeSettings(info.settings.fields, input, info.settings.values);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const dataDir = path.join(folder, 'data');
  if (fs.existsSync(dataDir) && fs.lstatSync(dataDir).isSymbolicLink()) throw new PluginError('bad_path');
  writeJsonAtomic(path.join(dataDir, 'settings.json'), values);
  return { ok: true, values };
}

export type ChannelLookup = (ids: string[]) => Promise<Map<string, number> | null>;

const TEXT_CHANNEL_TYPES = new Set([0, 5]);
const VOICE_CHANNEL_TYPES = new Set([2, 13]);

export async function saveGuildPluginSettings(
  name: string,
  guildId: string,
  input: unknown,
  lookupChannels: ChannelLookup
): Promise<{ ok: true; values: GuildValues } | { ok: false; errors: Record<string, string> }> {
  const folder = pluginFolder(name);
  if (!GUILD_ID.test(guildId)) throw new PluginError('bad_request');
  const info = describe(name, readRuntime(), guildId);
  if (!info.valid) throw new PluginError('bad_manifest', info.error);
  const fields = info.guildSettings.fields;
  if (fields.length === 0) throw new PluginError('no_settings', 'This plugin has no server settings');

  const { values, errors } = sanitizeGuildSettings(fields, input, info.guildSettings.values, info.settings.values);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const refs = channelReferences(fields, values);
  if (refs.length > 0) {
    const known = await lookupChannels(Array.from(new Set(refs.map((r) => r.id))));
    if (!known) throw new PluginError('channels_unavailable', 'The server channels could not be checked', 503);
    const bad: Record<string, string> = {};
    for (const ref of refs) {
      const type = known.get(ref.id);
      if (type === undefined) bad[ref.path] = 'channel_not_found';
      else if (!ref.kinds.some((kind) => (kind === 'text' ? TEXT_CHANNEL_TYPES : VOICE_CHANNEL_TYPES).has(type))) {
        bad[ref.path] = 'channel_kind';
      }
    }
    if (Object.keys(bad).length > 0) return { ok: false, errors: bad };
  }

  const dataDir = path.join(folder, 'data');
  if (fs.existsSync(dataDir) && fs.lstatSync(dataDir).isSymbolicLink()) throw new PluginError('bad_path');
  writeJsonAtomic(path.join(dataDir, 'guilds', `${guildId}.json`), values);
  return { ok: true, values };
}

function safeRelative(name: string): string | null {
  if (name.includes('\\') || name.includes('\0') || name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return null;
  const parts = name.split('/').filter((part) => part !== '');
  if (parts.length === 0 || parts.some((part) => part === '..' || part === '.')) return null;
  return parts.join('/');
}

export interface InstallResult {
  name: string;
  version: string;
  replaced: boolean;
  enabled: boolean;
  hasDependencies: boolean;
}

export function installPluginZip(buffer: Buffer, options: { replace?: boolean } = {}): InstallResult {
  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) throw new PluginError('too_large', undefined, 413);

  let entries;
  try {
    entries = readZip(buffer, ZIP_LIMITS);
  } catch (error) {
    if (error instanceof ZipError) throw new PluginError(error.code, error.message);
    throw error;
  }

  const files: { rel: string; entry: (typeof entries)[number] }[] = [];
  for (const entry of entries) {
    if (entry.isDirectory || IGNORED.test(entry.name)) continue;
    const rel = safeRelative(entry.name);
    if (!rel) throw new PluginError('bad_path', `Unsafe path in the archive: ${entry.name.slice(0, 80)}`);
    files.push({ rel, entry });
  }

  const candidates = files.filter((f) => f.rel === 'manifest.json' || /^[^/]+\/manifest\.json$/.test(f.rel));
  const rootManifest = candidates.find((f) => f.rel === 'manifest.json');
  const chosen = rootManifest || (candidates.length === 1 ? candidates[0] : undefined);
  if (!chosen) throw new PluginError('no_manifest', 'manifest.json was not found (or several were found)');
  if (chosen.entry.size > MAX_MANIFEST_BYTES) throw new PluginError('bad_manifest', 'manifest.json is too large');

  const prefix = chosen.rel === 'manifest.json' ? '' : chosen.rel.slice(0, chosen.rel.length - 'manifest.json'.length);
  const manifestBuffer = extract(buffer, chosen.entry);
  let rawManifest: any;
  try {
    rawManifest = JSON.parse(manifestBuffer.toString('utf-8'));
  } catch {
    throw new PluginError('bad_manifest', 'manifest.json is not valid JSON');
  }
  const parsed = validateManifest(rawManifest);
  if ('error' in parsed) throw new PluginError('bad_manifest', parsed.error);
  const manifest = parsed.manifest;

  const payload = files
    .filter((f) => f.rel.startsWith(prefix) && f.rel !== chosen.rel)
    .map((f) => ({ rel: f.rel.slice(prefix.length), entry: f.entry }))
    .filter((f) => f.rel !== 'data' && !f.rel.startsWith('data/'));
  if (!payload.some((f) => f.rel === manifest.main)) {
    throw new PluginError('missing_main', `The main file "${manifest.main}" is not in the archive`);
  }

  const root = pluginsDir();
  fs.mkdirSync(root, { recursive: true });
  const target = path.join(root, manifest.name);
  const exists = fs.existsSync(target);
  if (exists && !options.replace) throw new PluginError('exists', `Plugin "${manifest.name}" is already installed`, 409);
  if (exists) pluginFolder(manifest.name);

  const tmp = path.join(root, `.installing-${crypto.randomBytes(6).toString('hex')}`);
  fs.mkdirSync(tmp);
  try {
    for (const file of payload) {
      const dest = path.join(tmp, file.rel);
      if (!inside(tmp, dest) || dest === tmp) throw new PluginError('bad_path');
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, extract(buffer, file.entry), { mode: 0o644 });
    }

    let previouslyEnabled = false;
    if (exists) {
      try {
        previouslyEnabled = (readJson(path.join(target, 'manifest.json')) as any)?.enabled !== false;
      } catch {
        previouslyEnabled = false;
      }
    }
    rawManifest.enabled = exists ? previouslyEnabled : false;
    fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(rawManifest, null, 2) + '\n', 'utf-8');

    if (exists) {
      const oldData = path.join(target, 'data');
      if (fs.existsSync(oldData)) fs.renameSync(oldData, path.join(tmp, 'data'));
      const old = path.join(root, `.old-${crypto.randomBytes(6).toString('hex')}`);
      fs.renameSync(target, old);
      try {
        fs.renameSync(tmp, target);
      } catch (error) {
        fs.renameSync(old, target);
        throw error;
      }
      fs.rmSync(old, { recursive: true, force: true });
    } else {
      fs.renameSync(tmp, target);
    }
  } catch (error) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw error;
  }

  return {
    name: manifest.name,
    version: manifest.version,
    replaced: exists,
    enabled: rawManifest.enabled === true,
    hasDependencies: fs.existsSync(path.join(target, 'package.json'))
  };
}

function extract(buffer: Buffer, entry: Parameters<typeof extractEntry>[1]): Buffer {
  try {
    return extractEntry(buffer, entry);
  } catch (error) {
    if (error instanceof ZipError) throw new PluginError(error.code, error.message);
    throw error;
  }
}
