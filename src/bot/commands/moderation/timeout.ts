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
import { parseTime, formatDuration } from '../../../utils/helpers.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to timeout')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('Duration (e.g., 10m, 1h, 1d)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the timeout')
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
    const durationStr = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason') || i18n.t('moderation.kick.noReason', guildId);

    if (!target) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', i18n.t('common.invalidUser', guildId))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const duration = parseTime(durationStr);
    if (!duration) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'Invalid duration format. Use formats like: 10m, 1h, 1d')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (duration > 28 * 24 * 60 * 60 * 1000) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'Maximum timeout duration is 28 days.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!target.moderatable) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', i18n.t('moderation.kick.cannotKick', guildId))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const member = interaction.member as GuildMember;
    if (target.roles.highest.position >= member.roles.highest.position) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', i18n.t('moderation.kick.higherRole', guildId))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await target.timeout(duration, reason);

    await ModLog.create({
      guildId,
      odId: target.id,
      moderatorId: interaction.user.id,
      action: 'timeout',
      reason,
      duration
    });

    const formattedDuration = formatDuration(duration);

    await interaction.reply({
      embeds: [
        EmbedHelper.success(
          i18n.t('moderation.timeout.success', guildId, {
            user: target.user.tag,
            duration: formattedDuration
          }),
          i18n.t('moderation.kick.reason', guildId, { reason })
        )
      ]
    });
  }
};

export default command;
