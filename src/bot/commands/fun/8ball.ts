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
  EmbedBuilder
} from 'discord.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';

const responses = [
  { text: 'It is certain.', type: 'positive' },
  { text: 'It is decidedly so.', type: 'positive' },
  { text: 'Without a doubt.', type: 'positive' },
  { text: 'Yes, definitely.', type: 'positive' },
  { text: 'You may rely on it.', type: 'positive' },
  { text: 'As I see it, yes.', type: 'positive' },
  { text: 'Most likely.', type: 'positive' },
  { text: 'Outlook good.', type: 'positive' },
  { text: 'Yes.', type: 'positive' },
  { text: 'Signs point to yes.', type: 'positive' },

  { text: 'Reply hazy, try again.', type: 'neutral' },
  { text: 'Ask again later.', type: 'neutral' },
  { text: 'Better not tell you now.', type: 'neutral' },
  { text: 'Cannot predict now.', type: 'neutral' },
  { text: 'Concentrate and ask again.', type: 'neutral' },

  { text: "Don't count on it.", type: 'negative' },
  { text: 'My reply is no.', type: 'negative' },
  { text: 'My sources say no.', type: 'negative' },
  { text: 'Outlook not so good.', type: 'negative' },
  { text: 'Very doubtful.', type: 'negative' }
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic 8-ball a question')
    .addStringOption(option =>
      option
        .setName('question')
        .setDescription('Your question')
        .setRequired(true)
    ),

  category: 'fun',

  execute: async (interaction: ChatInputCommandInteraction) => {
    const question = interaction.options.getString('question', true);
    const response = responses[Math.floor(Math.random() * responses.length)];

    let color: string;
    switch (response.type) {
      case 'positive':
        color = config.bot.successColor;
        break;
      case 'negative':
        color = config.bot.errorColor;
        break;
      default:
        color = config.bot.warningColor;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎱 Magic 8-Ball')
      .setColor(color as `#${string}`)
      .addFields(
        { name: '❓ Question', value: question },
        { name: '🔮 Answer', value: response.text }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
