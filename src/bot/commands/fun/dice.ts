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
  MessageFlags
} from 'discord.js';
import { randomInt } from '../../../utils/helpers.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Roll dice')
    .addStringOption(option =>
      option
        .setName('dice')
        .setDescription('Dice notation (e.g., 2d6, 1d20, 3d8+5)')
        .setRequired(false)
    ),

  category: 'fun',

  execute: async (interaction: ChatInputCommandInteraction) => {
    const input = interaction.options.getString('dice') || '1d6';

    const match = input.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);

    if (!match) {
      await interaction.reply({
        content: 'Invalid dice notation. Use format like: 2d6, 1d20, 3d8+5',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const count = parseInt(match[1] || '1');
    const sides = parseInt(match[2]);
    const modifier = parseInt(match[3] || '0');

    if (count < 1 || count > 100) {
      await interaction.reply({
        content: 'Number of dice must be between 1 and 100.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (sides < 2 || sides > 1000) {
      await interaction.reply({
        content: 'Dice sides must be between 2 and 1000.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(randomInt(1, sides));
    }

    const sum = rolls.reduce((a, b) => a + b, 0);
    const total = sum + modifier;

    const embed = new EmbedBuilder()
      .setTitle('🎲 Dice Roll')
      .setColor(config.bot.embedColor as `#${string}`)
      .addFields(
        { name: 'Dice', value: input.toUpperCase(), inline: true },
        { name: 'Rolls', value: rolls.join(', '), inline: true },
        {
          name: 'Total',
          value: modifier !== 0
            ? `${sum} ${modifier > 0 ? '+' : ''}${modifier} = **${total}**`
            : `**${total}**`,
          inline: true
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
