/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Events, Message, TextChannel, EmbedBuilder } from 'discord.js';
import { GuildSettings } from '../../utils/models.js';
import { featureAllowed } from '../modules/channelGuard.js';
import type { Event } from '../types.js';
import { logger } from '../../utils/logger.js';
import { suppress } from '../../utils/suppress.js';

export interface StickyConfig {
  channelId: string;
  content: string;
  useEmbed?: boolean;
  title?: string;
  color?: string;
}

const lastStickyId = new Map<string, string>();

const timers = new Map<string, NodeJS.Timeout>();

const posting = new Set<string>();

const REPOST_DELAY_MS = 2500;

export function getStickyConfig(settings: any, channelId: string): StickyConfig | null {
  const list = settings?.sticky;
  if (!Array.isArray(list)) return null;
  return list.find((s: StickyConfig) => s && s.channelId === channelId) || null;
}

export async function postSticky(channel: TextChannel, cfg: StickyConfig): Promise<void> {
  if (!cfg || !cfg.content || posting.has(channel.id)) return;
  posting.add(channel.id);
  try {
    const prevId = lastStickyId.get(channel.id);
    if (prevId) {
      try {
        const prev = await channel.messages.fetch(prevId);
        await prev.delete();
      } catch (error) {
          logger.debug('stickyMessage: suppressed error', error);
        }
    }

    let sent;
    if (cfg.useEmbed) {
      const embed = new EmbedBuilder().setDescription(cfg.content);
      if (cfg.title) embed.setTitle(cfg.title);
      const parsed = cfg.color ? parseInt(cfg.color.replace('#', ''), 16) : 0x5865f2;
      embed.setColor(Number.isNaN(parsed) ? 0x5865f2 : parsed);
      sent = await channel.send({ embeds: [embed] });
    } else {
      sent = await channel.send({ content: cfg.content });
    }
    lastStickyId.set(channel.id, sent.id);
  } finally {
    posting.delete(channel.id);
  }
}

export async function removeSticky(channel: TextChannel): Promise<void> {
  const prevId = lastStickyId.get(channel.id);
  if (prevId) {
    try {
      const prev = await channel.messages.fetch(prevId);
      await prev.delete();
    } catch (error) {
        logger.debug('stickyMessage: suppressed error', error);
      }
  }
  lastStickyId.delete(channel.id);
  const t = timers.get(channel.id);
  if (t) { clearTimeout(t); timers.delete(channel.id); }
}

const event: Event<typeof Events.MessageCreate> = {
  name: Events.MessageCreate,
  execute: async (client: Client, message: Message) => {
    if (!message.guild) return;

    if (message.author.id === client.user?.id) return;

    const channel = message.channel as TextChannel;
    if (!channel || typeof channel.send !== 'function') return;

    try {
      const settings = await GuildSettings.findOne({ guildId: message.guild.id });
      const cfg = getStickyConfig(settings, channel.id);
      if (!cfg || !cfg.content) return;
      if (!featureAllowed(settings, 'sticky', channel)) return;

      const existing = timers.get(channel.id);
      if (existing) clearTimeout(existing);
      timers.set(channel.id, setTimeout(() => {
        timers.delete(channel.id);
        postSticky(channel, cfg).catch(suppress('stickyMessage'));
      }, REPOST_DELAY_MS));
    } catch (error) {
        logger.debug('stickyMessage: suppressed error', error);
      }
  }
};

export default event;
