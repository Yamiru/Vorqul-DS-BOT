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
  TextChannel,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { GuildSettings } from '../../../utils/models.js';
import type { Command } from '../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('appeal')
    .setDescription('Submit an appeal for a warning, mute or other moderation action')
    .addStringOption(o => o.setName('reason').setDescription('Explain why the action should be reviewed').setRequired(true).setMaxLength(1000))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  category: 'moderation',
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const reason = interaction.options.getString('reason', true);
    const settings: any = await GuildSettings.findOne({ guildId: interaction.guildId! });
    const channelId = settings?.moderation?.appealsChannel;

    if (!channelId) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Appeals not set up', 'An administrator needs to set an **Appeals channel** in the dashboard (Moderation settings).')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const channel = interaction.guild!.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel) {
      await interaction.reply({
        embeds: [EmbedHelper.error('Error', 'The configured appeals channel no longer exists.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📨 New appeal')
      .setColor('#5865f2')
      .setDescription(`**From:** ${interaction.user} (${interaction.user.id})\n\n**Appeal:**\n${reason}`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
    } catch {
      await interaction.reply({ embeds: [EmbedHelper.error('Error', 'I could not post to the appeals channel (missing permissions).')], flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({
      embeds: [EmbedHelper.success('Appeal submitted', 'Your appeal has been sent to the staff team. Please be patient.')],
      flags: MessageFlags.Ephemeral
    });
  }
};

export default command;
