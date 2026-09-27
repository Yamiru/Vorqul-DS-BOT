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
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import { i18n } from '../../../../utils/i18n.js';
import { GuildSettings, Reminder } from '../../../../utils/models.js';
import { resolveReminders } from '../../../../shared/featureConfig.js';
import { parseTime, discordTimestamp } from '../../../../utils/helpers.js';
import config from '../../../../config/config.json' with { type: 'json' };
import type { Command } from '../../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('Set and manage reminders')
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set a new reminder')
        .addStringOption(opt =>
          opt.setName('time').setDescription('When to remind (e.g., 10m, 1h, 1d)').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('message').setDescription('What to remind you about').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List your active reminders')
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Delete a reminder')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Reminder ID to delete').setRequired(true)
        )
    ),

  category: 'utility',

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId || 'dm';

    switch (subcommand) {
      case 'set': {
        const timeStr = interaction.options.getString('time', true);
        const message = interaction.options.getString('message', true);

        const duration = parseTime(timeStr);
        if (!duration) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Invalid time format. Use formats like: 10m, 1h, 1d')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const limits = resolveReminders(
          interaction.guildId ? await GuildSettings.findOne({ guildId: interaction.guildId }) : null
        );

        const maxDurationMs = limits.maxDurationDays * 24 * 60 * 60 * 1000;
        if (duration > maxDurationMs) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', `The longest reminder on this server is ${limits.maxDurationDays} days.`)],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const existing = await Reminder.find({ odId: interaction.user.id, sent: false });
        if (Array.isArray(existing) && existing.length >= limits.maxPerUser) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', `You already have the maximum of ${limits.maxPerUser} active reminders.`)],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const triggerAt = new Date(Date.now() + duration);

        const reminder = await Reminder.create({
          odId: interaction.user.id,
          channelId: interaction.channelId,
          guildId: interaction.guildId || undefined,
          message,
          remindAt: triggerAt
        });

        await interaction.reply({
          embeds: [
            EmbedHelper.success(
              i18n.t('reminders.set', guildId, { time: discordTimestamp.relative(triggerAt) }),
              `**Message:** ${message}\n**ID:** \`${reminder._id}\``
            )
          ]
        });
        break;
      }

      case 'list': {
        const allReminders = await Reminder.find({
          odId: interaction.user.id,
          sent: false
        });
        const reminders = allReminders
          .filter((r: any) => new Date(r.remind_at || r.remindAt) > new Date())
          .sort((a: any, b: any) => new Date(a.remind_at || a.remindAt).getTime() - new Date(b.remind_at || b.remindAt).getTime())
          .slice(0, 10);

        if (reminders.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info(i18n.t('reminders.list', guildId), i18n.t('reminders.noReminders', guildId))],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle(`⏰ ${i18n.t('reminders.list', guildId)}`)
          .setColor(config.bot.embedColor as `#${string}`)
          .setDescription(
            reminders.map((r: any, i: number) => {
              const triggerTime = new Date(r.remind_at || r.remindAt);
              return `**${i + 1}.** ${r.message.substring(0, 50)}${r.message.length > 50 ? '...' : ''}\n` +
                `   📅 ${discordTimestamp.relative(triggerTime)} | ID: \`${r._id || r.id}\``;
            }).join('\n\n')
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        break;
      }

      case 'delete': {
        const id = interaction.options.getString('id', true);

        const reminder = await Reminder.findOneAndDelete({
          _id: id,
          odId: interaction.user.id
        });

        if (!reminder) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Reminder not found or not yours.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.reply({
          embeds: [EmbedHelper.success(i18n.t('reminders.deleted', guildId))],
          flags: MessageFlags.Ephemeral
        });
        break;
      }
    }
  }
};

export default command;
