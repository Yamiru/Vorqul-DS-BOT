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
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import { ScheduledMessage } from '../../../../utils/models.js';
import { parseTime, discordTimestamp } from '../../../../utils/helpers.js';
import config from '../../../../config/config.json' with { type: 'json' };
import type { Command } from '../../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Schedule messages')
    .addSubcommand(sub =>
      sub
        .setName('message')
        .setDescription('Schedule a message')
        .addStringOption(opt =>
          opt.setName('content').setDescription('Message content').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('time').setDescription('When to send (e.g., 1h, 1d, or YYYY-MM-DD HH:MM)').setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Target channel').setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('recurring')
            .setDescription('Repeat schedule')
            .setRequired(false)
            .addChoices(
              { name: 'Daily', value: 'daily' },
              { name: 'Weekly', value: 'weekly' },
              { name: 'Monthly', value: 'monthly' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List scheduled messages')
    )
    .addSubcommand(sub =>
      sub
        .setName('cancel')
        .setDescription('Cancel a scheduled message')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Message ID').setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  category: 'utility',
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageMessages],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    switch (subcommand) {
      case 'message': {
        const content = interaction.options.getString('content', true);
        const timeStr = interaction.options.getString('time', true);
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const recurring = interaction.options.getString('recurring') as 'daily' | 'weekly' | 'monthly' | null;

        let scheduledFor: Date;

        const relativeMs = parseTime(timeStr);
        if (relativeMs) {
          scheduledFor = new Date(Date.now() + relativeMs);
        } else {
          const parsed = Date.parse(timeStr);
          if (isNaN(parsed)) {
            await interaction.reply({
              embeds: [EmbedHelper.error('Invalid Time', 'Use format: 1h, 1d, or YYYY-MM-DD HH:MM')],
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          scheduledFor = new Date(parsed);
        }

        if (scheduledFor <= new Date()) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Invalid Time', 'Scheduled time must be in the future.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const scheduled = await ScheduledMessage.create({
          guildId,
          channelId: channel!.id,
          content,
          scheduledFor,
          recurring,
          createdBy: interaction.user.id,
          sent: false
        });

        await interaction.reply({
          embeds: [
            EmbedHelper.success(
              '⏰ Message Scheduled',
              `**Content:** ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}\n` +
              `**Channel:** ${channel}\n` +
              `**Scheduled for:** ${discordTimestamp.longDateTime(scheduledFor)}\n` +
              `**Recurring:** ${recurring || 'No'}\n` +
              `**ID:** \`${scheduled._id}\``
            )
          ]
        });
        break;
      }

      case 'list': {
        const allMessages = await ScheduledMessage.find({
          guildId,
          sent: false
        });
        const messages = allMessages
          .sort((a: any, b: any) => new Date(a.scheduled_for || a.scheduledFor).getTime() - new Date(b.scheduled_for || b.scheduledFor).getTime())
          .slice(0, 10);

        if (messages.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Scheduled Messages', 'No scheduled messages.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('⏰ Scheduled Messages')
          .setColor(config.bot.embedColor as `#${string}`)
          .setDescription(
            messages.map((m: any, i: number) => {
              const scheduledTime = new Date(m.scheduled_for || m.scheduledFor);
              return `**${i + 1}.** ${m.content.substring(0, 50)}...\n` +
                `   📅 ${discordTimestamp.relative(scheduledTime)} | <#${m.channel_id || m.channelId}>\n` +
                `   🔄 ${m.recurring || 'One-time'} | ID: \`${m._id || m.id}\``;
            }).join('\n\n')
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        break;
      }

      case 'cancel': {
        const id = interaction.options.getString('id', true);

        const result = await ScheduledMessage.findOneAndDelete({
          _id: id,
          guildId,
          sent: false
        });

        if (!result) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Scheduled message not found or already sent.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.reply({
          embeds: [EmbedHelper.success('Cancelled', 'Scheduled message has been cancelled.')],
          flags: MessageFlags.Ephemeral
        });
        break;
      }
    }
  }
};

export default command;
