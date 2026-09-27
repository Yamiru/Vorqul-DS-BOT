/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';
import { logger } from '../../../utils/logger.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('whatdidimiss')
    .setDescription('Get a summary of what happened while you were away')
    .addIntegerOption(opt =>
      opt
        .setName('hours')
        .setDescription('Hours to look back (default: 24)')
        .setMinValue(1)
        .setMaxValue(168)
        .setRequired(false)
    ),

  category: 'utility',
  guildOnly: true,
  cooldown: 30,

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const hours = interaction.options.getInteger('hours') || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const guild = interaction.guild!;

    const mentions: string[] = [];
    const highlights: string[] = [];
    const activeChannels = new Map<string, number>();
    const activeUsers = new Map<string, number>();

    const textChannels = guild.channels.cache.filter(
      c => c.isTextBased()
    );

    let totalMessages = 0;
    const maxChannelsToCheck = 10;
    let checkedChannels = 0;

    for (const [, channel] of textChannels) {
      if (checkedChannels >= maxChannelsToCheck) break;

      try {
        const textChannel = channel as TextChannel;

        if (!textChannel.permissionsFor(interaction.client.user!)?.has('ViewChannel')) continue;
        if (!textChannel.permissionsFor(interaction.client.user!)?.has('ReadMessageHistory')) continue;

        const messages = await textChannel.messages.fetch({ limit: 100 });
        const recentMessages = messages.filter(m => m.createdAt > since);

        for (const [, msg] of recentMessages) {
          totalMessages++;

          activeChannels.set(
            channel.id,
            (activeChannels.get(channel.id) || 0) + 1
          );

          if (!msg.author.bot) {
            activeUsers.set(
              msg.author.id,
              (activeUsers.get(msg.author.id) || 0) + 1
            );
          }

          if (msg.mentions.users.has(interaction.user.id)) {
            mentions.push(
              `[${msg.author.username}](${msg.url}): "${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}"`
            );
          }

          const totalReactions = msg.reactions.cache.reduce((sum, r) => sum + r.count, 0);
          if (totalReactions >= 5) {
            highlights.push(
              `[${msg.author.username}](${msg.url}) (${totalReactions} reactions): "${msg.content.substring(0, 40)}..."`
            );
          }
        }

        checkedChannels++;
      } catch (error) {
          logger.debug('whatdidimiss: suppressed error', error);
        }
    }

    const topChannels = [...activeChannels.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topUsers = [...activeUsers.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const embed = new EmbedBuilder()
      .setTitle(`📋 What You Missed (Last ${hours}h)`)
      .setColor(config.bot.embedColor as `#${string}`)
      .setDescription(`Here's a summary of server activity while you were away.`)
      .addFields(
        {
          name: '📊 Overview',
          value: [
            `**Total Messages:** ${totalMessages}`,
            `**Your Mentions:** ${mentions.length}`,
            `**Highlights:** ${highlights.length}`
          ].join('\n'),
          inline: false
        }
      )
      .setTimestamp();

    if (topChannels.length > 0) {
      embed.addFields({
        name: '🔥 Most Active Channels',
        value: topChannels.map(([id, count], i) =>
          `${i + 1}. <#${id}> (${count} messages)`
        ).join('\n'),
        inline: true
      });
    }

    if (topUsers.length > 0) {
      embed.addFields({
        name: '👥 Most Active Users',
        value: topUsers.map(([id, count], i) =>
          `${i + 1}. <@${id}> (${count} messages)`
        ).join('\n'),
        inline: true
      });
    }

    if (mentions.length > 0) {
      embed.addFields({
        name: `📢 Your Mentions (${Math.min(mentions.length, 5)})`,
        value: mentions.slice(0, 5).join('\n') || 'None',
        inline: false
      });
    }

    if (highlights.length > 0) {
      embed.addFields({
        name: `⭐ Popular Messages (${Math.min(highlights.length, 3)})`,
        value: highlights.slice(0, 3).join('\n') || 'None',
        inline: false
      });
    }

    if (totalMessages === 0) {
      embed.setDescription('🦗 It was pretty quiet here... Nothing much happened!');
    }

    await interaction.editReply({ embeds: [embed] });
  }
};

export default command;
