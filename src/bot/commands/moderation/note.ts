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
    .setName('note')
    .setDescription('Add a private moderator note to a user')
    .addUserOption(option =>
      option.setName('user').setDescription('The user the note is about').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('text').setDescription('The note text').setMaxLength(1000).setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const user = interaction.options.getUser('user', true);
    const text = interaction.options.getString('text', true);

    await ModLog.create({
      guildId,
      userId: user.id,
      moderatorId: interaction.user.id,
      action: 'note',
      reason: text
    });

    await interaction.reply({
      embeds: [
        EmbedHelper.success(
          `Note added for ${user.tag}`,
          `${text}\n\nUse \`/notes user:${user.tag}\` to view all notes and history.`
        )
      ],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
