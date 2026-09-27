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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { GuildSettings } from '../../../utils/models.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('confess')
    .setDescription('Send an anonymous confession to the server'),

  category: 'utility',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const settings = await GuildSettings.findOne({ guildId });
    const cfg: any = (settings as any)?.confessions;

    if (!cfg || cfg.enabled !== true || !cfg.channel) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Confessions are off', 'An admin needs to enable confessions and pick a channel in the dashboard.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (Array.isArray(cfg.blockedUsers) && cfg.blockedUsers.includes(interaction.user.id)) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Not allowed', 'You are not allowed to use confessions on this server.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (cfg.minAccountAgeDays && cfg.minAccountAgeDays > 0) {
      const ageDays = (Date.now() - interaction.user.createdTimestamp) / 86400000;
      if (ageDays < cfg.minAccountAgeDays) {
        await interaction.reply({
          embeds: [EmbedHelper.error('Account too new', `Your account must be at least ${cfg.minAccountAgeDays} day(s) old to use confessions.`)],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }

    const modal = new ModalBuilder().setCustomId('confess_modal').setTitle('Anonymous confession');
    const input = new TextInputBuilder()
      .setCustomId('confess_text')
      .setLabel('Your confession (stays anonymous)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1500);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

    await interaction.showModal(modal);
  }
};

export default command;
