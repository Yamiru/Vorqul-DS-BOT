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
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import { GuildSettings } from '../../../../utils/models.js';
import { getLimit } from '../../../../utils/premium.js';
import { postSticky, removeSticky, StickyConfig } from '../../../events/stickyMessage.js';
import type { Command } from '../../../types.js';

async function readStickyList(guildId: string): Promise<StickyConfig[]> {
  const settings = await GuildSettings.findOne({ guildId });
  return Array.isArray(settings?.sticky) ? (settings!.sticky as StickyConfig[]) : [];
}

async function writeStickyList(guildId: string, list: StickyConfig[]): Promise<void> {
  await GuildSettings.findOneAndUpdate({ guildId }, { $set: { sticky: list } }, { upsert: true });
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('sticky')
    .setDescription('Keep a message pinned to the bottom of a channel')
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set (or replace) the sticky message in this channel')
        .addStringOption(opt => opt.setName('message').setDescription('Sticky text').setRequired(true))
        .addBooleanOption(opt => opt.setName('embed').setDescription('Send as an embed instead of plain text'))
        .addStringOption(opt => opt.setName('color').setDescription('Embed color, e.g. #5865f2'))
        .addStringOption(opt => opt.setName('title').setDescription('Embed title (embed mode only)'))
    )
    .addSubcommand(sub =>
      sub.setName('remove').setDescription('Remove the sticky message from this channel')
    )
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List all sticky messages on this server')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  category: 'utility',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const channel = interaction.channel as TextChannel;
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({ embeds: [EmbedHelper.error('Text channels only', 'Run this in the text channel where you want the sticky.')], flags: MessageFlags.Ephemeral });
        return;
      }
      const content = interaction.options.getString('message', true);
      const useEmbed = interaction.options.getBoolean('embed') ?? false;
      const color = interaction.options.getString('color') ?? undefined;
      const title = interaction.options.getString('title') ?? undefined;

      const list = await readStickyList(guildId);
      const entry: StickyConfig = { channelId: channel.id, content, useEmbed, color, title };
      const idx = list.findIndex(s => s.channelId === channel.id);

      if (idx < 0) {
        const max = await getLimit(guildId, 'stickyMessages');
        if (list.length >= max) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Limit reached', `Your plan allows up to ${max} sticky message(s). Remove one or upgrade to add more.`)],
            flags: MessageFlags.Ephemeral
          });
          return;
        }
      }

      if (idx >= 0) list[idx] = entry; else list.push(entry);
      await writeStickyList(guildId, list);

      await postSticky(channel, entry);
      await interaction.reply({ embeds: [EmbedHelper.success('Sticky set', `This message will stay at the bottom of ${channel}.`)], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'remove') {
      const channel = interaction.channel as TextChannel;
      const list = await readStickyList(guildId);
      const next = list.filter(s => s.channelId !== channel.id);
      if (next.length === list.length) {
        await interaction.reply({ embeds: [EmbedHelper.warning('Nothing to remove', 'There is no sticky message in this channel.')], flags: MessageFlags.Ephemeral });
        return;
      }
      await writeStickyList(guildId, next);
      await removeSticky(channel);
      await interaction.reply({ embeds: [EmbedHelper.success('Sticky removed', `Removed the sticky message from ${channel}.`)], flags: MessageFlags.Ephemeral });
      return;
    }

    const list = await readStickyList(guildId);
    if (list.length === 0) {
      await interaction.reply({ embeds: [EmbedHelper.info('No sticky messages', 'Use `/sticky set` in a channel to create one.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const lines = list.map(s => {
      const preview = (s.content || '').replace(/\n/g, ' ').slice(0, 60);
      return `<#${s.channelId}> - ${s.useEmbed ? 'embed' : 'text'}: ${preview}${preview.length >= 60 ? '…' : ''}`;
    });
    await interaction.reply({ embeds: [EmbedHelper.info('Sticky messages', lines.join('\n'))], flags: MessageFlags.Ephemeral });
  }
};

export default command;
