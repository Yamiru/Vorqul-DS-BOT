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
import { Poll } from '../../../utils/models.js';
import { buildPollEmbed, buildPollButtons, PollOption } from '../../modules/pollView.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll')
    .addStringOption(option =>
      option
        .setName('question')
        .setDescription('The poll question')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('options')
        .setDescription('Poll options separated by | (e.g., Option 1 | Option 2 | Option 3)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('duration')
        .setDescription('Poll duration in minutes (auto-closes with results)')
        .setMinValue(1)
        .setMaxValue(10080)
        .setRequired(false)
    ),

  category: 'fun',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const question = interaction.options.getString('question', true);
    const optionsStr = interaction.options.getString('options', true);
    const duration = interaction.options.getInteger('duration');

    const optionTexts = optionsStr.split('|').map(o => o.trim()).filter(o => o.length > 0);

    if (optionTexts.length < 2) {
      await interaction.reply({ content: 'You need at least 2 options for a poll.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (optionTexts.length > 10) {
      await interaction.reply({ content: 'Maximum 10 options allowed.', flags: MessageFlags.Ephemeral });
      return;
    }

    const endsAt = duration ? new Date(Date.now() + duration * 60 * 1000) : null;
    const options: PollOption[] = optionTexts.map(text => ({ text, votes: [] }));

    const embed = buildPollEmbed(question, options, { authorName: interaction.user.username });
    if (endsAt) embed.setTimestamp(endsAt);

    await interaction.reply({
      embeds: [embed],
      components: buildPollButtons(options)
    });

    const message = await interaction.fetchReply();

    await Poll.create({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      messageId: message.id,
      authorId: interaction.user.id,
      question,
      options,
      endsAt,
      ended: false
    });
  }
};

export default command;
