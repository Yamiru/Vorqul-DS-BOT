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
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { getDatabase } from '../../../utils/database.js';
import type { Command } from '../../types.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

interface BirthdayRow { guild_id: string; user_id: string; day: number; month: number; year?: number | null; }

function nextOccurrence(day: number, month: number): Date {
  const now = new Date();
  let year = now.getFullYear();
  let d = new Date(year, month - 1, day);
  if (d.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
    year += 1;
    d = new Date(year, month - 1, day);
  }
  return d;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Save your birthday and let the server celebrate it')
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set your birthday')
        .addIntegerOption(opt => opt.setName('day').setDescription('Day (1-31)').setRequired(true).setMinValue(1).setMaxValue(31))
        .addIntegerOption(opt => opt.setName('month').setDescription('Month (1-12)').setRequired(true).setMinValue(1).setMaxValue(12))
        .addIntegerOption(opt => opt.setName('year').setDescription('Year (optional, shows your age)').setMinValue(1900).setMaxValue(2025))
    )
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove your saved birthday'))
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View a birthday')
        .addUserOption(opt => opt.setName('user').setDescription('Whose birthday (defaults to you)'))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('Upcoming birthdays on this server')),

  category: 'utility',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const db = getDatabase();
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const day = interaction.options.getInteger('day', true);
      const month = interaction.options.getInteger('month', true);
      const year = interaction.options.getInteger('year') ?? null;

      if (day > DAYS_IN_MONTH[month - 1]) {
        await interaction.reply({ embeds: [EmbedHelper.error('Invalid date', `${MONTHS[month - 1]} does not have ${day} days.`)], flags: MessageFlags.Ephemeral });
        return;
      }

      await db.upsert('birthdays',
        { guild_id: guildId, user_id: interaction.user.id, day, month, year },
        ['guild_id', 'user_id']
      );

      const label = `${day} ${MONTHS[month - 1]}${year ? ` ${year}` : ''}`;
      await interaction.reply({ embeds: [EmbedHelper.success('Birthday saved', `I will remember your birthday: **${label}** 🎂`)], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'remove') {
      await db.delete('birthdays', { guild_id: guildId, user_id: interaction.user.id });
      await interaction.reply({ embeds: [EmbedHelper.success('Birthday removed', 'Your birthday has been forgotten.')], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'view') {
      const user = interaction.options.getUser('user') ?? interaction.user;
      const row = await db.findOne<BirthdayRow>('birthdays', { guild_id: guildId, user_id: user.id });
      if (!row) {
        await interaction.reply({ embeds: [EmbedHelper.info('No birthday set', `${user} has not set a birthday yet.`)], flags: MessageFlags.Ephemeral });
        return;
      }
      const label = `${row.day} ${MONTHS[row.month - 1]}${row.year ? ` ${row.year}` : ''}`;
      const next = nextOccurrence(row.day, row.month);
      const days = Math.ceil((next.getTime() - Date.now()) / 86400000);
      await interaction.reply({ embeds: [EmbedHelper.info(`🎂 ${user.username}'s birthday`, `**${label}**\nNext celebration: <t:${Math.floor(next.getTime() / 1000)}:D> (${days === 0 ? 'today!' : `in ${days} day(s)`})`)] });
      return;
    }

    const rows = await db.find<BirthdayRow>('birthdays', { guild_id: guildId });
    if (!rows || rows.length === 0) {
      await interaction.reply({ embeds: [EmbedHelper.info('No birthdays yet', 'Be the first - use `/birthday set`.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const upcoming = rows
      .map(r => ({ r, next: nextOccurrence(r.day, r.month) }))
      .sort((a, b) => a.next.getTime() - b.next.getTime())
      .slice(0, 15)
      .map(({ r, next }) => `<@${r.user_id}> - ${r.day} ${MONTHS[r.month - 1]} (<t:${Math.floor(next.getTime() / 1000)}:R>)`);

    await interaction.reply({ embeds: [EmbedHelper.info('🎂 Upcoming birthdays', upcoming.join('\n'))] });
  }
};

export default command;
