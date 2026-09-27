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
import { AfkStatus } from '../../../utils/models.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set your AFK status')
    .addStringOption(opt =>
      opt.setName('reason').setDescription('AFK reason').setRequired(false)
    ),

  category: 'utility',

  execute: async (interaction: ChatInputCommandInteraction) => {
    const reason = interaction.options.getString('reason') || 'AFK';
    const odId = interaction.user.id;
    const guildId = interaction.guildId;

    const existing = await AfkStatus.findOne({ odId, guildId });

    if (existing) {
      await AfkStatus.deleteOne({ odId, guildId });

      await interaction.reply({
        embeds: [EmbedHelper.success('Welcome Back!', 'Your AFK status has been removed.')],
        flags: MessageFlags.Ephemeral
      });
    } else {
      await AfkStatus.create({
        odId,
        guildId,
        reason,
        setAt: new Date()
      });

      await interaction.reply({
        embeds: [
          EmbedHelper.info(
            '💤 AFK Set',
            `I'll let others know you're AFK.\n**Reason:** ${reason}`
          )
        ]
      });
    }
  }
};

export default command;
