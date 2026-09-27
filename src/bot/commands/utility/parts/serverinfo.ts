/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import config from '../../../../config/config.json' with { type: 'json' };
import type { Command } from '../../../types.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Get information about the server'),

  category: 'utility',

  cooldown: 5,
  guildOnly: true,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guild = interaction.guild!;
    await guild.fetch();

    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

    const roles = guild.roles.cache.size;
    const emojis = guild.emojis.cache.size;
    const stickers = guild.stickers.cache.size;

    const boostLevel = guild.premiumTier;
    const boostCount = guild.premiumSubscriptionCount || 0;

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }) || '')
      .setColor(config.bot.embedColor as `#${string}`)
      .addFields(
        { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '🌍 Region', value: guild.preferredLocale, inline: true },
        { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
        { name: '💬 Channels', value: `Text: ${textChannels}\nVoice: ${voiceChannels}\nCategories: ${categories}`, inline: true },
        { name: '🎭 Roles', value: `${roles}`, inline: true },
        { name: '😀 Emojis', value: `${emojis}`, inline: true },
        { name: '🏷️ Stickers', value: `${stickers}`, inline: true },
        { name: '🚀 Boosts', value: `Level ${boostLevel} (${boostCount} boosts)`, inline: true }
      )
      .setFooter({ text: `ID: ${guild.id}` })
      .setTimestamp();

    if (guild.banner) {
      embed.setImage(guild.bannerURL({ size: 1024 }) || '');
    }

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
