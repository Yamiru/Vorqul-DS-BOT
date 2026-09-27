/*!
 * Vorqul DS BOT - Settings Migrator
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import { migrateAllRecords, readSchemaVersion, SETTINGS_SCHEMA_VERSION } from '../shared/settingsMigrations.js';
import { invalidateGuildCache } from './guildCache.js';

const DATA_DIR = process.env.DATA_PATH || './data';
const SETTINGS_FILE = path.join(DATA_DIR, 'json', 'guild_settings.json');

export function runSettingsMigrations(): void {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return;

    const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    if (!Array.isArray(raw) || raw.length === 0) return;

    const oldest = raw.reduce(
      (min: number, entry: any) => Math.min(min, readSchemaVersion(entry)),
      SETTINGS_SCHEMA_VERSION
    );

    const { records, changed } = migrateAllRecords(raw);
    if (!changed) return;

    const backup = path.join(
      path.dirname(SETTINGS_FILE),
      `guild_settings.backup-v${oldest}.json`
    );
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(SETTINGS_FILE, backup);
    }

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(records, null, 2), 'utf-8');
    invalidateGuildCache();

    logger.info(
      `Nastavenia migrované na schému v${SETTINGS_SCHEMA_VERSION} ` +
        `(${records.length} serverov, najstaršia verzia v${oldest}). Záloha: ${path.basename(backup)}`
    );
  } catch (error) {
    logger.error('Migrácia nastavení zlyhala, pokračujem so starým tvarom:', error as Error);
  }
}
