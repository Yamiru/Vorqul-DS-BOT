/*!
 * Vorqul DS BOT - Channel Scope Registry (shared)
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { GAMES } from './gameRegistry.js';

export type ScopeMode = 'all' | 'only' | 'except';

export interface ChannelScope {
  mode: ScopeMode;
  channels: string[];
}

export interface ChannelScopeMap {
  [featureKey: string]: ChannelScope | undefined;
}

export interface FeatureDefinition {
  key: string;
  label: string;
  group: string;

  channelType: 'text' | 'voice' | 'any';
  description: string;
  emoji?: string;
}

export const GLOBAL_SCOPE_KEY = '__global';
export const COMMANDS_SCOPE_KEY = '__commands';

export const DEFAULT_SCOPE: ChannelScope = { mode: 'all', channels: [] };

export const FEATURE_GROUPS = [
  'scopeGroup.global',
  'scopeGroup.chat',
  'scopeGroup.moderation',
  'scopeGroup.fun',
  'scopeGroup.voice',
  'scopeGroup.logs',
  'scopeGroup.commands',
] as const;

const GAME_FEATURES: FeatureDefinition[] = GAMES.map((game) => ({
  key: `games.${game.key}`,
  label: game.label,
  emoji: game.emoji,
  group: 'scopeGroup.fun',
  channelType: 'text' as const,
  description: 'scope.feature.gameScope.description',
}));

export const FEATURES: FeatureDefinition[] = [
  { key: GLOBAL_SCOPE_KEY, label: 'scope.feature.global.label', group: 'scopeGroup.global', channelType: 'any',
    description: 'scope.feature.global.description' },
  { key: COMMANDS_SCOPE_KEY, label: 'scope.feature.commands.label', group: 'scopeGroup.global', channelType: 'text',
    description: 'scope.feature.commands.description' },

  { key: 'leveling', label: 'scope.feature.leveling.label', group: 'scopeGroup.chat', channelType: 'text',
    description: 'scope.feature.leveling.description' },
  { key: 'economy', label: 'scope.feature.economy.label', group: 'scopeGroup.chat', channelType: 'text',
    description: 'scope.feature.economy.description' },
  { key: 'messageStats', label: 'scope.feature.messageStats.label', group: 'scopeGroup.chat', channelType: 'text',
    description: 'scope.feature.messageStats.description' },
  { key: 'autoResponse', label: 'scope.feature.autoResponse.label', group: 'scopeGroup.chat', channelType: 'text',
    description: 'scope.feature.autoResponse.description' },
  { key: 'afk', label: 'scope.feature.afk.label', group: 'scopeGroup.chat', channelType: 'text',
    description: 'scope.feature.afk.description' },
  { key: 'sticky', label: 'scope.feature.sticky.label', group: 'scopeGroup.chat', channelType: 'text',
    description: 'scope.feature.sticky.description' },
  { key: 'reputation', label: 'scope.feature.reputation.label', group: 'scopeGroup.chat', channelType: 'text',
    description: 'scope.feature.reputation.description' },
  { key: 'confessions', label: 'scope.feature.confessions.label', group: 'scopeGroup.chat', channelType: 'text',
    description: 'scope.feature.confessions.description' },
  { key: 'suggestions', label: 'scope.feature.suggestions.label', group: 'scopeGroup.chat', channelType: 'text',
    description: 'scope.feature.suggestions.description' },
  { key: 'birthday', label: 'scope.feature.birthday.label', group: 'scopeGroup.chat', channelType: 'text',
    description: 'scope.feature.birthday.description' },

  { key: 'automod', label: 'scope.feature.automod.label', group: 'scopeGroup.moderation', channelType: 'text',
    description: 'scope.feature.automod.description' },
  { key: 'filter', label: 'scope.feature.filter.label', group: 'scopeGroup.moderation', channelType: 'text',
    description: 'scope.feature.filter.description' },
  { key: 'antiAd', label: 'scope.feature.antiAd.label', group: 'scopeGroup.moderation', channelType: 'text',
    description: 'scope.feature.antiAd.description' },
  { key: 'antiRaid', label: 'scope.feature.antiRaid.label', group: 'scopeGroup.moderation', channelType: 'text',
    description: 'scope.feature.antiRaid.description' },

  { key: 'counting', label: 'scope.feature.counting.label', group: 'scopeGroup.fun', channelType: 'text',
    description: 'scope.feature.counting.description' },
  { key: 'starboard', label: 'scope.feature.starboard.label', group: 'scopeGroup.fun', channelType: 'text',
    description: 'scope.feature.starboard.description' },
  ...GAME_FEATURES,
  { key: 'giveaways', label: 'scope.feature.giveaways.label', group: 'scopeGroup.fun', channelType: 'text',
    description: 'scope.feature.giveaways.description' },
  { key: 'polls', label: 'scope.feature.polls.label', group: 'scopeGroup.fun', channelType: 'text',
    description: 'scope.feature.polls.description' },
  { key: 'games', label: 'scope.feature.games.label', group: 'scopeGroup.fun', channelType: 'text',
    description: 'scope.feature.games.description' },

  { key: 'voiceStats', label: 'scope.feature.voiceStats.label', group: 'scopeGroup.voice', channelType: 'voice',
    description: 'scope.feature.voiceStats.description' },
  { key: 'tempChannels', label: 'scope.feature.tempChannels.label', group: 'scopeGroup.voice', channelType: 'voice',
    description: 'scope.feature.tempChannels.description' },

  { key: 'logs', label: 'scope.feature.logs.label', group: 'scopeGroup.logs', channelType: 'any',
    description: 'scope.feature.logs.description' },

  { key: 'commands.admin', label: 'scope.feature.commands.admin.label', group: 'scopeGroup.commands', channelType: 'text',
    description: 'scope.feature.commands.admin.description' },
  { key: 'commands.moderation', label: 'scope.feature.commands.moderation.label', group: 'scopeGroup.commands', channelType: 'text',
    description: 'scope.feature.commands.moderation.description' },
  { key: 'commands.economy', label: 'scope.feature.commands.economy.label', group: 'scopeGroup.commands', channelType: 'text',
    description: 'scope.feature.commands.economy.description' },
  { key: 'commands.fun', label: 'scope.feature.commands.fun.label', group: 'scopeGroup.commands', channelType: 'text',
    description: 'scope.feature.commands.fun.description' },
  { key: 'commands.utility', label: 'scope.feature.commands.utility.label', group: 'scopeGroup.commands', channelType: 'text',
    description: 'scope.feature.commands.utility.description' },
];

export const FEATURE_KEYS: string[] = FEATURES.map((f) => f.key);

export function getFeatureDefinition(key: string): FeatureDefinition | undefined {
  return FEATURES.find((f) => f.key === key);
}

export function normalizeScope(raw: any): ChannelScope {
  if (!raw || typeof raw !== 'object') return { mode: 'all', channels: [] };

  const channels: string[] = Array.isArray(raw.channels)
    ? raw.channels.filter((c: any) => typeof c === 'string' && c.length > 0)
    : [];

  let mode: ScopeMode = 'all';
  if (raw.mode === 'only' || raw.mode === 'except') mode = raw.mode;

  if (mode === 'only' && channels.length === 0) mode = 'all';

  return { mode, channels };
}

export function sanitizeScopeMap(raw: any): Record<string, ChannelScope> {
  const out: Record<string, ChannelScope> = {};
  if (!raw || typeof raw !== 'object') return out;

  const known = new Set(FEATURE_KEYS);

  for (const [key, value] of Object.entries(raw)) {
    if (!known.has(key)) continue;
    const scope = normalizeScope(value);
    if (scope.mode === 'all') continue;
    out[key] = scope;
  }
  return out;
}
