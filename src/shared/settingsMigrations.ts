/*!
 * Vorqul DS BOT - Settings Migrations
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { GAMES } from './gameRegistry.js';
import {
  MODULE_ALIASES,
  SETTINGS_FIELDS,
  canonicalModuleKey,
} from './settingsSchema.js';

export const SETTINGS_SCHEMA_VERSION = 3;

export interface Migration {
  version: number;
  description: string;

  apply: (record: Record<string, any>) => void;
}

function isPlainObject(value: any): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clone(value: Record<string, any>): Record<string, any> {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

const migration1: Migration = {
  version: 1,
  description: 'Zjednotenie kľúčov modulov, hier a stĺpcov so spoločnou schémou',
  apply(record) {
    for (const field of SETTINGS_FIELDS) {
      if (field.key === field.column) continue;
      if (record[field.key] === undefined) continue;
      if (record[field.column] === undefined || record[field.column] === null) {
        record[field.column] = record[field.key];
      }
      delete record[field.key];
    }

    if (isPlainObject(record.modules)) {
      const modules = record.modules;
      const countingConfig: Record<string, any> = {};

      for (const legacy of Object.keys(MODULE_ALIASES)) {
        const canonical = canonicalModuleKey(legacy);
        if (legacy === canonical) continue;
        if (!(legacy in modules)) continue;

        if (modules[canonical] === undefined || modules[canonical] === null) {
          modules[canonical] = modules[legacy];
        }
        delete modules[legacy];
      }

      if (isPlainObject(modules.counting)) {
        for (const [key, value] of Object.entries(modules.counting)) {
          if (key === 'enabled') continue;
          countingConfig[key] = value;
        }
        modules.counting = modules.counting.enabled !== false;
      }

      if (Object.keys(countingConfig).length > 0) {
        const current = isPlainObject(record.counting) ? record.counting : {};
        record.counting = { ...countingConfig, ...current };
      }
    }

    if (isPlainObject(record.games)) {
      const known = new Set(GAMES.map((game) => game.key));
      for (const [key, value] of Object.entries(record.games)) {
        if (!known.has(key)) {
          delete record.games[key];
          continue;
        }
        if (typeof value === 'boolean') {
          record.games[key] = { enabled: value };
        }
      }
    }

    if (isPlainObject(record.channel_scopes)) {
      const known = new Set(GAMES.map((game) => game.key));
      for (const key of Object.keys(record.channel_scopes)) {
        if (!key.startsWith('games.')) continue;
        if (!known.has(key.slice('games.'.length))) {
          delete record.channel_scopes[key];
        }
      }
    }
  },
};

const migration2: Migration = {
  version: 2,
  description: 'Prepis starých kľúčov AutoMod na tvar, ktorý bot číta',
  apply(record) {
    const am = record.automod;
    if (!isPlainObject(am)) return;

    const branch = (name: string): Record<string, any> => {
      if (!isPlainObject(am[name])) am[name] = {};
      return am[name];
    };

    const toggles: Record<string, string> = {
      antiSpam: 'spam',
      antiLinks: 'links',
      antiInvites: 'invites',
      antiMentions: 'mentions',
      antiCaps: 'caps',
      antiZalgo: 'zalgo',
      antiEmojis: 'emojis',
      antiScam: 'phishing',
    };
    for (const [legacy, target] of Object.entries(toggles)) {
      if (typeof am[legacy] !== 'boolean') continue;
      const node = branch(target);
      if (node.enabled === undefined) node.enabled = am[legacy];
      delete am[legacy];
    }

    const limits: Array<[string, string, string]> = [
      ['maxMentions', 'mentions', 'maxMentions'],
      ['maxEmojis', 'emojis', 'maxEmojis'],
      ['maxCaps', 'caps', 'percentage'],
      ['muteDuration', 'spam', 'duration'],
    ];
    for (const [legacy, target, key] of limits) {
      if (typeof am[legacy] !== 'number') continue;
      const node = branch(target);
      if (node[key] === undefined) node[key] = am[legacy];
      delete am[legacy];
    }

    if (Array.isArray(am.blacklistedWords)) {
      if (!Array.isArray(am.blacklist) || am.blacklist.length === 0) {
        am.blacklist = am.blacklistedWords;
      }
      delete am.blacklistedWords;
    }
    if (Array.isArray(am.whitelistedRoles)) {
      if (!Array.isArray(am.bypassRoles) || am.bypassRoles.length === 0) {
        am.bypassRoles = am.whitelistedRoles;
      }
      delete am.whitelistedRoles;
    }
    if (Array.isArray(am.whitelistedChannels)) {
      if (!Array.isArray(am.ignoredChannels) || am.ignoredChannels.length === 0) {
        am.ignoredChannels = am.whitelistedChannels;
      }
      delete am.whitelistedChannels;
    }

    if (typeof am.action === 'string') {
      if (am.blacklist_action === undefined) am.blacklist_action = am.action;
      delete am.action;
    }

    delete am.antiNewlines;
  },
};

const migration3: Migration = {
  version: 3,
  description: 'Zjednotenie logovania a levelingu do spoločného tvaru',
  apply(record) {
    const logs: Record<string, any> = isPlainObject(record.logs) ? record.logs : {};
    const moduleLogs = isPlainObject(record.modules) && isPlainObject(record.modules.logs)
      ? record.modules.logs
      : {};

    const channels: Record<string, any> = isPlainObject(logs.channels) ? logs.channels : {};

    for (const source of [moduleLogs.channels, record.log_channels]) {
      if (!isPlainObject(source)) continue;
      for (const [key, value] of Object.entries(source)) {
        if (typeof value === 'string' && value && !channels[key]) channels[key] = value;
      }
    }

    const events: Record<string, any> = isPlainObject(logs.events) ? logs.events : {};
    if (isPlainObject(moduleLogs.events)) {
      for (const [key, value] of Object.entries(moduleLogs.events)) {
        if (typeof value === 'boolean' && events[key] === undefined) events[key] = value;
      }
    }

    const blacklist = new Set<string>([
      ...(Array.isArray(logs.blacklistChannels) ? logs.blacklistChannels : []),
      ...(Array.isArray(moduleLogs.blacklistChannels) ? moduleLogs.blacklistChannels : []),
    ]);

    const hadChannels = Object.keys(channels).length > 0;
    const enabled = typeof logs.enabled === 'boolean'
      ? logs.enabled
      : (typeof moduleLogs.enabled === 'boolean' ? moduleLogs.enabled : hadChannels);

    if (hadChannels || Object.keys(events).length > 0 || blacklist.size > 0 || enabled) {
      record.logs = {
        enabled,
        channels,
        events,
        blacklistChannels: [...blacklist],
      };
    }

    if (isPlainObject(record.modules) && isPlainObject(record.modules.logs)) {
      record.modules.logs = enabled;
    }
    delete record.log_channels;

    if (isPlainObject(record.leveling)) {
      const lv = record.leveling;

      if (isPlainObject(lv.xpPerMessage)) {
        if (lv.xpMin === undefined && typeof lv.xpPerMessage.min === 'number') lv.xpMin = lv.xpPerMessage.min;
        if (lv.xpMax === undefined && typeof lv.xpPerMessage.max === 'number') lv.xpMax = lv.xpPerMessage.max;
        delete lv.xpPerMessage;
      } else if (typeof lv.xpPerMessage === 'number') {
        if (lv.xpMin === undefined) lv.xpMin = lv.xpPerMessage;
        if (lv.xpMax === undefined) lv.xpMax = lv.xpPerMessage;
        delete lv.xpPerMessage;
      }

      if (typeof lv.xpCooldown === 'number' && lv.xpCooldown >= 1000) {
        lv.xpCooldown = Math.round(lv.xpCooldown / 1000);
      }

      if (Array.isArray(lv.ignoredChannels)) {
        if (!Array.isArray(lv.noXpChannels) || lv.noXpChannels.length === 0) {
          lv.noXpChannels = lv.ignoredChannels;
        }
        delete lv.ignoredChannels;
      }
      if (Array.isArray(lv.ignoredRoles)) {
        if (!Array.isArray(lv.noXpRoles) || lv.noXpRoles.length === 0) {
          lv.noXpRoles = lv.ignoredRoles;
        }
        delete lv.ignoredRoles;
      }

      if (isPlainObject(lv.roleRewards)) {
        lv.roleRewards = Object.entries(lv.roleRewards)
          .map(([level, roleId]) => ({ level: Number.parseInt(level, 10), roleId: String(roleId) }))
          .filter((entry) => Number.isFinite(entry.level) && entry.level > 0 && entry.roleId)
          .sort((a, b) => a.level - b.level);
      }
    }

    if (isPlainObject(record.modules) && isPlainObject(record.modules.tempChannels)) {
      const legacy = record.modules.tempChannels;
      const target: Record<string, any> = isPlainObject(record.temp_channels) ? record.temp_channels : {};

      if (target.hubChannel === undefined && legacy.triggerChannel) target.hubChannel = legacy.triggerChannel;
      if (target.category === undefined && legacy.category) target.category = legacy.category;
      if (target.nameFormat === undefined && legacy.defaultName) target.nameFormat = legacy.defaultName;
      if (target.bitrate === undefined && legacy.defaultBitrate) target.bitrate = legacy.defaultBitrate;
      if (target.userLimit === undefined && legacy.defaultUserLimit) target.userLimit = legacy.defaultUserLimit;
      if (target.enabled === undefined && typeof legacy.enabled === 'boolean') target.enabled = legacy.enabled;

      record.temp_channels = target;
      record.modules.tempChannels = legacy.enabled !== false;
    }

    if (isPlainObject(record.modules) && isPlainObject(record.modules.moderation)) {
      const legacy = record.modules.moderation;
      const target: Record<string, any> = isPlainObject(record.moderation) ? record.moderation : {};

      for (const key of ['muteRole', 'jailRole', 'appealsChannel']) {
        if (target[key] === undefined && legacy[key]) target[key] = legacy[key];
      }

      record.moderation = target;
      record.modules.moderation = legacy.enabled !== false;
    }
  },
};

export const MIGRATIONS: Migration[] = [migration1, migration2, migration3];

export function readSchemaVersion(record: any): number {
  const raw = record?.schema_version;
  const value = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export interface MigrationResult {
  record: Record<string, any>;
  changed: boolean;
  from: number;
  to: number;
  applied: string[];
}

export function migrateGuildRecord(input: any): MigrationResult {
  const from = readSchemaVersion(input);
  const record: Record<string, any> = isPlainObject(input) ? clone(input) : {};
  const applied: string[] = [];

  if (from >= SETTINGS_SCHEMA_VERSION) {
    return { record, changed: false, from, to: from, applied };
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= from) continue;
    migration.apply(record);
    applied.push(`v${migration.version}: ${migration.description}`);
  }

  record.schema_version = SETTINGS_SCHEMA_VERSION;
  return { record, changed: true, from, to: SETTINGS_SCHEMA_VERSION, applied };
}

export function migrateAllRecords(records: any[]): { records: any[]; changed: boolean } {
  if (!Array.isArray(records)) return { records: [], changed: false };

  let changed = false;
  const out = records.map((entry) => {
    const result = migrateGuildRecord(entry);
    if (result.changed) changed = true;
    return result.record;
  });

  return { records: out, changed };
}
