/*!
 * Vorqul DS BOT - Starboard Core
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import {
  EmbedBuilder,
  TextChannel,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
} from 'discord.js';
import { StarboardMessage } from '../../utils/models.js';
import { featureAllowed } from './channelGuard.js';
import { logger } from '../../utils/logger.js';

export interface StarboardConfig {
  enabled: boolean;
  channelId: string;
  emoji: string;
  threshold: number;
  selfStar: boolean;
  ignoredChannels: string[];
}

export function resolveStarboardConfig(settings: any): StarboardConfig | null {
  const top = settings?.starboard || {};
  const mod = settings?.modules?.starboard || {};

  const enabled = top.enabled ?? mod.enabled ?? false;
  if (!enabled) return null;

  const channelId = top.channelId || top.channel || mod.channel || mod.channelId || '';
  if (!channelId) return null;

  return {
    enabled: true,
    channelId,
    emoji: top.emoji || mod.emoji || '⭐',
    threshold: Number(top.threshold ?? mod.threshold ?? 3) || 3,
    selfStar: Boolean(top.selfStar ?? mod.selfStar ?? false),
    ignoredChannels: [
      ...(Array.isArray(top.ignoredChannels) ? top.ignoredChannels : []),
      ...(Array.isArray(mod.ignoredChannels) ? mod.ignoredChannels : []),
    ],
  };
}

function emojiMatches(reaction: MessageReaction | PartialMessageReaction, wanted: string): boolean {
  const name = reaction.emoji.name || '';
  const full = reaction.emoji.toString();
  return name === wanted || full === wanted || full.includes(wanted);
}

function buildEmbed(message: any, emoji: string, count: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: message.author?.tag || message.author?.username || 'Neznámy',
      iconURL: message.author?.displayAvatarURL?.(),
    })
    .setDescription(message.content || '*Bez textu*')
    .addFields(
      { name: 'Zdroj', value: `[Prejsť na správu](${message.url})`, inline: true },
      { name: 'Kanál', value: `<#${message.channelId}>`, inline: true }
    )
    .setColor(0xffd700)
    .setTimestamp(message.createdAt)
    .setFooter({ text: `${emoji} ${count}` });

  const attachment = message.attachments?.first?.();
  if (attachment?.contentType?.startsWith('image/')) {
    embed.setImage(attachment.url);
  } else {
    const embedImage = message.embeds?.[0]?.image?.url || message.embeds?.[0]?.thumbnail?.url;
    if (embedImage) embed.setImage(embedImage);
  }

  return embed;
}

export async function handleStarboardReaction(
  settings: any,
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return;
    }
  }

  const message: any = reaction.message;
  if (!message.guild || user.bot) return;

  const cfg = resolveStarboardConfig(settings);
  if (!cfg) return;

  if (!emojiMatches(reaction, cfg.emoji)) return;

  if (message.channelId === cfg.channelId) return;

  if (cfg.ignoredChannels.includes(message.channelId)) return;
  if (!featureAllowed(settings, 'starboard', message.channel)) return;
  if (!cfg.selfStar && message.author?.id === user.id) return;

  const starboardChannel = message.guild.channels.cache.get(cfg.channelId) as TextChannel | undefined;
  if (!starboardChannel || typeof starboardChannel.send !== 'function') return;

  const guildId = message.guild.id;
  const starCount = reaction.count || 0;

  const existing: any = await StarboardMessage.findOne({
    guildId,
    originalMessageId: message.id,
  });
  const existingId: string | undefined = existing?.starboard_message_id;

  if (starCount >= cfg.threshold) {
    const embed = buildEmbed(message, cfg.emoji, starCount);
    const content = `${cfg.emoji} **${starCount}** | <#${message.channelId}>`;

    if (existingId) {
      try {
        const starboardMsg = await starboardChannel.messages.fetch(existingId);
        await starboardMsg.edit({ content, embeds: [embed] });
        await StarboardMessage.findOneAndUpdate(
          { guildId, originalMessageId: message.id },
          { $set: { stars: starCount } }
        );
        return;
      } catch {
        await StarboardMessage.findOneAndDelete({ guildId, originalMessageId: message.id });
      }
    }

    const created = await starboardChannel.send({ content, embeds: [embed] });
    await StarboardMessage.create({
      guildId,
      originalMessageId: message.id,
      starboardMessageId: created.id,
      channelId: message.channelId,
      authorId: message.author?.id || 'unknown',
      stars: starCount,
      starredBy: [],
    });
    return;
  }

  if (existingId) {
    try {
      const starboardMsg = await starboardChannel.messages.fetch(existingId);
      await starboardMsg.delete();
    } catch (error) {
        logger.debug('starboardCore: suppressed error', error);
      }
    await StarboardMessage.findOneAndDelete({ guildId, originalMessageId: message.id });
  }
}
