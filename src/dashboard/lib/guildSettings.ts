import fs from 'fs';
import path from 'path';
import {
  defaultSettings as schemaDefaults,
  deepMerge,
  moduleEnabled,
  toDashboardFormat,
  toStorageFormat,
  withDefaults,
} from '../../shared/settingsSchema';
import { migrateAllRecords, migrateGuildRecord, SETTINGS_SCHEMA_VERSION } from '../../shared/settingsMigrations';

const DATA_DIR = process.env.DATA_PATH || './data';
const JSON_STORAGE_PATH = path.join(DATA_DIR, 'json');
const GUILD_SETTINGS_FILE = path.join(JSON_STORAGE_PATH, 'guild_settings.json');

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(JSON_STORAGE_PATH)) fs.mkdirSync(JSON_STORAGE_PATH, { recursive: true });
  } catch (error) {
    console.error('Failed to create data directory:', error);
  }
}

export function loadAllSettings(): any[] {
  ensureDataDir();
  if (!fs.existsSync(GUILD_SETTINGS_FILE)) return [];

  try {
    const raw = JSON.parse(fs.readFileSync(GUILD_SETTINGS_FILE, 'utf-8'));

    return migrateAllRecords(raw).records;
  } catch (error) {
    console.error('Failed to read guild settings:', error);
    return [];
  }
}

export function saveAllSettings(settings: any[]): void {
  ensureDataDir();
  const tmp = `${GUILD_SETTINGS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf-8');
  fs.renameSync(tmp, GUILD_SETTINGS_FILE);
}

export function loadAllSettingsForWrite(): any[] {
  ensureDataDir();
  if (!fs.existsSync(GUILD_SETTINGS_FILE)) return [];
  const raw = JSON.parse(fs.readFileSync(GUILD_SETTINGS_FILE, 'utf-8'));
  return migrateAllRecords(raw).records;
}

export function loadRaw(guildId: string): any {
  return loadAllSettings().find((s) => s.guild_id === guildId) || null;
}

export function convertToBotFormat(guildId: string, settings: any): any {
  return toStorageFormat(guildId, settings);
}

export function convertToDashboardFormat(settings: any): any {
  if (!settings) return null;
  return toDashboardFormat(migrateGuildRecord(settings).record);
}

export const defaultSettings: Record<string, any> = schemaDefaults();

export { moduleEnabled, deepMerge, SETTINGS_SCHEMA_VERSION };

export function getDashboardSettings(guildId: string): any {
  const raw = loadRaw(guildId);
  const dash = convertToDashboardFormat(raw) || { guildId, ...schemaDefaults() };
  const merged = withDefaults(dash);
  merged.guildId = guildId;
  return merged;
}

function persist(guildId: string, merged: any): any {
  const all = loadAllSettingsForWrite();
  const index = all.findIndex((s) => s.guild_id === guildId);
  const stored = toStorageFormat(guildId, merged);
  stored.schema_version = SETTINGS_SCHEMA_VERSION;

  if (index >= 0) {
    all[index] = { ...all[index], ...stored, updated_at: new Date().toISOString() };
  } else {
    all.push({ ...stored, created_at: new Date().toISOString() });
  }
  saveAllSettings(all);
  return merged;
}

export function replaceSettingsKey(guildId: string, key: string, value: any): any {
  const raw = loadRaw(guildId);
  const existingDash = convertToDashboardFormat(raw) || schemaDefaults();
  return persist(guildId, { ...existingDash, [key]: value });
}

export function patchSettings(guildId: string, body: any): any {
  const raw = loadRaw(guildId);
  const existingDash = convertToDashboardFormat(raw) || schemaDefaults();
  return persist(guildId, deepMerge(existingDash, body));
}
