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
    .setName('case')
    .setDescription('Look up a moderation case by its ID')
    .addIntegerOption(o => o.setName('id').setDescription('Case ID').setRequired(true).setMinValue(1))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const id = interaction.options.getInteger('id', true);
    const c: any = await ModLog.findById(id);

    if (!c || c.guild_id !== interaction.guildId) {
      await interaction.reply({ embeds: [EmbedHelper.error('Not found', `No moderation case with ID **#${id}** on this server.`)], flags: MessageFlags.Ephemeral });
      return;
    }

    const when = c.created_at ? new Date(c.created_at).toLocaleString() : 'Unknown';
    const desc =
      `**Case:** #${c.id}\n` +
      `**Action:** ${c.action || 'unknown'}\n` +
      `**User:** <@${c.user_id}> (${c.user_id})\n` +
      `**Moderator:** <@${c.moderator_id}>\n` +
      (c.duration ? `**Duration:** ${c.duration}\n` : '') +
      `**Reason:** ${c.reason || 'No reason provided'}\n` +
      `**Date:** ${when}`;

    await interaction.reply({ embeds: [EmbedHelper.info(`📋 Moderation case #${c.id}`, desc)] });
  }
};

export default command;
