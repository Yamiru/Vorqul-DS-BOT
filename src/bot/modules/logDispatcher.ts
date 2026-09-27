/*!
 * Vorqul DS BOT - Log Dispatcher
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Guild, EmbedBuilder, TextChannel } from 'discord.js';
import { GuildSettings } from '../../utils/models.js';
import { resolveLogging } from '../../shared/featureConfig.js';

export type LogCategory =
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
  | 'boosts';

const FALLBACKS: Record<LogCategory, LogCategory[]> = {
  messages: ['server'],
  members: ['server'],
  moderation: ['members', 'server'],
  voice: ['server'],
  server: [],
  roles: ['server'],
  channels: ['server'],
  invites: ['server'],
  threads: ['channels', 'server'],
  emojis: ['server'],
  boosts: ['members', 'server'],
};

export function resolveLogChannel(
  guild: Guild,
  settings: any,
  category: LogCategory
): TextChannel | null {
  const logs = resolveLogging(settings);
  if (!logs.enabled) return null;

  const channels = logs.channels;
  const chain: LogCategory[] = [category, ...(FALLBACKS[category] || [])];

  for (const key of chain) {
    const id = channels[key];
    if (!id) continue;
    const channel = guild.channels.cache.get(id) as TextChannel | undefined;
    if (channel && typeof channel.send === 'function') return channel;
  }

  return null;
}

export function isEventEnabled(settings: any, eventKey: string): boolean {
  const events = resolveLogging(settings).events;
  return events[eventKey] !== false;
}

export function isChannelIgnored(settings: any, channelId?: string | null): boolean {
  if (!channelId) return false;
  return resolveLogging(settings).blacklistChannels.includes(channelId);
}

export async function sendLog(
  guild: Guild,
  category: LogCategory,
  eventKey: string,
  embed: EmbedBuilder,
  options?: { sourceChannelId?: string | null }
): Promise<boolean> {
  try {
    const settings = await GuildSettings.findOne({ guildId: guild.id });
    if (!settings) return false;
    if (!isEventEnabled(settings, eventKey)) return false;
    if (isChannelIgnored(settings, options?.sourceChannelId)) return false;

    const channel = resolveLogChannel(guild, settings, category);
    if (!channel) return false;

    await channel.send({ embeds: [embed] });
    return true;
  } catch {
    return false;
  }
}

export function logEmbed(title: string, color: number): EmbedBuilder {
  return new EmbedBuilder().setTitle(title).setColor(color).setTimestamp();
}

export const LOG_COLORS = {
  create: 0x57f287,
  update: 0xfee75c,
  delete: 0xed4245,
  info: 0x5865f2,
  boost: 0xf47fff,
} as const;
