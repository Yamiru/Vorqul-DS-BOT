/*!
 * Vorqul DS BOT - Shared Settings Schema
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { defaultModuleState, MODULE_KEYS } from './moduleRegistry.js';

export { MODULE_KEYS };

export const MODULE_ALIASES: Record<string, string> = {
  logging: 'logs',
  logs: 'logs',
  tempchannels: 'tempChannels',
  tempChannels: 'tempChannels',
  antiraid: 'antiRaid',
  antiRaid: 'antiRaid',
  antinuke: 'antinuke',
  antiNuke: 'antinuke',
  reactionroles: 'reactionroles',
  reactionRoles: 'reactionroles',
  autoresponse: 'autoResponse',
  autoResponse: 'autoResponse',
  joinroles: 'joinRoles',
  joinRoles: 'joinRoles',
  autorole: 'joinRoles',
  namehistory: 'namehistory',
  nameHistory: 'namehistory',
  messagestats: 'messageStats',
  messageStats: 'messageStats',
  voicestats: 'voiceStats',
  voiceStats: 'voiceStats',
  serverstatus: 'serverStatus',
  serverStatus: 'serverStatus',
  prefixcommands: 'prefixCommands',
  prefixCommands: 'prefixCommands',
};

export function canonicalModuleKey(key: string): string {
  if (!key) return key;
  return MODULE_ALIASES[key] || key;
}

export function moduleEnabled(value: any, fallback = false): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'object' && typeof value.enabled === 'boolean') return value.enabled;
  return fallback;
}

export function isModuleEnabled(settings: any, moduleKey: string, fallback = true): boolean {
  const modules = settings?.modules;
  if (!modules || typeof modules !== 'object') return fallback;

  const canonical = canonicalModuleKey(moduleKey);
  if (canonical in modules) return moduleEnabled(modules[canonical], fallback);

  for (const [alias, target] of Object.entries(MODULE_ALIASES)) {
    if (target !== canonical) continue;
    if (alias in modules) return moduleEnabled(modules[alias], fallback);
  }

  return fallback;
}

export function getModuleConfig(settings: any, moduleKey: string): Record<string, any> {
  const modules = settings?.modules;
  if (!modules || typeof modules !== 'object') return {};

  const canonical = canonicalModuleKey(moduleKey);
  const value = modules[canonical];
  if (value && typeof value === 'object') return value;

  for (const [alias, target] of Object.entries(MODULE_ALIASES)) {
    if (target !== canonical) continue;
    const aliased = modules[alias];
    if (aliased && typeof aliased === 'object') return aliased;
  }
  return {};
}

export interface SettingsField {
  key: string;

  column: string;

  default: () => any;
}

const obj = (value: Record<string, any>) => () => JSON.parse(JSON.stringify(value));
const arr = () => () => [] as any[];
const str = (value = '') => () => value;

export const SETTINGS_FIELDS: SettingsField[] = [
  { key: 'prefix', column: 'prefix', default: str('!') },
  { key: 'language', column: 'language', default: str('sk') },
  { key: 'timezone', column: 'timezone', default: str('Europe/Bratislava') },
  { key: 'botNickname', column: 'bot_nickname', default: str('') },

  { key: 'modules', column: 'modules', default: () => defaultModuleState() },

  { key: 'welcomeChannel', column: 'welcome_channel', default: str('') },
  { key: 'welcomeMessage', column: 'welcome_message', default: str('') },
  { key: 'welcomeEmbed', column: 'welcome_embed', default: obj({ enabled: false }) },
  { key: 'welcomeDM', column: 'welcome_dm', default: obj({ enabled: false }) },
  {
    key: 'welcomeCard',
    column: 'welcome_card',
    default: obj({
      enabled: false, title: 'Vitaj, {username}!', subtitle: '{count}. člen servera {server}',
      backgroundUrl: '', backgroundColor: '#1B1815', textColor: '#ffffff', accentColor: '#14707A',
    }),
  },
  { key: 'goodbyeChannel', column: 'goodbye_channel', default: str('') },
  { key: 'goodbyeMessage', column: 'goodbye_message', default: str('') },
  { key: 'goodbyeEmbed', column: 'goodbye_embed', default: obj({ enabled: false }) },
  { key: 'autoRole', column: 'auto_role', default: str('') },

  { key: 'logChannels', column: 'log_channels', default: obj({}) },
  {
    key: 'logs',
    column: 'logs',
    default: obj({ enabled: false, channels: {}, events: {}, blacklistChannels: [] }),
  },
  {
    key: 'automod',
    column: 'automod',
    default: obj({
      enabled: false, ignoreAdmins: true, bypassRoles: [], ignoredChannels: [], blacklist: [],
      spam: { enabled: false, maxMessages: 5, interval: 5000, action: 'timeout', duration: 300 },
      links: { enabled: false, action: 'delete', whitelist: [] },
      invites: { enabled: false, action: 'delete' },
      caps: { enabled: false, percentage: 70, minLength: 10, action: 'delete' },
      mentions: { enabled: false, maxMentions: 5, action: 'timeout', duration: 300 },
      repeated: { enabled: false, maxRepeats: 3, action: 'delete' },
      emojis: { enabled: false, maxEmojis: 5, action: 'delete' },
      spoilers: { enabled: false, maxSpoilers: 3, action: 'delete' },
      zalgo: { enabled: false, action: 'delete' },
      escalation: { enabled: false, windowMinutes: 60, rules: [] },
      phishing: { enabled: true, action: 'ban', duration: 0 },
      fakeNitro: { enabled: true, action: 'timeout', duration: 600 },
      cryptoScam: { enabled: false, action: 'delete', duration: 0 },
      regex: { enabled: false, action: 'delete', duration: 0, rules: [] },
      massMention: { enabled: false, maxMentions: 5, countEveryone: true, action: 'timeout', duration: 600 },
      ghostPing: { enabled: false, maxAgeSeconds: 30 },
      attachments: { enabled: false, maxAttachments: 0, imagesOnly: false, action: 'delete' },
    }),
  },
  { key: 'antiraid', column: 'antiraid', default: obj({ enabled: false }) },
  {
    key: 'antinuke',
    column: 'antinuke',
    default: obj({
      enabled: false,
      logChannel: '',
      punishment: 'removeRoles',
      whitelistUsers: [],
      whitelistRoles: [],
      ignoreBots: false,
      limits: {
        channelDelete: { enabled: true, max: 3, windowSeconds: 20 },
        channelCreate: { enabled: true, max: 5, windowSeconds: 20 },
        roleDelete: { enabled: true, max: 3, windowSeconds: 20 },
        roleCreate: { enabled: true, max: 5, windowSeconds: 20 },
        ban: { enabled: true, max: 3, windowSeconds: 30 },
        kick: { enabled: true, max: 5, windowSeconds: 30 },
        webhookCreate: { enabled: true, max: 3, windowSeconds: 30 },
        emojiDelete: { enabled: false, max: 5, windowSeconds: 30 },
        memberRoleUpdate: { enabled: false, max: 6, windowSeconds: 20 },
      },
    }),
  },
  { key: 'moderation', column: 'moderation', default: obj({}) },
  { key: 'warningActions', column: 'warning_actions', default: arr() },
  { key: 'immunityRoles', column: 'immunity_roles', default: arr() },
  { key: 'appealInfo', column: 'appeal_info', default: obj({}) },

  {
    key: 'leveling',
    column: 'leveling',
    default: obj({ enabled: true, xpMin: 15, xpMax: 25, xpCooldown: 60, roleRewards: [] }),
  },
  {
    key: 'economy',
    column: 'economy',
    default: obj({ enabled: true, currencyName: 'coins', currencyEmoji: '💰', dailyAmount: 100 }),
  },
  { key: 'starboard', column: 'starboard', default: obj({ enabled: false }) },
  { key: 'suggestions', column: 'suggestions', default: obj({ enabled: false }) },
  { key: 'counting', column: 'counting', default: obj({ enabled: false }) },
  {
    key: 'reputation',
    column: 'reputation',
    default: obj({ enabled: true, cooldownHours: 12, allowNegative: true, rewardRole: '', rewardThreshold: 0 }),
  },
  {
    key: 'birthday',
    column: 'birthday',
    default: obj({
      enabled: false, channel: '', role: '', message: '🎉 Happy birthday {user}! 🎂',
      useEmbed: false, color: '#E3C766',
    }),
  },
  {
    key: 'confessions',
    column: 'confessions',
    default: obj({
      enabled: false, channel: '', logChannel: '', allowReplies: true,
      minAccountAgeDays: 0, blockedUsers: [],
    }),
  },

  { key: 'tickets', column: 'tickets', default: obj({ enabled: false }) },
  { key: 'applications', column: 'applications', default: obj({ enabled: false }) },
  { key: 'verification', column: 'verification', default: obj({ enabled: false, type: 'button' }) },
  { key: 'giveaways', column: 'giveaways', default: obj({ enabled: true }) },
  { key: 'tempChannels', column: 'temp_channels', default: obj({ enabled: false }) },
  { key: 'games', column: 'games', default: obj({}) },
  { key: 'crypto', column: 'crypto', default: obj({ enabled: false }) },
  { key: 'stocks', column: 'stocks', default: obj({ enabled: false }) },
  { key: 'socials', column: 'socials', default: obj({}) },
  { key: 'autoResponses', column: 'auto_responses', default: arr() },
  { key: 'feeds', column: 'feeds', default: arr() },
  { key: 'tags', column: 'tags', default: arr() },
  { key: 'reminders', column: 'reminders', default: obj({ maxPerUser: 25, maxDuration: 365 }) },
  { key: 'backup', column: 'backup', default: obj({ enabled: false }) },
  { key: 'links', column: 'links', default: obj({}) },
  { key: 'reactionRoles', column: 'reaction_roles', default: obj({ buttons: [] }) },
  { key: 'customCommands', column: 'custom_commands', default: arr() },
  { key: 'savedMessages', column: 'saved_messages', default: arr() },
  { key: 'savedReactionRoles', column: 'saved_reaction_roles', default: arr() },
  { key: 'sticky', column: 'sticky', default: arr() },
  {
    key: 'webhooks',
    column: 'webhooks',
    default: obj({
      enabled: false, url: '', secret: '',
      events: { memberJoin: true, memberLeave: true, memberBan: true, memberUnban: true },
    }),
  },
  { key: 'managerRoleId', column: 'manager_role_id', default: str('') },

  { key: 'channelScopes', column: 'channel_scopes', default: obj({}) },
  { key: 'commandScopes', column: 'command_scopes', default: obj({}) },
  { key: 'customTexts', column: 'custom_texts', default: obj({}) },
  { key: 'prefixCommands', column: 'prefix_commands', default: obj({ enabled: true, aliases: {} }) },
];

export const KEY_TO_COLUMN: Record<string, string> = SETTINGS_FIELDS.reduce((map, field) => {
  map[field.key] = field.column;
  return map;
}, {} as Record<string, string>);

export const COLUMN_TO_KEY: Record<string, string> = SETTINGS_FIELDS.reduce((map, field) => {
  map[field.column] = field.key;
  return map;
}, {} as Record<string, string>);

export const INTERNAL_COLUMNS = [
  'guild_id', 'created_at', 'updated_at', 'schema_version', 'temp_actions',
];

export const SETTINGS_KEYS: string[] = SETTINGS_FIELDS.map((f) => f.key);
export const SETTINGS_COLUMNS: string[] = SETTINGS_FIELDS.map((f) => f.column);

export function defaultSettings(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const field of SETTINGS_FIELDS) out[field.key] = field.default();
  return out;
}

function passthrough(source: any, skip: Set<string>): Record<string, any> {
  const out: Record<string, any> = {};
  if (!source || typeof source !== 'object') return out;
  for (const [key, value] of Object.entries(source)) {
    if (skip.has(key)) continue;
    out[key] = value;
  }
  return out;
}

const KEY_SET = new Set(SETTINGS_KEYS);
const COLUMN_SET = new Set([...SETTINGS_COLUMNS, ...INTERNAL_COLUMNS]);

export function toStorageFormat(guildId: string, settings: any): Record<string, any> {
  const out: Record<string, any> = passthrough(settings, KEY_SET);
  delete out.guildId;

  for (const field of SETTINGS_FIELDS) {
    const value = settings?.[field.key];
    if (value === undefined) continue;
    out[field.column] = value;
  }

  out.guild_id = guildId;
  return out;
}

export function toDashboardFormat(record: any): Record<string, any> | null {
  if (!record) return null;

  const out: Record<string, any> = passthrough(record, COLUMN_SET);

  for (const field of SETTINGS_FIELDS) {
    const value = record[field.column];
    out[field.key] = value === undefined || value === null ? field.default() : value;
  }

  out.guildId = record.guild_id;
  return out;
}

export function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key in source) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = deepMerge(target?.[key] || {}, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function withDefaults(settings: any): Record<string, any> {
  return deepMerge(defaultSettings(), settings || {});
}
