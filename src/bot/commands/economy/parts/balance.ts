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
import { UserData, GuildSettings } from '../../../../utils/models.js';
import { formatNumber } from '../../../../utils/helpers.js';
import config from '../../../../config/config.json' with { type: 'json' };
import type { Command } from '../../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your or another user\'s balance')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check balance for')
        .setRequired(false)
    ),

  category: 'economy',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const targetUser = interaction.options.getUser('user') || interaction.user;

    const settings = await GuildSettings.findOne({ guildId });
    const currency = settings?.economy?.currency || '💰';
    const currencyName = settings?.economy?.currencyName || 'coins';

    let userData = await UserData.findOne({ odId: targetUser.id, guildId });

    if (!userData) {
      userData = await UserData.create({
        odId: targetUser.id,
        guildId,
        bank: 0
      });
    }

    const total = userData.balance + userData.bank;

    const embed = new EmbedBuilder()
      .setTitle(`${currency} ${targetUser.username}'s Balance`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
      .setColor(config.bot.embedColor as `#${string}`)
      .addFields(
        { name: '💵 Wallet', value: `${formatNumber(userData.balance)} ${currencyName}`, inline: true },
        { name: '🏦 Bank', value: `${formatNumber(userData.bank)} ${currencyName}`, inline: true },
        { name: '💎 Total', value: `${formatNumber(total)} ${currencyName}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
