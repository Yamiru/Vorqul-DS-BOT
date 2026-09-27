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
import { fetchMcStatus, type McStatus } from '../../../../utils/mcStatus.js';
import type { Command } from '../../../types.js';

export function buildStatusEmbed(status: McStatus, color?: number): EmbedBuilder {
  if (!status.online) {
    return new EmbedBuilder()
      .setTitle('🔴 Server je offline')
      .setDescription(`Server \`${status.host}${status.port ? ':' + status.port : ''}\` is currently unavailable.`)
      .setColor(0xed4245)
      .setTimestamp();
  }

  let players = status.playerList.join(', ');
  if (players.length > 1024) players = players.substring(0, 1020) + '…';

  const embed = new EmbedBuilder()
    .setTitle('🟢 Server je online')
    .setColor(color ?? 0x23a55a)
    .addFields(
      { name: '🌍 Adresa', value: `\`${status.host}${status.port ? ':' + status.port : ''}\``, inline: true },
      { name: '👥 Players', value: `${status.playersOnline}/${status.playersMax}`, inline: true },
      { name: '📝 Verzia', value: status.version || 'N/A', inline: true }
    )
    .setThumbnail(status.iconUrl || null)
    .setTimestamp();

  if (status.motd) embed.setDescription(status.motd);
  if (players) embed.addFields({ name: '🎮 Online players', value: players, inline: false });

  return embed;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('mcstatus')
    .setDescription('Shows the status of a Minecraft/Bedrock server')
    .addStringOption(o =>
      o.setName('ip').setDescription('IP/adresa servera (napr. play.example.com)').setRequired(true))
    .addBooleanOption(o =>
      o.setName('bedrock').setDescription('Je to Bedrock server?').setRequired(false)),

  category: 'utility',
  cooldown: 10,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const input = interaction.options.getString('ip', true).trim();
    const bedrock = interaction.options.getBoolean('bedrock') || false;

    let host = input;
    let port: number | undefined;
    if (input.includes(':')) {
      const [h, p] = input.split(':');
      host = h;
      const parsed = parseInt(p, 10);
      if (!isNaN(parsed)) port = parsed;
    }

    await interaction.deferReply();
    const status = await fetchMcStatus(host, port, bedrock);
    await interaction.editReply({ embeds: [buildStatusEmbed(status)] });
  }
};

export default command;
