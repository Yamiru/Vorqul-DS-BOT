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
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Change or reset a member nickname')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The member to rename')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('nickname')
        .setDescription('New nickname (empty = reset to original name)')
        .setMaxLength(32)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageNicknames],
  botPermissions: [PermissionFlagsBits.ManageNicknames],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target = interaction.options.getMember('user') as GuildMember | null;
    const nickname = interaction.options.getString('nickname');

    if (!target) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'This user is not in the server.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!target.manageable) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'I cannot change this member nickname (higher role).')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    try {
      await target.setNickname(nickname ?? null, `Changed by ${interaction.user.tag}`);
    } catch {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'Failed to change the nickname.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const desc = nickname
      ? `Nickname for **${target.user.tag}** changed to **${nickname}**.`
      : `Nickname for **${target.user.tag}** has been reset.`;

    await interaction.reply({ embeds: [EmbedHelper.success('Nickname updated', desc)] });
  }
};

export default command;
