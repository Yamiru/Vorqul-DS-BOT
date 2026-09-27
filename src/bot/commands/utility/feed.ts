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
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { SocialFeed } from '../../../utils/models.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('feed')
    .setDescription('Manage social media feeds')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a new feed')
        .addStringOption(opt =>
          opt
            .setName('type')
            .setDescription('Feed type')
            .setRequired(true)
            .addChoices(
              { name: 'YouTube', value: 'youtube' },
              { name: 'Twitch', value: 'twitch' },
              { name: 'Reddit', value: 'reddit' },
              { name: 'RSS', value: 'rss' }
            )
        )
        .addStringOption(opt =>
          opt.setName('source').setDescription('Channel ID, username, subreddit, or RSS URL').setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Channel to post notifications').setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('mention').setDescription('Role to mention (optional)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List all feeds')
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a feed')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Feed ID').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Enable/disable a feed')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Feed ID').setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  category: 'utility',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    switch (subcommand) {
      case 'add': {
        const type = interaction.options.getString('type', true) as 'youtube' | 'twitch' | 'reddit' | 'rss';
        const source = interaction.options.getString('source', true);
        const channel = interaction.options.getChannel('channel', true);
        const mentionRole = interaction.options.getRole('mention');

        const feed = await SocialFeed.create({
          guildId,
          type,
          sourceId: type !== 'rss' ? source : undefined,
          sourceUrl: type === 'rss' ? source : undefined,
          channelId: channel.id,
          mentionRole: mentionRole?.id,
          enabled: true,
          lastItems: []
        });

        const typeNames: Record<string, string> = {
          youtube: '📺 YouTube',
          twitch: '🎮 Twitch',
          reddit: '📰 Reddit',
          rss: '📡 RSS'
        };

        await interaction.reply({
          embeds: [
            EmbedHelper.success(
              'Feed Added',
              `**Type:** ${typeNames[type]}\n**Source:** ${source}\n**Channel:** ${channel}\n**ID:** \`${feed._id}\``
            )
          ]
        });
        break;
      }

      case 'list': {
        const feeds = await SocialFeed.find({ guildId });

        if (feeds.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Feeds', 'No feeds configured.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const typeEmojis: Record<string, string> = {
          youtube: '📺',
          twitch: '🎮',
          reddit: '📰',
          rss: '📡'
        };

        const embed = new EmbedBuilder()
          .setTitle('📡 Social Feeds')
          .setColor(config.bot.embedColor as `#${string}`)
          .setDescription(
            feeds.map((f, i) =>
              `**${i + 1}.** ${typeEmojis[f.type]} ${f.type.toUpperCase()}\n` +
              `   Source: \`${f.sourceId || f.sourceUrl}\`\n` +
              `   Channel: <#${f.channelId}>\n` +
              `   Status: ${f.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
              `   ID: \`${f._id}\``
            ).join('\n\n')
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'remove': {
        const feedId = interaction.options.getString('id', true);
        const result = await SocialFeed.findOneAndDelete({ _id: feedId, guildId });

        if (!result) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Feed not found.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.reply({
          embeds: [EmbedHelper.success('Removed', 'Feed has been removed.')]
        });
        break;
      }

      case 'toggle': {
        const feedId = interaction.options.getString('id', true);
        const feed = await SocialFeed.findOne({ _id: feedId, guildId });

        if (!feed) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Feed not found.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        feed.enabled = !feed.enabled;
        await feed.save();

        await interaction.reply({
          embeds: [
            EmbedHelper.success(
              'Updated',
              `Feed is now ${feed.enabled ? '✅ enabled' : '❌ disabled'}.`
            )
          ]
        });
        break;
      }
    }
  }
};

export default command;
