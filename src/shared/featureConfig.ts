/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { getModuleConfig, isModuleEnabled } from './settingsSchema.js';

function num(value: any, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: any, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function list(value: any): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

function pick(...values: any[]): any {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

export type LogCategoryKey =
  | 'messages'
  | 'members'
  | 'moderation'
  | 'voice'
  | 'server'
  | 'roles'
  | 'channels'
  | 'invites'
  | 'threads'
  | 'emojis'
  | 'boosts'
  | 'automod'
  | 'tickets';

export interface LoggingConfig {
  enabled: boolean;
  channels: Record<string, string>;
  events: Record<string, boolean>;
  blacklistChannels: string[];
}

export function resolveLogging(settings: any): LoggingConfig {
  const top = settings?.logs && typeof settings.logs === 'object' ? settings.logs : {};
  const mod = getModuleConfig(settings, 'logs');
  const flat = settings?.logChannels && typeof settings.logChannels === 'object' ? settings.logChannels : {};

  const channels: Record<string, string> = {};
  for (const source of [mod.channels, top.channels, flat]) {
    if (!source || typeof source !== 'object') continue;
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string' && value) channels[key] = value;
    }
  }

  const events: Record<string, boolean> = {};
  for (const source of [mod.events, top.events]) {
    if (!source || typeof source !== 'object') continue;
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'boolean') events[key] = value;
    }
  }

  const blacklistChannels = [
    ...list(mod.blacklistChannels),
    ...list(top.blacklistChannels),
  ];

  const explicit = pick(top.enabled, mod.enabled);
  const enabled = typeof explicit === 'boolean'
    ? explicit
    : isModuleEnabled(settings, 'logs', Object.keys(channels).length > 0);

  return { enabled, channels, events, blacklistChannels };
}

export interface LevelingRoleReward {
  level: number;
  roleId: string;
}

export interface LevelingConfig {
  enabled: boolean;
  xpMin: number;
  xpMax: number;
  xpMultiplier: number;
  cooldownMs: number;
  maxLevel: number;
  stackRoles: boolean;
  voiceXp: boolean;
  voiceXpPerMinute: number;
  levelUpChannel: string;
  levelUpMessage: string;
  noXpChannels: string[];
  noXpRoles: string[];
  roleRewards: LevelingRoleReward[];
}

function normalizeRoleRewards(source: any): LevelingRoleReward[] {
  const out: LevelingRoleReward[] = [];
  if (Array.isArray(source)) {
    for (const entry of source) {
      if (!entry) continue;
      const level = num(entry.level ?? entry.lvl, 0);
      const roleId = String(entry.roleId ?? entry.role ?? '');
      if (level > 0 && roleId) out.push({ level, roleId });
    }
  } else if (source && typeof source === 'object') {
    for (const [level, roleId] of Object.entries(source)) {
      const parsed = num(level, 0);
      if (parsed > 0 && typeof roleId === 'string' && roleId) out.push({ level: parsed, roleId });
    }
  }
  return out.sort((a, b) => a.level - b.level);
}

export function resolveLeveling(settings: any): LevelingConfig {
  const top = settings?.leveling && typeof settings.leveling === 'object' ? settings.leveling : {};
  const mod = getModuleConfig(settings, 'leveling');
  const perMessage = top.xpPerMessage ?? mod.xpPerMessage;

  const xpMin = num(pick(top.xpMin, mod.xpMin, perMessage?.min, typeof perMessage === 'number' ? perMessage : undefined), 15);
  const xpMax = num(pick(top.xpMax, mod.xpMax, perMessage?.max, typeof perMessage === 'number' ? perMessage : undefined), 25);

  const rawCooldown = num(pick(top.xpCooldown, mod.xpCooldown), 60);
  const cooldownMs = rawCooldown >= 1000 ? rawCooldown : rawCooldown * 1000;

  return {
    enabled: isModuleEnabled(settings, 'leveling', bool(pick(top.enabled, mod.enabled), true)),
    xpMin: Math.max(0, Math.min(xpMin, xpMax)),
    xpMax: Math.max(xpMin, xpMax),
    xpMultiplier: Math.max(0, num(pick(top.xpMultiplier, mod.xpMultiplier), 1)),
    cooldownMs: Math.max(0, cooldownMs),
    maxLevel: Math.max(0, num(pick(top.maxLevel, mod.maxLevel), 100)),
    stackRoles: bool(pick(top.stackRoles, mod.stackRoles), false),
    voiceXp: bool(pick(top.voiceXp, mod.voiceXp), false),
    voiceXpPerMinute: Math.max(0, num(pick(top.voiceXpPerMinute, mod.voiceXpPerMinute), 5)),
    levelUpChannel: String(pick(top.levelUpChannel, mod.levelUpChannel) || ''),
    levelUpMessage: String(pick(top.levelUpMessage, mod.levelUpMessage) || ''),
    noXpChannels: [...list(top.noXpChannels ?? top.ignoredChannels), ...list(mod.noXpChannels ?? mod.ignoredChannels)],
    noXpRoles: [...list(top.noXpRoles ?? top.ignoredRoles), ...list(mod.noXpRoles ?? mod.ignoredRoles)],
    roleRewards: normalizeRoleRewards(pick(top.roleRewards, mod.roleRewards)),
  };
}

