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

export default {
  data: new SlashCommandBuilder()
    .setName('levelroles')
    .setDescription('Manage level roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Pridaj level rolu')
        .addIntegerOption(opt =>
          opt.setName('level')
            .setDescription('Level required for the role')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1000)
        )
        .addRoleOption(opt =>
          opt.setName('rola')
            .setDescription('Rola na pridanie')
            .setRequired(true)
        )
        .addBooleanOption(opt =>
          opt.setName('remove_previous')
            .setDescription('Remove previous level roles?')
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a level role')
        .addIntegerOption(opt =>
          opt.setName('level')
            .setDescription('Level')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Show all level roles')
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Clear all level roles')
    ),

  permissions: [PermissionFlagsBits.ManageRoles],

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const db = getDatabase();

    if (subcommand === 'add') {
      const level = interaction.options.getInteger('level', true);
      const role = interaction.options.getRole('rola', true);
      const removePrevious = interaction.options.getBoolean('remove_previous') || false;

      const existing = await db.findOne('level_roles', {
        guild_id: interaction.guildId,
        level: level
      });

      if (existing) {
        await db.update('level_roles', {
          role_id: role.id,
          remove_previous: removePrevious ? 1 : 0
        }, { id: existing.id });
      } else {
        await db.insert('level_roles', {
          guild_id: interaction.guildId,
          level: level,
          role_id: role.id,
          remove_previous: removePrevious ? 1 : 0
        });
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Level role added')
            .setDescription(`Level **${level}** → ${role}`)
            .addFields({
              name: 'Remove previous',
              value: removePrevious ? 'Yes' : 'Nie',
              inline: true
            })
            .setColor(0x00FF00)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'remove') {
      const level = interaction.options.getInteger('level', true);

      const deleted = await db.delete('level_roles', {
        guild_id: interaction.guildId,
        level: level
      });

      if (!deleted) {
        return interaction.reply({
          content: '❌ Level rola pre tento level neexistuje.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.reply({
        content: `✅ Level rola pre level **${level}** has been removed.`,
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'list') {
      const roles = await db.find('level_roles', { guild_id: interaction.guildId });

      if (roles.length === 0) {
        return interaction.reply({
          content: '📭 No level roles are set up.',
          flags: MessageFlags.Ephemeral
        });
      }

      roles.sort((a: any, b: any) => a.level - b.level);

      const lines = roles.map((r: any) => {
        const removeIcon = r.remove_previous ? '🔄' : '';
        return `Level **${r.level}** → <@&${r.role_id}> ${removeIcon}`;
      });

      const embed = new EmbedBuilder()
        .setTitle('📊 Level Role')
        .setDescription(lines.join('\n'))
        .setFooter({ text: '🔄 = removes previous level roles' })
        .setColor(0x9B59B6);

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    else if (subcommand === 'clear') {
      await db.delete('level_roles', { guild_id: interaction.guildId });

      await interaction.reply({
        content: '🗑️ All level roles have been deleted.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
