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
  GuildMember
} from 'discord.js';
import config from '../../../../config/config.json' with { type: 'json' };
import { UserData } from '../../../../utils/models.js';
import type { Command } from '../../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Get information about a user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to get info about')
        .setRequired(false)
    ),

  category: 'utility',

  execute: async (interaction: ChatInputCommandInteraction) => {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild?.members.cache.get(targetUser.id) as GuildMember | undefined;

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .setColor(member?.displayColor || (config.bot.embedColor as `#${string}`))
      .addFields(
        { name: '🏷️ Tag', value: targetUser.tag, inline: true },
        { name: '🆔 ID', value: targetUser.id, inline: true },
        { name: '🤖 Bot', value: targetUser.bot ? 'Yes' : 'No', inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true }
      )
      .setTimestamp();

    if (member) {
      embed.addFields(
        { name: '📥 Joined', value: `<t:${Math.floor(member.joinedTimestamp! / 1000)}:R>`, inline: true },
        { name: '🎨 Color', value: member.displayHexColor, inline: true }
      );

      const roles = member.roles.cache
        .filter(r => r.id !== interaction.guild!.id)
        .sort((a, b) => b.position - a.position)
        .first(10)
        .map(r => r.toString())
        .join(', ') || 'None';

      embed.addFields({ name: `🎭 Roles [${member.roles.cache.size - 1}]`, value: roles, inline: false });

      if (interaction.guild) {
        const userData = await UserData.findOne({ odId: targetUser.id, guildId: interaction.guild.id });

        if (userData) {
          embed.addFields(
            { name: '📊 Level', value: `${userData.level}`, inline: true },
            { name: '✨ XP', value: `${userData.totalXp}`, inline: true },
            { name: '💬 Messages', value: `${userData.messages}`, inline: true },
            { name: '💰 Balance', value: `${userData.balance}`, inline: true },
            { name: '⚠️ Warnings', value: `${userData.warnings.length}`, inline: true }
          );
        }
      }
    }

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
