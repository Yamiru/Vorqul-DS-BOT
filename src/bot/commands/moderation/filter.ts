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
import { getDatabase } from '../../../utils/database.js';
import { GuildSettings } from '../../../utils/models.js';

export default {
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Manage the banned-word filter')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Pridaj slovo do filtra')
        .addStringOption(opt =>
          opt.setName('slovo')
            .setDescription('Slovo na filtrovanie')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a word from the filter')
        .addStringOption(opt =>
          opt.setName('slovo')
            .setDescription('Word to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Show all filtered words')
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Clear all filtered words')
    )
    .addSubcommand(sub =>
      sub.setName('settings')
        .setDescription('Nastavenia filtra')
        .addStringOption(opt =>
          opt.setName('akcia')
            .setDescription('Akcia pri detekcii')
            .addChoices(
              { name: 'Delete message', value: 'delete' },
              { name: 'Delete + Warning', value: 'warn' },
              { name: 'Delete + Mute', value: 'mute' }
            )
        )
        .addRoleOption(opt =>
          opt.setName('bypass')
            .setDescription('Role that bypasses the filter')
        )
        .addChannelOption(opt =>
          opt.setName('log')
            .setDescription('Channel for filter logs')
        )
    ),

  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const db = getDatabase();

    if (subcommand === 'add') {
      const word = interaction.options.getString('slovo', true).toLowerCase();

      const existing = await db.findOne('filter_words', {
        guild_id: interaction.guildId,
        word: word
      });

      if (existing) {
        return interaction.reply({
          content: '❌ This word is already in the filter.',
          flags: MessageFlags.Ephemeral
        });
      }

      await db.insert('filter_words', {
        guild_id: interaction.guildId,
        word: word
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Word added')
            .setDescription(`\`${word}\` has been added to the filter.`)
            .setColor(0x00FF00)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'remove') {
      const word = interaction.options.getString('slovo', true).toLowerCase();

      const deleted = await db.delete('filter_words', {
        guild_id: interaction.guildId,
        word: word
      });

      if (!deleted) {
        return interaction.reply({
          content: '❌ Toto slovo nie je vo filtri.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Word removed')
            .setDescription(`\`${word}\` has been removed from the filter.`)
            .setColor(0x00FF00)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'list') {
      const words = await db.find('filter_words', { guild_id: interaction.guildId });

      if (words.length === 0) {
        return interaction.reply({
          content: '📭 The filter is empty.',
          flags: MessageFlags.Ephemeral
        });
      }

      const wordList = words.map((w: any) => `\`${w.word}\``).join(', ');

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🚫 Filtered words')
            .setDescription(wordList.length > 4000 ?
              wordList.substring(0, 4000) + '...' : wordList)
            .setFooter({ text: `Celkom: ${words.length} slov` })
            .setColor(0xFF6B6B)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'clear') {
      await db.delete('filter_words', { guild_id: interaction.guildId });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🗑️ Filter cleared')
            .setDescription('All words have been removed from the filter.')
            .setColor(0xFF6B6B)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'settings') {
      const action = interaction.options.getString('akcia');
      const bypassRole = interaction.options.getRole('bypass');
      const logChannel = interaction.options.getChannel('log');

      const settings = await GuildSettings.findOne({ guildId: interaction.guildId }) || {};
      const filterConfig = settings.filter || { enabled: true };

      if (action) filterConfig.action = action;
      if (bypassRole) filterConfig.bypassRole = bypassRole.id;
      if (logChannel) filterConfig.logChannel = logChannel.id;

      await GuildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { filter: filterConfig } },
        { upsert: true }
      );

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Nastavenia filtra')
        .setColor(0x3498DB);

      if (action) embed.addFields({ name: 'Akcia', value: action, inline: true });
      if (bypassRole) embed.addFields({ name: 'Bypass rola', value: `<@&${bypassRole.id}>`, inline: true });
      if (logChannel) embed.addFields({ name: 'Log channel', value: `<#${logChannel.id}>`, inline: true });

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }
};
