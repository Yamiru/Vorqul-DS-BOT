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
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { getDatabase } from '../../../utils/database.js';
import { GuildSettings } from '../../../utils/models.js';
import { resolveSuggestions } from '../../../shared/featureConfig.js';
import { logger } from '../../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Suggestion system')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new suggestion')
        .addStringOption(opt =>
          opt.setName('navrh')
            .setDescription('Your suggestion')
            .setRequired(true)
            .setMaxLength(2000)
        )
        .addBooleanOption(opt =>
          opt.setName('anonymne')
            .setDescription('Hide your name (only if the server allows it)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('accept')
        .setDescription('Accept a suggestion')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('Suggestion ID')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('poznamka')
            .setDescription('Note')
        )
    )
    .addSubcommand(sub =>
      sub.setName('deny')
        .setDescription('Reject a suggestion')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('Suggestion ID')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('dovod')
            .setDescription('Reason for rejection')
        )
    )
    .addSubcommand(sub =>
      sub.setName('implement')
        .setDescription('Mark a suggestion as implemented')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('Suggestion ID')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('note')
        .setDescription('Add a note to a suggestion')
        .addIntegerOption(opt =>
          opt.setName('id')
            .setDescription('Suggestion ID')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('poznamka')
            .setDescription('Note')
            .setRequired(true)
        )
    ),

  category: 'utility',
  cooldown: 15,

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const db = getDatabase();

    const settings = await GuildSettings.findOne({ guildId: interaction.guildId });
    const suggestionsConfig: any = { ...(settings?.suggestions || {}), ...resolveSuggestions(settings) };

    if (!suggestionsConfig.enabled) {
      return interaction.reply({
        content: '❌ The suggestion system is not enabled on this server.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (subcommand === 'create') {
      const content = interaction.options.getString('navrh', true);
      const channelId = suggestionsConfig.channel;

      if (!channelId) {
        return interaction.reply({
          content: '❌ The suggestions channel is not set. Contact an administrator.',
          flags: MessageFlags.Ephemeral
        });
      }

      const channel = interaction.guild?.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) {
        return interaction.reply({
          content: '❌ The suggestions channel does not exist.',
          flags: MessageFlags.Ephemeral
        });
      }

      const id = await db.insert('suggestions', {
        guild_id: interaction.guildId,
        author_id: interaction.user.id,
        content: content,
        status: 'pending',
        upvotes: 0,
        downvotes: 0
      });

      const anonymous = suggestionsConfig.anonymousAllowed
        && (interaction.options.getBoolean('anonymne') ?? false);

      const embed = new EmbedBuilder()
        .setTitle(`💡 Suggestion #${id}`)
        .setDescription(content)
        .setColor(0xFFD700)
        .addFields(
          { name: '👤 Autor', value: anonymous ? 'Anonym' : `<@${interaction.user.id}>`, inline: true },
          { name: '📊 Stav', value: '🟡 Awaiting approval', inline: true },
          { name: '👍 Hlasy', value: '0 za | 0 proti', inline: true }
        )
        .setFooter({ text: `ID: ${id}` })
        .setTimestamp();

      const buttons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`suggest_upvote_${id}`)
            .setLabel(`${suggestionsConfig.upvoteEmoji} Za`)
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`suggest_downvote_${id}`)
            .setLabel(`${suggestionsConfig.downvoteEmoji} Proti`)
            .setStyle(ButtonStyle.Danger)
        );

      const msg = await (channel as any).send({ embeds: [embed], components: [buttons] });

      await db.update('suggestions', { message_id: msg.id }, { id });

      if (suggestionsConfig.autoThread) {
        try {
          await msg.startThread({
            name: `Suggestion #${id}`.slice(0, 100),
            autoArchiveDuration: 1440
          });
        } catch (error) {
            logger.debug('suggest: suppressed error', error);
          }
      }

      await interaction.reply({
        content: `✅ Your suggestion #${id} was created!`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (['accept', 'deny', 'implement', 'note'].includes(subcommand)) {
      const member = interaction.member as any;
      const staffRole = suggestionsConfig.staffRole;

      const hasPermission = member.permissions.has(PermissionFlagsBits.ManageGuild) ||
        (staffRole && member.roles.cache.has(staffRole));

      if (!hasPermission) {
        return interaction.reply({
          content: '❌ You do not have permission to manage suggestions.',
          flags: MessageFlags.Ephemeral
        });
      }

      const id = interaction.options.getInteger('id', true);
      const suggestion = await db.findOne('suggestions', { id, guild_id: interaction.guildId });

      if (!suggestion) {
        return interaction.reply({
          content: '❌ A suggestion with this ID does not exist.',
          flags: MessageFlags.Ephemeral
        });
      }

      let newStatus = suggestion.status;
      let statusEmoji = '🟡';
      let statusText = 'Awaiting approval';

      if (subcommand === 'accept') {
        newStatus = 'accepted';
        statusEmoji = '✅';
        statusText = 'Accepted';
      } else if (subcommand === 'deny') {
        newStatus = 'denied';
        statusEmoji = '❌';
        statusText = 'Rejected';
      } else if (subcommand === 'implement') {
        newStatus = 'implemented';
        statusEmoji = '🎉';
        statusText = 'Implemented';
      }

      const note = interaction.options.getString('poznamka') ||
                   interaction.options.getString('dovod') ||
                   suggestion.staff_note;

      await db.update('suggestions', {
        status: newStatus,
        staff_note: note,
        staff_id: interaction.user.id
      }, { id });

      if (suggestion.message_id) {
        try {
          const channel = interaction.guild?.channels.cache.get(suggestionsConfig.channel);
          if (channel && channel.isTextBased()) {
            const msg = await (channel as any).messages.fetch(suggestion.message_id);
            const embed = EmbedBuilder.from(msg.embeds[0])
              .setColor(newStatus === 'accepted' ? 0x00FF00 :
                       newStatus === 'denied' ? 0xFF0000 :
                       newStatus === 'implemented' ? 0x9B59B6 : 0xFFD700)
              .spliceFields(1, 1, {
                name: '📊 Stav',
                value: `${statusEmoji} ${statusText}`,
                inline: true
              });

            if (note) {
              embed.addFields({ name: '📝 Note', value: note });
            }

            await msg.edit({ embeds: [embed] });
          }
        } catch (e) {
            logger.debug('suggest: suppressed error', e);
          }
      }

      await interaction.reply({
        content: `✅ Suggestion #${id} was updated to: ${statusEmoji} ${statusText}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
