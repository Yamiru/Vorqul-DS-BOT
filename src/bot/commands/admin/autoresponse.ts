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
    .setName('autoresponse')
    .setDescription('Manage auto-responses')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add an auto-response')
        .addStringOption(opt =>
          opt.setName('trigger')
            .setDescription('Text that triggers the response')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('response')
            .setDescription('Bot response')
            .setRequired(true)
        )
        .addBooleanOption(opt =>
          opt.setName('regex')
            .setDescription('Use RegEx?')
        )
        .addBooleanOption(opt =>
          opt.setName('delete_trigger')
            .setDescription('Delete the trigger message?')
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove an auto-response')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('ID odpovede')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Show all auto-responses')
    )
    .addSubcommand(sub =>
      sub.setName('toggle')
        .setDescription('Enable/disable a response')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('ID odpovede')
            .setRequired(true)
        )
    ),

  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const db = getDatabase();

    if (subcommand === 'add') {
      const trigger = interaction.options.getString('trigger', true);
      const response = interaction.options.getString('response', true);
      const useRegex = interaction.options.getBoolean('regex') || false;
      const deleteTrigger = interaction.options.getBoolean('delete_trigger') || false;

      if (useRegex) {
        try {
          new RegExp(trigger);
        } catch {
          return interaction.reply({
            content: '❌ Invalid RegEx expression.',
            flags: MessageFlags.Ephemeral
          });
        }
      }

      const id = await db.insert('auto_responses', {
        guild_id: interaction.guildId,
        trigger_text: trigger,
        response: response,
        use_regex: useRegex ? 1 : 0,
        delete_trigger: deleteTrigger ? 1 : 0,
        enabled: 1
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Auto Response added')
            .addFields(
              { name: 'ID', value: `${id}`, inline: true },
              { name: 'Trigger', value: `\`${trigger}\``, inline: true },
              { name: 'RegEx', value: useRegex ? 'Yes' : 'Nie', inline: true },
              { name: 'Reply', value: response.substring(0, 100) }
            )
            .setColor(0x00FF00)
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'remove') {
      const id = interaction.options.getInteger('id', true);

      const deleted = await db.delete('auto_responses', {
        id: id,
        guild_id: interaction.guildId
      });

      if (!deleted) {
        return interaction.reply({
          content: '❌ An auto response with this ID does not exist.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.reply({
        content: `✅ Auto response #${id} has been removed.`,
        flags: MessageFlags.Ephemeral
      });
    }

    else if (subcommand === 'list') {
      const responses = await db.find('auto_responses', { guild_id: interaction.guildId });

      if (responses.length === 0) {
        return interaction.reply({
          content: '📭 No auto responses.',
          flags: MessageFlags.Ephemeral
        });
      }

      const lines = responses.map((r: any) => {
        const status = r.enabled ? '✅' : '❌';
        const regex = r.use_regex ? '📝' : '';
        return `${status} **#${r.id}** ${regex} \`${r.trigger_text.substring(0, 30)}\` → ${r.response.substring(0, 30)}...`;
      });

      const embed = new EmbedBuilder()
        .setTitle('🤖 Auto Responses')
        .setDescription(lines.join('\n'))
        .setFooter({ text: '📝 = RegEx' })
        .setColor(0x3498DB);

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    else if (subcommand === 'toggle') {
      const id = interaction.options.getInteger('id', true);

      const ar = await db.findOne('auto_responses', {
        id: id,
        guild_id: interaction.guildId
      });

      if (!ar) {
        return interaction.reply({
          content: '❌ Auto response neexistuje.',
          flags: MessageFlags.Ephemeral
        });
      }

      const newState = !ar.enabled;
      await db.update('auto_responses', { enabled: newState ? 1 : 0 }, { id });

      await interaction.reply({
        content: `${newState ? '✅' : '❌'} Auto response #${id} is now ${newState ? 'enabled' : 'disabled'}.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
