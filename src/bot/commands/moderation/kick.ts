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
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.KickMembers],
  botPermissions: [PermissionFlagsBits.KickMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const target = interaction.options.getMember('user') as GuildMember | null;
    const reason = interaction.options.getString('reason') || i18n.t('moderation.kick.noReason', guildId);

    if (!target) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', i18n.t('common.invalidUser', guildId))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!target.kickable) {
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

    try {
      await target.send({
        embeds: [
          EmbedHelper.error(
            i18n.t('moderation.kick.dmNotify', guildId, { server: interaction.guild!.name }),
            `**${i18n.t('moderation.kick.reason', guildId, { reason })}**`
          )
        ]
      });
    } catch (error) {
        logger.debug('kick: suppressed error', error);
      }

    await target.kick(reason);

    await ModLog.create({
      guildId,
      odId: target.id,
      moderatorId: interaction.user.id,
      action: 'kick',
      reason
    });

    await interaction.reply({
      embeds: [
        EmbedHelper.success(
          i18n.t('moderation.kick.success', guildId, { user: target.user.tag }),
          i18n.t('moderation.kick.reason', guildId, { reason })
        )
      ]
    });
  }
};

export default command;
