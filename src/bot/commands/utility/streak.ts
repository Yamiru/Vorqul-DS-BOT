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
import { ActivityStreak } from '../../../utils/models.js';
import { progressBar } from '../../../utils/helpers.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('streak')
    .setDescription('View your activity streak')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to check').setRequired(false)
    ),

  category: 'utility',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const targetUser = interaction.options.getUser('user') || interaction.user;

    let streak = await ActivityStreak.findOne({ odId: targetUser.id, guildId });

    if (!streak) {
      streak = await ActivityStreak.create({
        odId: targetUser.id,
        guildId,
        currentStreak: 0,
        longestStreak: 0,
        totalActiveDays: 0
      });
    }

    const milestones = [7, 14, 30, 60, 90, 180, 365];
    const nextMilestone = milestones.find(m => m > streak.currentStreak) || streak.currentStreak + 30;
    const progress = Math.min((streak.currentStreak / nextMilestone) * 100, 100);

    let rankEmoji = '🌱';
    if (streak.currentStreak >= 365) rankEmoji = '👑';
    else if (streak.currentStreak >= 180) rankEmoji = '💎';
    else if (streak.currentStreak >= 90) rankEmoji = '🔥';
    else if (streak.currentStreak >= 30) rankEmoji = '⭐';
    else if (streak.currentStreak >= 14) rankEmoji = '✨';
    else if (streak.currentStreak >= 7) rankEmoji = '🌟';

    const embed = new EmbedBuilder()
      .setTitle(`${rankEmoji} ${targetUser.username}'s Activity Streak`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setColor(config.bot.embedColor as `#${string}`)
      .addFields(
        { name: '🔥 Current Streak', value: `${streak.currentStreak} days`, inline: true },
        { name: '🏆 Longest Streak', value: `${streak.longestStreak} days`, inline: true },
        { name: '📅 Total Active Days', value: `${streak.totalActiveDays}`, inline: true },
        {
          name: `📊 Progress to ${nextMilestone} days`,
          value: `${progressBar(streak.currentStreak, nextMilestone, 15)} ${Math.round(progress)}%`,
          inline: false
        }
      )
      .setTimestamp();

    const rewards = [
      { days: 7, reward: '500 coins + 100 XP' },
      { days: 14, reward: '1000 coins + 250 XP' },
      { days: 30, reward: '2500 coins + 500 XP' },
      { days: 60, reward: '5000 coins + 1000 XP' },
      { days: 90, reward: '10000 coins + Special Role' }
    ];

    const upcomingRewards = rewards
      .filter(r => r.days > streak.currentStreak)
      .slice(0, 3)
      .map(r => `**${r.days} days:** ${r.reward}`)
      .join('\n');

    if (upcomingRewards) {
      embed.addFields({
        name: '🎁 Upcoming Rewards',
        value: upcomingRewards,
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
