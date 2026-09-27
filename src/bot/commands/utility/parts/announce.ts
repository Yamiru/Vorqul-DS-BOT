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
  TextChannel,
  ChannelType,
  EmbedBuilder,
  ColorResolvable,
  Role,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import config from '../../../../config/config.json' with { type: 'json' };
import type { Command } from '../../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement (embed) to a channel')
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Announcement text')
        .setMaxLength(4000)
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Target channel')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Announcement title')
        .setMaxLength(256)
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('color')
        .setDescription('Embed color (hex, e.g. #5865F2)')
        .setRequired(false)
    )
    .addRoleOption(option =>
      option
        .setName('ping')
        .setDescription('Role to ping above the announcement')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  category: 'utility',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const message = interaction.options.getString('message', true);
    const channel = (interaction.options.getChannel('channel') || interaction.channel) as TextChannel;
    const title = interaction.options.getString('title');
    const color = interaction.options.getString('color') || config.bot.embedColor;
    const ping = interaction.options.getRole('ping') as Role | null;

    if (!channel || !channel.isTextBased()) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'An announcement cannot be sent to this channel.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setDescription(message)
      .setColor(color as ColorResolvable)
      .setFooter({ text: `Announcement by ${interaction.user.tag}` })
      .setTimestamp();
    if (title) embed.setTitle(title);

    await channel.send({
      content: ping ? `${ping}` : undefined,
      embeds: [embed],
      allowedMentions: ping ? { roles: [ping.id] } : { parse: [] }
    });

    await interaction.reply({
      embeds: [EmbedHelper.success('Announcement sent', `Announcement sent to ${channel}.`)],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
