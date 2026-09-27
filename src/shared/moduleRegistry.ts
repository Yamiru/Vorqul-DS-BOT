/*!
 * Vorqul DS BOT - Module Registry (shared)
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
export interface ModuleDefinition {
  key: string;
  label: string;
  emoji: string;
  group: string;
  description: string;

  defaultEnabled: boolean;

  configPath?: string;
}

export const MODULE_GROUPS = [
  'modules.group.security',
  'modules.group.members',
  'modules.group.engagement',
  'modules.group.economy',
  'modules.group.content',
  'modules.group.tools',
] as const;

export const MODULES: ModuleDefinition[] = [
  { key: 'moderation', label: 'modules.moderation.label', emoji: '🛡️', group: 'modules.group.security',
    description: 'modules.moderation.description', defaultEnabled: true },
  { key: 'automod', label: 'modules.automod.label', emoji: '🤖', group: 'modules.group.security',
    description: 'modules.automod.description', defaultEnabled: false, configPath: 'automod' },
  { key: 'antinuke', label: 'modules.antinuke.label', emoji: '💣', group: 'modules.group.security',
    description: 'modules.antinuke.description', defaultEnabled: false },
  { key: 'antiRaid', label: 'modules.antiRaid.label', emoji: '🚨', group: 'modules.group.security',
    description: 'modules.antiRaid.description', defaultEnabled: false },
  { key: 'logs', label: 'modules.logs.label', emoji: '📝', group: 'modules.group.security',
    description: 'modules.logs.description', defaultEnabled: false, configPath: 'logs' },
  { key: 'appeals', label: 'modules.appeals.label', emoji: '⚖️', group: 'modules.group.security',
    description: 'modules.appeals.description', defaultEnabled: false },
  { key: 'verification', label: 'modules.verification.label', emoji: '✅', group: 'modules.group.security',
    description: 'modules.verification.description', defaultEnabled: false, configPath: 'verification' },

  { key: 'welcome', label: 'modules.welcome.label', emoji: '👋', group: 'modules.group.members',
    description: 'modules.welcome.description', defaultEnabled: false, configPath: 'welcome' },
  { key: 'goodbye', label: 'modules.goodbye.label', emoji: '🚪', group: 'modules.group.members',
    description: 'modules.goodbye.description', defaultEnabled: false, configPath: 'welcome' },
  { key: 'joinRoles', label: 'modules.joinRoles.label', emoji: '🎭', group: 'modules.group.members',
    description: 'modules.joinRoles.description', defaultEnabled: false },
  { key: 'reactionroles', label: 'modules.reactionroles.label', emoji: '🎯', group: 'modules.group.members',
    description: 'modules.reactionroles.description', defaultEnabled: false, configPath: 'reactionroles' },
  { key: 'persist', label: 'modules.persist.label', emoji: '💾', group: 'modules.group.members',
    description: 'modules.persist.description', defaultEnabled: false },
  { key: 'invites', label: 'modules.invites.label', emoji: '🔗', group: 'modules.group.members',
    description: 'modules.invites.description', defaultEnabled: false },
  { key: 'namehistory', label: 'modules.namehistory.label', emoji: '📇', group: 'modules.group.members',
    description: 'modules.namehistory.description', defaultEnabled: false },

  { key: 'leveling', label: 'modules.leveling.label', emoji: '⭐', group: 'modules.group.engagement',
    description: 'modules.leveling.description', defaultEnabled: true, configPath: 'leveling' },
  { key: 'starboard', label: 'modules.starboard.label', emoji: '🌟', group: 'modules.group.engagement',
    description: 'modules.starboard.description', defaultEnabled: false, configPath: 'starboard' },
  { key: 'suggestions', label: 'modules.suggestions.label', emoji: '💡', group: 'modules.group.engagement',
    description: 'modules.suggestions.description', defaultEnabled: false, configPath: 'suggestions' },
  { key: 'reputation', label: 'modules.reputation.label', emoji: '🏅', group: 'modules.group.engagement',
    description: 'modules.reputation.description', defaultEnabled: false },
  { key: 'counting', label: 'modules.counting.label', emoji: '🔢', group: 'modules.group.engagement',
    description: 'modules.counting.description', defaultEnabled: false },
  { key: 'birthday', label: 'modules.birthday.label', emoji: '🎂', group: 'modules.group.engagement',
    description: 'modules.birthday.description', defaultEnabled: false },
  { key: 'confessions', label: 'modules.confessions.label', emoji: '🤫', group: 'modules.group.engagement',
    description: 'modules.confessions.description', defaultEnabled: false },
  { key: 'afk', label: 'modules.afk.label', emoji: '💤', group: 'modules.group.engagement',
    description: 'modules.afk.description', defaultEnabled: true },
  { key: 'polls', label: 'modules.polls.label', emoji: '📊', group: 'modules.group.engagement',
    description: 'modules.polls.description', defaultEnabled: true },

  { key: 'economy', label: 'modules.economy.label', emoji: '💰', group: 'modules.group.economy',
    description: 'modules.economy.description', defaultEnabled: true, configPath: 'economy' },
  { key: 'games', label: 'modules.games.label', emoji: '🎮', group: 'modules.group.economy',
    description: 'modules.games.description', defaultEnabled: true, configPath: 'games' },
  { key: 'giveaways', label: 'modules.giveaways.label', emoji: '🎉', group: 'modules.group.economy',
    description: 'modules.giveaways.description', defaultEnabled: true, configPath: 'giveaways' },
  { key: 'quests', label: 'modules.quests.label', emoji: '📜', group: 'modules.group.economy',
    description: 'modules.quests.description', defaultEnabled: false },
  { key: 'streaks', label: 'modules.streaks.label', emoji: '🔥', group: 'modules.group.economy',
    description: 'modules.streaks.description', defaultEnabled: false },

  { key: 'tickets', label: 'modules.tickets.label', emoji: '🎫', group: 'modules.group.content',
    description: 'modules.tickets.description', defaultEnabled: false, configPath: 'tickets' },
  { key: 'applications', label: 'modules.applications.label', emoji: '📋', group: 'modules.group.content',
    description: 'modules.applications.description', defaultEnabled: false, configPath: 'applications' },
  { key: 'autoResponse', label: 'modules.autoResponse.label', emoji: '💬', group: 'modules.group.content',
    description: 'modules.autoResponse.description', defaultEnabled: false, configPath: 'autoresponse' },
  { key: 'sticky', label: 'modules.sticky.label', emoji: '📌', group: 'modules.group.content',
    description: 'modules.sticky.description', defaultEnabled: false },
  { key: 'tags', label: 'modules.tags.label', emoji: '🏷️', group: 'modules.group.content',
    description: 'modules.tags.description', defaultEnabled: false, configPath: 'tags' },
  { key: 'feeds', label: 'modules.feeds.label', emoji: '📰', group: 'modules.group.content',
    description: 'modules.feeds.description', defaultEnabled: false, configPath: 'feeds' },
  { key: 'socials', label: 'modules.socials.label', emoji: '🌐', group: 'modules.group.content',
    description: 'modules.socials.description', defaultEnabled: false, configPath: 'social' },
  { key: 'reminders', label: 'modules.reminders.label', emoji: '⏰', group: 'modules.group.content',
    description: 'modules.reminders.description', defaultEnabled: true, configPath: 'reminders' },

  { key: 'tempChannels', label: 'modules.tempChannels.label', emoji: '🔊', group: 'modules.group.tools',
    description: 'modules.tempChannels.description', defaultEnabled: false, configPath: 'tempchannels' },
  { key: 'voiceStats', label: 'modules.voiceStats.label', emoji: '🎙️', group: 'modules.group.tools',
    description: 'modules.voiceStats.description', defaultEnabled: false },
  { key: 'messageStats', label: 'modules.messageStats.label', emoji: '📈', group: 'modules.group.tools',
    description: 'modules.messageStats.description', defaultEnabled: false },
  { key: 'serverStatus', label: 'modules.serverStatus.label', emoji: '🖥️', group: 'modules.group.tools',
    description: 'modules.serverStatus.description', defaultEnabled: false },
  { key: 'crypto', label: 'modules.crypto.label', emoji: '₿', group: 'modules.group.tools',
    description: 'modules.crypto.description', defaultEnabled: false, configPath: 'crypto' },
  { key: 'backup', label: 'modules.backup.label', emoji: '📦', group: 'modules.group.tools',
    description: 'modules.backup.description', defaultEnabled: false, configPath: 'backup' },
  { key: 'webhooks', label: 'modules.webhooks.label', emoji: '🪝', group: 'modules.group.tools',
    description: 'modules.webhooks.description', defaultEnabled: false, configPath: 'webhooks' },
  { key: 'prefixCommands', label: 'modules.prefixCommands.label', emoji: '⌨️', group: 'modules.group.tools',
    description: 'modules.prefixCommands.description', defaultEnabled: true },
];

export function getModule(key: string): ModuleDefinition | undefined {
  return MODULES.find((m) => m.key === key);
}

export const MODULE_KEYS: string[] = MODULES.map((m) => m.key);

export function defaultModuleState(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const module of MODULES) out[module.key] = module.defaultEnabled;
  return out;
}
