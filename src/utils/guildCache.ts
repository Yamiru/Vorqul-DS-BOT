/*!
 * Vorqul DS BOT - Guild Settings Cache
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import fs from 'fs';
import path from 'path';
import { migrateGuildRecord } from '../shared/settingsMigrations.js';
import { logger } from '../utils/logger.js';

const DATA_DIR = process.env.DATA_PATH || './data';
const SETTINGS_FILE = path.join(DATA_DIR, 'json', 'guild_settings.json');
const CACHE_TTL_MS = 5_000;

let records = new Map<string, any>();
let cachedAt = 0;
let lastMtimeMs = -1;

function refresh(): void {
  const now = Date.now();
  if (now - cachedAt < CACHE_TTL_MS) return;
  cachedAt = now;

  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      records = new Map();
      lastMtimeMs = -1;
      return;
    }

    const stat = fs.statSync(SETTINGS_FILE);
    if (stat.mtimeMs === lastMtimeMs) return;
    lastMtimeMs = stat.mtimeMs;

    const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    const next = new Map<string, any>();

    if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (!entry?.guild_id) continue;

        next.set(entry.guild_id, migrateGuildRecord(entry).record);
      }
    }

    records = next;
  } catch (error) {
      logger.debug('guildCache: suppressed error', error);
    }
}

export function getGuildRecord(guildId: string): any | undefined {
  refresh();
  return records.get(guildId);
}

export function invalidateGuildCache(): void {
  cachedAt = 0;
  lastMtimeMs = -1;
}

export function getGuildLanguageFromDisk(guildId: string): string | undefined {
  const record = getGuildRecord(guildId);
  const language = record?.language;
  return typeof language === 'string' && language.length > 0 ? language : undefined;
}

export function getBotNickname(guildId: string): string | undefined {
  const record = getGuildRecord(guildId);
  const nickname = record?.bot_nickname ?? record?.botNickname;
  return typeof nickname === 'string' && nickname.trim().length > 0
    ? nickname.trim()
    : undefined;
}

export function getKnownGuildIds(): string[] {
  refresh();
  return [...records.keys()];
}
