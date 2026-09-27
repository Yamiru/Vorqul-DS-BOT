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
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import { i18n } from '../../../../utils/i18n.js';
import { UserData, GuildSettings } from '../../../../utils/models.js';
import { resolveEconomy } from '../../../../shared/featureConfig.js';
import { formatNumber, formatDuration } from '../../../../utils/helpers.js';
import { getDatabase } from '../../../../utils/database.js';
import type { Command } from '../../../types.js';

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward'),

  category: 'economy',
  guildOnly: true,
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const odId = interaction.user.id;

    const settings = await GuildSettings.findOne({ guildId });
    const economy = resolveEconomy(settings);
    const currency = economy.currencyEmoji;
    const currencyName = economy.currencyName;

    let userData = await UserData.findOne({ odId, guildId });

    if (!userData) {
      userData = await UserData.create({ odId, guildId });
    }

    const now = new Date();
    const lastDaily = userData.lastDaily;

    if (lastDaily) {
      const timeSince = now.getTime() - lastDaily.getTime();

      if (timeSince < DAILY_COOLDOWN) {
        const timeLeft = DAILY_COOLDOWN - timeSince;
        await interaction.reply({
          embeds: [
            EmbedHelper.warning(
              'Daily Reward',
              i18n.t('economy.daily.cooldown', guildId, { time: formatDuration(timeLeft) })
            )
          ],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const hoursSinceLast = timeSince / (1000 * 60 * 60);
      if (hoursSinceLast > 48) {
        userData.dailyStreak = 0;
      }
    }

    userData.dailyStreak += 1;
    const baseReward = economy.dailyAmount;
    const bonusDays = Math.min(userData.dailyStreak, economy.maxStreakBonus);
    const streakBonus = Math.round(baseReward * (economy.dailyStreakBonus / 100) * bonusDays);
    const totalReward = baseReward + streakBonus;

    await getDatabase().increment('user_data', { balance: totalReward }, {
      user_id: odId,
      guild_id: guildId
    });
    userData.balance += totalReward;
    userData.lastDaily = now;
    await userData.save();

    const embed = EmbedHelper.success(
      '🎁 Daily Reward Claimed!',
      [
        i18n.t('economy.daily.claimed', guildId, { amount: `${currency} ${formatNumber(totalReward)}` }),
        '',
        `**Base:** ${formatNumber(baseReward)} ${currencyName}`,
        `**Streak Bonus:** +${formatNumber(streakBonus)} ${currencyName}`,
        `**Current Streak:** 🔥 ${userData.dailyStreak} days`,
        '',
        `**New Balance:** ${formatNumber(userData.balance)} ${currencyName}`
      ].join('\n')
    );

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
