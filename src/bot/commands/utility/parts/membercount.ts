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
    .setName('membercount')
    .setDescription('Show the server member count'),

  category: 'utility',

  cooldown: 5,
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guild = interaction.guild!;
    await interaction.deferReply();

    const members = await guild.members.fetch().catch(() => null);

    let humans = 0;
    let bots = 0;
    let online = 0;

    if (members) {
      members.forEach(m => {
        if (m.user.bot) bots++; else humans++;
        const status = m.presence?.status;
        if (status && status !== 'offline') online++;
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`📊 Member count - ${guild.name}`)
      .setColor(config.bot.embedColor as ColorResolvable)
      .setThumbnail(guild.iconURL({ size: 256 }) || '')
      .addFields(
        { name: '👥 Total', value: `${guild.memberCount}`, inline: true },
        { name: '🧑 Humans', value: members ? `${humans}` : 'n/a', inline: true },
        { name: '🤖 Bots', value: members ? `${bots}` : 'n/a', inline: true },
        { name: '🟢 Online', value: members ? `${online}` : 'n/a', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};

export default command;
