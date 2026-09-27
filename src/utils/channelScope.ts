/*!
 * Vorqul DS BOT - Channel Scope Engine
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import {
  FEATURES,
  FEATURE_GROUPS,
  FEATURE_KEYS,
  GLOBAL_SCOPE_KEY,
  COMMANDS_SCOPE_KEY,
  DEFAULT_SCOPE,
  getFeatureDefinition,
  normalizeScope,
  sanitizeScopeMap,
} from '../shared/channelScopeRegistry.js';
import {
  isModuleEnabled as sharedIsModuleEnabled,
  getModuleConfig as sharedGetModuleConfig,
} from '../shared/settingsSchema.js';
import { i18n } from './i18n.js';
import type {
  ChannelScope,
  ChannelScopeMap,
  FeatureDefinition,
  ScopeMode,
} from '../shared/channelScopeRegistry.js';

export type { ChannelScope, ChannelScopeMap, FeatureDefinition, ScopeMode };
export {
  FEATURES,
  FEATURE_GROUPS,
  FEATURE_KEYS,
  GLOBAL_SCOPE_KEY,
  COMMANDS_SCOPE_KEY,
  DEFAULT_SCOPE,
  getFeatureDefinition,
  normalizeScope,
  sanitizeScopeMap,
};

const LEGACY_BLACKLIST_PATHS: Record<string, string[][]> = {
  leveling: [['leveling', 'blacklistChannels'], ['modules', 'leveling', 'blacklistChannels']],
  economy: [['economy', 'blacklistChannels'], ['modules', 'economy', 'blacklistChannels']],
  automod: [['automod', 'ignoredChannels'], ['modules', 'automod', 'ignoredChannels']],
  starboard: [['starboard', 'ignoredChannels'], ['modules', 'starboard', 'ignoredChannels']],
  afk: [['afk', 'ignoredChannels'], ['modules', 'afk', 'ignoredChannels']],
  logs: [['logs', 'blacklistChannels'], ['modules', 'logs', 'blacklistChannels']],
  messageStats: [['modules', 'messageStats', 'blacklistChannels']],
  voiceStats: [['modules', 'voiceStats', 'blacklistChannels']],
  antiAd: [['modules', 'antiAd', 'whitelistChannels']],
};

function readPath(source: any, path: string[]): any {
  let cur = source;
  for (const part of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

function legacyBlacklist(settings: any, feature: string): string[] {
  const paths = LEGACY_BLACKLIST_PATHS[feature];
  if (!paths) return [];
  const out: string[] = [];
  for (const path of paths) {
    const value = readPath(settings, path);
    if (Array.isArray(value)) {
      for (const id of value) if (typeof id === 'string' && id) out.push(id);
    }
  }
  return out;
}

export function getScopeMap(settings: any): ChannelScopeMap {
  const raw = settings?.channelScopes;
  if (!raw || typeof raw !== 'object') return {};
  const out: ChannelScopeMap = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = normalizeScope(value);
  }
  return out;
}

export function getScope(settings: any, feature: string): ChannelScope {
  const map = getScopeMap(settings);
  return map[feature] || { ...DEFAULT_SCOPE, channels: [] };
}

export function hasCustomScope(settings: any, feature: string): boolean {
  const scope = getScope(settings, feature);
  return scope.mode !== 'all';
}

export interface ChannelContext {
  channelId: string;

  parentIds?: (string | null | undefined)[];
}

function matchesScope(scope: ChannelScope, ctx: ChannelContext): boolean {
  if (scope.mode === 'all') return true;

  const ids = [ctx.channelId, ...(ctx.parentIds || [])].filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  );
  const listed = ids.some((id) => scope.channels.includes(id));

  return scope.mode === 'only' ? listed : !listed;
}

export function isAllowedInChannel(
  settings: any,
  feature: string,
  ctx: ChannelContext
): boolean {
  if (!ctx || !ctx.channelId) return true;

  const map = getScopeMap(settings);

  const own = map[feature];
  if (own && own.mode !== 'all') {
    return matchesScope(own, ctx);
  }

  const legacy = legacyBlacklist(settings, feature);
  if (legacy.length > 0) {
    const ids = [ctx.channelId, ...(ctx.parentIds || [])].filter(
      (id): id is string => typeof id === 'string' && id.length > 0
    );

    if (feature === 'antiAd') {
      if (ids.some((id) => legacy.includes(id))) return false;
    } else if (ids.some((id) => legacy.includes(id))) {
      return false;
    }
  }

  const global = map[GLOBAL_SCOPE_KEY];
  if (global && global.mode !== 'all') {
    return matchesScope(global, ctx);
  }

  return true;
}

export function isCommandAllowedInChannel(
  settings: any,
  commandName: string,
  category: string | undefined,
  ctx: ChannelContext
): boolean {
  if (!ctx || !ctx.channelId) return true;

  const rawCommandScopes = settings?.commandScopes;
  if (rawCommandScopes && typeof rawCommandScopes === 'object') {
    const own = normalizeScope(rawCommandScopes[commandName]);
    if (own.mode !== 'all') return matchesScope(own, ctx);
  }

  const map = getScopeMap(settings);

  if (category) {
    const catScope = map[`commands.${String(category).toLowerCase()}`];
    if (catScope && catScope.mode !== 'all') return matchesScope(catScope, ctx);
  }

  const allCommands = map[COMMANDS_SCOPE_KEY];
  if (allCommands && allCommands.mode !== 'all') return matchesScope(allCommands, ctx);

  const global = map[GLOBAL_SCOPE_KEY];
  if (global && global.mode !== 'all') return matchesScope(global, ctx);

  return true;
}

export function isModuleEnabled(settings: any, moduleKey: string, fallback = true): boolean {
  return sharedIsModuleEnabled(settings, moduleKey, fallback);
}

export function getModuleConfig(settings: any, moduleKey: string): Record<string, any> {
  return sharedGetModuleConfig(settings, moduleKey);
}

export function describeScope(scope: ChannelScope, guildId?: string): string {
  const normalized = normalizeScope(scope);
  if (normalized.mode === 'all') return i18n.t('scopeDesc.all', guildId);
  const list = normalized.channels.map((id) => `<#${id}>`).join(', ');
  return i18n.t(`scopeDesc.${normalized.mode}`, guildId, { list });
}