export interface EconomyConfig {
  enabled: boolean;
  currencyName: string;
  currencyEmoji: string;
  startingBalance: number;
  dailyAmount: number;
  dailyStreakBonus: number;
  maxStreakBonus: number;
  workMinReward: number;
  workMaxReward: number;
  workCooldown: number;
  bankEnabled: boolean;
  bankInterest: number;
  robEnabled: boolean;
  minBet: number;
  maxBet: number;
  gambling: Record<string, boolean>;
}

export function resolveEconomy(settings: any): EconomyConfig {
  const top = settings?.economy && typeof settings.economy === 'object' ? settings.economy : {};
  const mod = getModuleConfig(settings, 'economy');
  const daily = pick(top.dailyReward, mod.dailyReward);

  const gambling: Record<string, boolean> = {};
  const rawGambling = pick(top.gambling, mod.gambling);
  if (rawGambling && typeof rawGambling === 'object') {
    for (const [key, value] of Object.entries(rawGambling)) {
      if (typeof value === 'boolean') gambling[key] = value;
    }
  }

  const legacyGambling = pick(top.gamblingEnabled, mod.gamblingEnabled);
  if (typeof legacyGambling === 'boolean' && !legacyGambling) {
    for (const key of ['coinflip', 'slots', 'roulette', 'blackjack', 'dice', 'crash', 'rps']) {
      if (gambling[key] === undefined) gambling[key] = false;
    }
  }

  const dailyAmount = num(pick(top.dailyAmount, mod.dailyAmount, daily?.min), 100);

  return {
    enabled: isModuleEnabled(settings, 'economy', bool(pick(top.enabled, mod.enabled), true)),
    currencyName: String(pick(top.currencyName, mod.currencyName) || 'coins'),
    currencyEmoji: String(pick(top.currencyEmoji, top.currency, mod.currencyEmoji, mod.currency) || '💰'),
    startingBalance: Math.max(0, num(pick(top.startingBalance, mod.startingBalance), 0)),
    dailyAmount: Math.max(0, dailyAmount),
    dailyStreakBonus: Math.max(0, num(pick(top.dailyStreakBonus, mod.dailyStreakBonus), 10)),
    maxStreakBonus: Math.max(0, num(pick(top.maxStreakBonus, mod.maxStreakBonus), 7)),
    workMinReward: Math.max(0, num(pick(top.workMinReward, mod.workMinReward), 50)),
    workMaxReward: Math.max(0, num(pick(top.workMaxReward, mod.workMaxReward), 200)),
    workCooldown: Math.max(0, num(pick(top.workCooldown, mod.workCooldown), 3600)),
    bankEnabled: bool(pick(top.bankEnabled, mod.bankEnabled), true),
    bankInterest: Math.max(0, num(pick(top.bankInterest, mod.bankInterest), 0)),
    robEnabled: bool(pick(top.robEnabled, mod.robEnabled), true),
    minBet: Math.max(1, num(pick(top.minBet, mod.minBet), 10)),
    maxBet: Math.max(1, num(pick(top.maxBet, mod.maxBet), 10000)),
    gambling,
  };
}

export function gameAllowed(economy: EconomyConfig, game: string): boolean {
  return economy.gambling[game] !== false;
}

export interface TempChannelsConfig {
  enabled: boolean;
  hubChannel: string;
  category: string;
  nameFormat: string;
  bitrate: number;
  userLimit: number;
}

