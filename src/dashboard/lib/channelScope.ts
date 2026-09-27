/*!
 * Vorqul DS BOT - Channel Scope (dashboard)
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
export type {
  ScopeMode,
  ChannelScope,
  ChannelScopeMap,
  FeatureDefinition,
} from '../../shared/channelScopeRegistry';
export {
  GLOBAL_SCOPE_KEY,
  COMMANDS_SCOPE_KEY,
  DEFAULT_SCOPE,
  FEATURE_GROUPS,
  FEATURES,
  FEATURE_KEYS,
  getFeatureDefinition,
  normalizeScope,
  sanitizeScopeMap,
} from '../../shared/channelScopeRegistry';
export { moduleEnabled } from '../../shared/settingsSchema';

import type { ChannelScope } from '../../shared/channelScopeRegistry';

export function describeScope(
  scope: ChannelScope,
  nameOf: (id: string) => string,
  t: (key: string) => string
): string {
  if (scope.mode === 'all') return t('scope.all');
  const list = scope.channels.map(nameOf).join(', ');
  return (scope.mode === 'only' ? t('scope.onlyPrefix') : t('scope.exceptPrefix')) + list;
}
