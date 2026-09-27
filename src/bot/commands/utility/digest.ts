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
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { UserData, WeeklyDigest } from '../../../utils/models.js';
import { formatNumber } from '../../../utils/helpers.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('digest')
    .setDescription('Weekly server digest')
    .addSubcommand(sub =>
      sub.setName('view').setDescription('View this week\'s digest')
    )
    .addSubcommand(sub =>
      sub
        .setName('generate')
        .setDescription('Generate weekly digest (Admin)')
    ),

  category: 'utility',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;

    switch (subcommand) {
      case 'view': {
        const weekStart = getWeekStart(new Date());

        let digest = await WeeklyDigest.findOne({ guildId, weekStart });

        if (!digest) {
          digest = await generateDigest(guildId, guild);
        }

        const embed = new EmbedBuilder()
          .setTitle('📰 Weekly Server Digest')
          .setDescription(`Week of ${weekStart.toLocaleDateString()}`)
          .setColor(config.bot.embedColor as `#${string}`)
          .addFields(
            { name: '💬 Total Messages', value: formatNumber(digest.totalMessages), inline: true },
            { name: '👥 Active Users', value: formatNumber(digest.activeUsers), inline: true },
            { name: '📈 New Members', value: `+${digest.newMembers}`, inline: true },
            { name: '📉 Left Members', value: `-${digest.leftMembers}`, inline: true }
          )
          .setTimestamp();

        if (digest.topChannels && digest.topChannels.length > 0) {
          embed.addFields({
            name: '🔥 Most Active Channels',
            value: digest.topChannels.slice(0, 5).map((c: any, i: number) =>
              `${i + 1}. <#${c.channelId}> (${formatNumber(c.messages)} msgs)`
            ).join('\n'),
            inline: false
          });
        }

        if (digest.topUsers && digest.topUsers.length > 0) {
          embed.addFields({
            name: '⭐ Most Active Users',
            value: digest.topUsers.slice(0, 5).map((u: any, i: number) =>
              `${i + 1}. <@${u.odId}> (${formatNumber(u.messages)} msgs)`
            ).join('\n'),
            inline: false
          });
        }

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'generate': {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.reply({
            content: 'You need Manage Server permission.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.deferReply();

        const digest = await generateDigest(guildId, guild);

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ Digest Generated')
              .setDescription(
                `**Messages:** ${formatNumber(digest.totalMessages)}\n` +
                `**Active Users:** ${formatNumber(digest.activeUsers)}\n` +
                `**New Members:** +${digest.newMembers}\n` +
                `**Left Members:** -${digest.leftMembers}`
              )
              .setColor('#57F287')
          ]
        });
        break;
      }
    }
  }
};

async function generateDigest(guildId: string, guild: any) {
  const weekStart = getWeekStart(new Date());

  const activeUsers = await UserData.find({
    guildId,
    updatedAt: { $gte: weekStart }
  });

  const topUsers = activeUsers
    .filter(u => u.messages > 0)
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 10)
    .map(u => ({ odId: u.odId, messages: u.messages }));

  const newMembers = guild.members.cache.filter(
    (m: any) => m.joinedTimestamp && m.joinedTimestamp >= weekStart.getTime()
  ).size;

  const totalMessages = activeUsers.reduce((sum, u) => sum + u.messages, 0);

  const digestData = {
    guildId,
    weekStart,
    totalMessages,
    activeUsers: activeUsers.length,
    newMembers,
    leftMembers: 0,
    topChannels: [],
    topUsers,
    highlights: []
  };

  await WeeklyDigest.findOneAndUpdate(
    { guildId, weekStart },
    digestData,
    { upsert: true }
  );

  return digestData;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default command;
