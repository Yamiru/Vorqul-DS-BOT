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
    .setName('unshadowmute')
    .setDescription('Remove a shadow-mute from a member')
    .addUserOption(o => o.setName('user').setDescription('Member to un-shadow-mute').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const target = interaction.options.getUser('user', true);
    await ShadowMute.remove({ guildId: interaction.guildId!, userId: target.id });
    await interaction.reply({
      embeds: [EmbedHelper.success(`🔊 ${target.tag} un-shadow-muted`, 'Their messages will be visible again.')],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
