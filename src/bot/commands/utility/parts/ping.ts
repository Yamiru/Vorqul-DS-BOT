/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import type { Command } from '../../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency'),

  category: 'utility',

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.reply({
      embeds: [EmbedHelper.info('Pinging...', '🏓')]
    });

    const sent = await interaction.fetchReply();

    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = interaction.client.ws.ping;

    await interaction.editReply({
      embeds: [
        EmbedHelper.success('🏓 Pong!')
          .addFields(
            { name: 'Roundtrip', value: `${roundtrip}ms`, inline: true },
            { name: 'WebSocket', value: `${wsLatency}ms`, inline: true }
          )
      ]
    });
  }
};

export default command;
