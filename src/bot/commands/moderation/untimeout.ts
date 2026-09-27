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
  GuildMember,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { ModLog } from '../../../utils/models.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove a timeout from a member')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The member to remove the timeout from')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const target = interaction.options.getMember('user') as GuildMember | null;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'This user is not in the server.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!target.isCommunicationDisabled()) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'This user does not have an active timeout.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!target.moderatable) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'I cannot modify this user.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await target.timeout(null, reason);

    await ModLog.create({
      guildId,
      userId: target.id,
      moderatorId: interaction.user.id,
      action: 'untimeout',
      reason
    });

    await interaction.reply({
      embeds: [
        EmbedHelper.success(
          `Timeout removed for ${target.user.tag}`,
          `**Reason:** ${reason}`
        )
      ]
    });
  }
};

export default command;
