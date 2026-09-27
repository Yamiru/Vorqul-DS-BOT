/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder
} from 'discord.js';
import { UserData } from '../../../utils/models.js';
import { formatNumber, ordinal } from '../../../utils/helpers.js';
import { getDatabase } from '../../../utils/database.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View server leaderboards')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Leaderboard type')
        .setRequired(false)
        .addChoices(
          { name: 'XP / Levels', value: 'xp' },
          { name: 'Economy', value: 'economy' },
          { name: 'Messages', value: 'messages' }
        )
    ),

  category: 'utility',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const type = interaction.options.getString('type') || 'xp';

    await interaction.deferReply();

    if (type === 'messages') {
      const db = getDatabase();
      const rows = (await db.find('analytics_users', { guild_id: guildId })) as any[];
      const ranked = rows
        .map(r => ({ userId: r.user_id, messages: Number(r.messages) || 0 }))
        .sort((a, b) => b.messages - a.messages);

      const title = '💬 Messages Leaderboard';

      if (ranked.length === 0) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder().setTitle(title).setDescription('No data yet.')
              .setColor(config.bot.embedColor as `#${string}`)
          ]
        });
        return;
      }

      const top = ranked.slice(0, 10);
      const myCount = ranked.find(r => r.userId === interaction.user.id)?.messages || 0;
      const userRank = ranked.filter(r => r.messages > myCount).length + 1;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(config.bot.embedColor as `#${string}`)
        .setDescription(top.map((u, i) => `**${ordinal(i + 1)}** <@${u.userId}> - ${formatNumber(u.messages)} messages`).join('\n\n'))
        .setFooter({ text: `Your rank: #${userRank}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    let sortField: string;
    let title: string;
    let formatEntry: (user: any, rank: number) => string;

    switch (type) {
      case 'economy':
        sortField = 'balance';
        title = '💰 Economy Leaderboard';
        formatEntry = (user: any, rank: number) => {
          const total = (user.balance || 0) + (user.bank || 0);
          return `**${ordinal(rank)}** <@${user.user_id || user.odId}>\n💵 ${formatNumber(user.balance || 0)} | 🏦 ${formatNumber(user.bank || 0)} | Total: ${formatNumber(total)}`;
        };
        break;
      default:
        sortField = 'totalXp';
        title = '⭐ XP Leaderboard';
        formatEntry = (user: any, rank: number) => {
          return `**${ordinal(rank)}** <@${user.user_id || user.odId}>\nLevel ${user.level || 1} • ${formatNumber(user.totalXp || user.xp || 0)} XP`;
        };
    }

    const users = await UserData.find({ guildId }, { sort: { [sortField]: -1 }, limit: 10 });

    if (users.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(title)
            .setDescription('No data yet.')
            .setColor(config.bot.embedColor as `#${string}`)
        ]
      });
      return;
    }

    const userRank = await UserData.countDocuments({
      guildId,
      [sortField]: { $gt: (await UserData.findOne({ odId: interaction.user.id, guildId }))?.[sortField] || 0 }
    }) + 1;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(config.bot.embedColor as `#${string}`)
      .setDescription(users.map((u: any, i: number) => formatEntry(u, i + 1)).join('\n\n'))
      .setFooter({ text: `Your rank: #${userRank}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};

export default command;
