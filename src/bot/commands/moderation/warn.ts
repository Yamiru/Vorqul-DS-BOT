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
import { UserData, ModLog } from '../../../utils/models.js';
import type { Command } from '../../types.js';
import { logger } from '../../../utils/logger.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to warn')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const target = interaction.options.getMember('user') as GuildMember | null;
    const reason = interaction.options.getString('reason', true);

    if (!target) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', i18n.t('common.invalidUser', guildId))],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (target.user.bot) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'Cannot warn bots.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    let userData = await UserData.findOne({ odId: target.id, guildId });

    if (!userData) {
      userData = await UserData.create({ odId: target.id, guildId, warnings: [] });
    }

    const warnings = userData.warnings || [];
    warnings.push({
      moderatorId: interaction.user.id,
      reason,
      date: new Date()
    });

    await UserData.findOneAndUpdate(
      { odId: target.id, guildId },
      { $set: { warnings } }
    );

    await ModLog.create({
      guildId,
      odId: target.id,
      moderatorId: interaction.user.id,
      action: 'warn',
      reason
    });

    try {
      await target.send({
        embeds: [
          EmbedHelper.warning(
            i18n.t('moderation.warn.dmNotify', guildId, { server: interaction.guild!.name }),
            `**${i18n.t('moderation.kick.reason', guildId, { reason })}**`
          )
        ]
      });
    } catch (error) {
        logger.debug('warn: suppressed error', error);
      }

    await interaction.reply({
      embeds: [
        EmbedHelper.success(
          i18n.t('moderation.warn.success', guildId, { user: target.user.tag }),
          [
            i18n.t('moderation.kick.reason', guildId, { reason }),
            i18n.t('moderation.warn.count', guildId, { count: userData.warnings.length.toString() })
          ].join('\n')
        )
      ]
    });
  }
};

export default command;
