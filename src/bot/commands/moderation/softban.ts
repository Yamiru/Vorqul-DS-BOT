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
    .setName('softban')
    .setDescription('Softban a member (ban + instant unban to purge their messages)')
    .addUserOption(option =>
      option.setName('user').setDescription('The user to softban').setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('delete_days')
        .setDescription('Delete messages from the last X days (0-7, default 1)')
        .setMinValue(0).setMaxValue(7).setRequired(false)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const targetUser = interaction.options.getUser('user', true);
    const target = interaction.options.getMember('user') as GuildMember | null;
    const deleteDays = interaction.options.getInteger('delete_days') ?? 1;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (target) {
      if (!target.bannable) {
        await interaction.reply({
          embeds: [EmbedHelper.error('Error', 'I cannot softban this member.')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      const member = interaction.member as GuildMember;
      if (target.roles.highest.position >= member.roles.highest.position) {
        await interaction.reply({
          embeds: [EmbedHelper.error('Error', 'This member has a higher or equal role.')],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }

    await interaction.deferReply();

    try {
      await interaction.guild!.members.ban(targetUser.id, {
        reason: `Softban: ${reason}`,
        deleteMessageSeconds: deleteDays * 24 * 60 * 60
      });
      await interaction.guild!.members.unban(targetUser.id, `Softban (auto-unban): ${reason}`);
    } catch {
      await interaction.editReply({
        embeds: [EmbedHelper.error('Error', 'Softban failed. Check the bot permissions.')]
      });
      return;
    }

    await ModLog.create({
      guildId,
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      action: 'softban',
      reason
    });

    await interaction.editReply({
      embeds: [
        EmbedHelper.success(
          `${targetUser.tag} has been softbanned`,
          `Messages from the last **${deleteDays}** day(s) were purged.\n**Reason:** ${reason}`
        )
      ]
    });
  }
};

export default command;