export function resolveTempChannels(settings: any): TempChannelsConfig {
  const top = settings?.tempChannels && typeof settings.tempChannels === 'object' ? settings.tempChannels : {};
  const mod = getModuleConfig(settings, 'tempChannels');

  return {
    enabled: isModuleEnabled(settings, 'tempChannels', bool(pick(top.enabled, mod.enabled), false)),
    hubChannel: String(pick(top.hubChannel, top.triggerChannel, mod.hubChannel, mod.triggerChannel) || ''),
    category: String(pick(top.category, mod.category) || ''),
    nameFormat: String(pick(top.nameFormat, top.defaultName, mod.nameFormat, mod.defaultName) || "{user}'s Channel"),
    bitrate: Math.max(8000, num(pick(top.bitrate, mod.bitrate, top.defaultBitrate, mod.defaultBitrate), 64000)),
    userLimit: Math.max(0, num(pick(top.userLimit, mod.userLimit, top.defaultUserLimit, mod.defaultUserLimit), 0)),
  };
}

export interface ModerationConfig {
  muteRole: string;
  jailRole: string;
  appealsChannel: string;
}

export function resolveModeration(settings: any): ModerationConfig {
  const top = settings?.moderation && typeof settings.moderation === 'object' ? settings.moderation : {};
  const mod = getModuleConfig(settings, 'moderation');

  return {
    muteRole: String(pick(top.muteRole, mod.muteRole) || ''),
    jailRole: String(pick(top.jailRole, mod.jailRole) || ''),
    appealsChannel: String(pick(top.appealsChannel, mod.appealsChannel) || ''),
  };
}

export interface SuggestionsConfig {
  enabled: boolean;
  channel: string;
  upvoteEmoji: string;
  downvoteEmoji: string;
  autoThread: boolean;
  anonymousAllowed: boolean;
}

export function resolveSuggestions(settings: any): SuggestionsConfig {
  const top = settings?.suggestions && typeof settings.suggestions === 'object' ? settings.suggestions : {};
  const mod = getModuleConfig(settings, 'suggestions');

  return {
    enabled: isModuleEnabled(settings, 'suggestions', bool(pick(top.enabled, mod.enabled), false)),
    channel: String(pick(top.channel, mod.channel) || ''),
    upvoteEmoji: String(pick(top.upvoteEmoji, mod.upvoteEmoji) || '👍'),
    downvoteEmoji: String(pick(top.downvoteEmoji, mod.downvoteEmoji) || '👎'),
    autoThread: bool(pick(top.autoThread, mod.autoThread), false),
    anonymousAllowed: bool(pick(top.anonymousAllowed, mod.anonymousAllowed), false),
  };
}

export interface AppealInfoConfig {
  enabled: boolean;
  instructions: string;
  formUrl: string;
  contactEmail: string;
}

export function resolveAppealInfo(settings: any): AppealInfoConfig {
  const top = settings?.appealInfo && typeof settings.appealInfo === 'object' ? settings.appealInfo : {};

  return {
    enabled: bool(top.enabled, false),
    instructions: String(top.instructions || ''),
    formUrl: String(top.formUrl || ''),
    contactEmail: String(top.contactEmail || ''),
  };
}

export interface RemindersConfig {
  maxPerUser: number;
  maxDurationDays: number;
}

export function resolveReminders(settings: any): RemindersConfig {
  const top = settings?.reminders && typeof settings.reminders === 'object' ? settings.reminders : {};

  return {
    maxPerUser: Math.max(1, num(top.maxPerUser, 25)),
    maxDurationDays: Math.max(1, num(top.maxDuration, 365)),
  };
}

export interface GiveawaysConfig {
  enabled: boolean;
  channel: string;
  emoji: string;
  color: string;
  managerRole: string;
  requireRole: string;
  dmWinners: boolean;
}

export function resolveGiveaways(settings: any): GiveawaysConfig {
  const top = settings?.giveaways && typeof settings.giveaways === 'object' ? settings.giveaways : {};
  const mod = getModuleConfig(settings, 'giveaways');

  return {
    enabled: isModuleEnabled(settings, 'giveaways', bool(pick(top.enabled, mod.enabled), true)),
    channel: String(pick(top.channel, mod.channel) || ''),
    emoji: String(pick(top.emoji, mod.emoji) || '🎉'),
    color: String(pick(top.color, mod.color) || '#E3C766'),
    managerRole: String(pick(top.managerRole, mod.managerRole) || ''),
    requireRole: String(pick(top.requireRole, mod.requireRole) || ''),
    dmWinners: bool(pick(top.dmWinners, mod.dmWinners), false),
  };
}
