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
import { formatNumber } from '../../../../utils/helpers.js';
import type { Command } from '../../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Transfer money to another user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to send money to')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Amount to transfer')
        .setMinValue(1)
        .setRequired(true)
    ),

  category: 'economy',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const targetUser = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', i18n.t('economy.transfer.self', guildId))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (targetUser.bot) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'You cannot send money to bots.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const settings = await GuildSettings.findOne({ guildId });
    const currency = settings?.economy?.currency || '💰';
    const currencyName = settings?.economy?.currencyName || 'coins';

    const transfer = await UserData.transfer(guildId, interaction.user.id, targetUser.id, amount);

    if (!transfer.ok) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', i18n.t('economy.transfer.insufficient', guildId, { currency: currencyName }))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const senderData = await UserData.findOne({ odId: interaction.user.id, guildId });

    await interaction.reply({
      embeds: [
        EmbedHelper.success(
          '💸 Transfer Complete',
          i18n.t('economy.transfer.success', guildId, {
            amount: `${currency} ${formatNumber(amount)}`,
            user: targetUser.toString()
          }) + `\n\n**Your new balance:** ${formatNumber(senderData.balance)} ${currencyName}`
        )
      ]
    });
  }
};

export default command;
