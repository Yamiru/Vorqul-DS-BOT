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
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { ModLog } from '../../../utils/models.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by their ID')
    .addStringOption(option =>
      option
        .setName('user_id')
        .setDescription('Discord ID of the user to unban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the unban')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.options.getString('user_id', true).trim();
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'The provided ID is not a valid Discord ID.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const bans = await interaction.guild!.bans.fetch().catch(() => null);
    if (bans && !bans.has(userId)) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'This user is not banned.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    try {
      await interaction.guild!.members.unban(userId, reason);
    } catch {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'Unban failed. Check the ID and the bot permissions.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await ModLog.create({
      guildId,
      userId,
      moderatorId: interaction.user.id,
      action: 'unban',
      reason
    });

    await interaction.reply({
      embeds: [
        EmbedHelper.success(
          `User ${userId} has been unbanned`,
          `**Reason:** ${reason}`
        )
      ]
    });
  }
};

export default command;
