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
import { i18n } from '../../../utils/i18n.js';
import { ModLog } from '../../../utils/models.js';
import type { Command } from '../../types.js';
import { logger } from '../../../utils/logger.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('delete_days')
        .setDescription('Delete messages from the last X days (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const target = interaction.options.getMember('user') as GuildMember | null;
    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || i18n.t('moderation.ban.noReason', guildId);
    const deleteDays = interaction.options.getInteger('delete_days') || 0;

    if (target) {
      if (!target.bannable) {
        await interaction.reply({
          embeds: [EmbedHelper.error('Error', i18n.t('moderation.ban.cannotBan', guildId))],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const member = interaction.member as GuildMember;
      if (target.roles.highest.position >= member.roles.highest.position) {
        await interaction.reply({
          embeds: [EmbedHelper.error('Error', i18n.t('moderation.ban.higherRole', guildId))],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      try {
        await target.send({
          embeds: [
            EmbedHelper.error(
              i18n.t('moderation.ban.dmNotify', guildId, { server: interaction.guild!.name }),
              `**${i18n.t('moderation.ban.reason', guildId, { reason })}**`
            )
          ]
        });
      } catch (error) {
          logger.debug('ban: suppressed error', error);
        }
    }

    await interaction.guild!.members.ban(targetUser.id, {
      reason,
      deleteMessageSeconds: deleteDays * 24 * 60 * 60
    });

    await ModLog.create({
      guildId,
      odId: targetUser.id,
      moderatorId: interaction.user.id,
      action: 'ban',
      reason
    });

    await interaction.reply({
      embeds: [
        EmbedHelper.success(
          i18n.t('moderation.ban.success', guildId, { user: targetUser.tag }),
          i18n.t('moderation.ban.reason', guildId, { reason })
        )
      ]
    });
  }
};

export default command;
