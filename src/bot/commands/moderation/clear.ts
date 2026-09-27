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
  TextChannel,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { i18n } from '../../../utils/i18n.js';
import { ModLog } from '../../../utils/models.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete multiple messages')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Only delete messages from this user')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.ManageMessages],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const amount = interaction.options.getInteger('amount', true);
    const targetUser = interaction.options.getUser('user');
    const channel = interaction.channel as TextChannel;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      let messages = await channel.messages.fetch({ limit: amount });

      if (targetUser) {
        messages = messages.filter(m => m.author.id === targetUser.id);
      }

      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      messages = messages.filter(m => m.createdTimestamp > twoWeeksAgo);

      if (messages.size === 0) {
        await interaction.editReply({
          embeds: [EmbedHelper.warning('Warning', 'No deletable messages found.')]
        });
        return;
      }

      const deleted = await channel.bulkDelete(messages, true);

      await ModLog.create({
        guildId,
        odId: targetUser?.id || 'bulk',
        moderatorId: interaction.user.id,
        action: 'clear',
        reason: `Deleted ${deleted.size} messages` + (targetUser ? ` from ${targetUser.tag}` : '')
      });

      await interaction.editReply({
        embeds: [
          EmbedHelper.success(
            i18n.t('moderation.clear.success', guildId, { count: deleted.size.toString() })
          )
        ]
      });
    } catch (error) {
      await interaction.editReply({
        embeds: [EmbedHelper.error('Error', 'Failed to delete messages.')]
      });
    }
  }
};

export default command;
