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
  EmbedBuilder,
  ColorResolvable
} from 'discord.js';
import config from '../../../../config/config.json' with { type: 'json' };
import type { Command } from '../../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Show a user avatar')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User (defaults to you)')
        .setRequired(false)
    ),

  category: 'utility',

  execute: async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.options.getUser('user') || interaction.user;
    const url = user.displayAvatarURL({ size: 1024, extension: 'png' });

    const embed = new EmbedBuilder()
      .setTitle(`🖼️ Avatar - ${user.tag}`)
      .setColor(config.bot.embedColor as ColorResolvable)
      .setImage(url)
      .setDescription(`[PNG](${user.displayAvatarURL({ size: 1024, extension: 'png' })}) • ` +
        `[JPG](${user.displayAvatarURL({ size: 1024, extension: 'jpg' })}) • ` +
        `[WEBP](${user.displayAvatarURL({ size: 1024, extension: 'webp' })})`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
