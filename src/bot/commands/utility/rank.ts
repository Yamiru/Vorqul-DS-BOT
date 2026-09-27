/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { i18n } from '../../../utils/i18n.js';
import { UserData } from '../../../utils/models.js';
import { formatNumber, progressBar } from '../../../utils/helpers.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';

function calculateXpForLevel(level: number): number {
  return 5 * Math.pow(level, 2) + 50 * level + 100;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your or another user\'s rank')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check rank for')
        .setRequired(false)
    ),

  category: 'utility',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const targetUser = interaction.options.getUser('user') || interaction.user;

    const userData = await UserData.findOne({ odId: targetUser.id, guildId });

    if (!userData) {
      await interaction.reply({
        embeds: [EmbedHelper.info(i18n.t('leveling.noData', guildId))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const rank = await UserData.countDocuments({
      guildId,
      totalXp: { $gt: userData.totalXp }
    }) + 1;

    const xpNeeded = calculateXpForLevel(userData.level + 1);
    const progress = Math.round((userData.xp / xpNeeded) * 100);

    const embed = EmbedHelper.custom({
      title: `📊 ${targetUser.username}'s Rank`,
      color: config.bot.embedColor as `#${string}`,
      thumbnail: targetUser.displayAvatarURL({ size: 256 }),
      fields: [
        { name: i18n.t('leveling.rank', guildId), value: `#${rank}`, inline: true },
        { name: i18n.t('leveling.level', guildId), value: `${userData.level}`, inline: true },
        { name: '💬 Messages', value: formatNumber(userData.messages), inline: true },
        {
          name: i18n.t('leveling.progress', guildId),
          value: `${progressBar(userData.xp, xpNeeded, 15)} ${progress}%\n${formatNumber(userData.xp)} / ${formatNumber(xpNeeded)} XP`,
          inline: false
        },
        { name: 'Total XP', value: formatNumber(userData.totalXp), inline: true }
      ],
      timestamp: true
    });

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
