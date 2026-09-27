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
import { ShadowMute } from '../../../utils/models.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('shadowmute')
    .setDescription('Shadow-mute a member: their messages are silently removed without notifying them')
    .addUserOption(o => o.setName('user').setDescription('Member to shadow-mute').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target = interaction.options.getUser('user', true);
    await ShadowMute.add({ guildId: interaction.guildId!, userId: target.id, moderatorId: interaction.user.id });
    await interaction.reply({
      embeds: [EmbedHelper.warning(`🔇 ${target.tag} shadow-muted`, 'Their new messages will be removed silently. Use `/unshadowmute` to undo.')],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
