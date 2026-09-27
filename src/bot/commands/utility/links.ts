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
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ColorResolvable,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { GuildSettings } from '../../../utils/models.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';

interface LinkEntry {
  name: string;
  url: string;
  description?: string;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('links')
    .setDescription('Show the useful links for this server'),

  category: 'utility',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const settings: any = await GuildSettings.findOne({ guildId });

    const general: any = settings?.modules?.general && typeof settings.modules.general === 'object' ? settings.modules.general : {};
    const links: LinkEntry[] = (Array.isArray(general.links) ? general.links : []) as LinkEntry[];

    if (general.linksEnabled === false) {
      await interaction.reply({
        embeds: [EmbedHelper.warning('Links disabled', 'The links module is disabled on this server.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!links || links.length === 0) {
      await interaction.reply({
        embeds: [EmbedHelper.info('No links', 'An administrator has not set any links in the dashboard yet.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔗 Useful links - ${interaction.guild!.name}`)
      .setColor(config.bot.embedColor as ColorResolvable)
      .setThumbnail(interaction.guild!.iconURL({ size: 256 }) || '')
      .setDescription(
        links
          .map(l => `**${l.name}**${l.description ? ` - ${l.description}` : ''}\n${l.url}`)
          .join('\n\n')
      )
      .setTimestamp();

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    const valid = links.filter(l => /^https?:\/\//i.test(l.url)).slice(0, 25);
    for (let i = 0; i < valid.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      for (const l of valid.slice(i, i + 5)) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel(l.name.slice(0, 80))
            .setStyle(ButtonStyle.Link)
            .setURL(l.url)
        );
      }
      rows.push(row);
    }

    await interaction.reply({ embeds: [embed], components: rows });
  }
};

export default command;
