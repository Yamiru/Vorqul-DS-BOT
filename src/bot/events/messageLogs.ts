/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Message, EmbedBuilder, TextChannel, PartialMessage, GuildTextBasedChannel } from 'discord.js';
import { GuildSettings } from '../../utils/models.js';
import { resolveLogging } from '../../shared/featureConfig.js';
import { logger } from '../../utils/logger.js';

export default function messageLogsHandler(client: Client) {
  client.on('messageUpdate', async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    try {
      const settings = await GuildSettings.findOne({ guildId: oldMessage.guild.id });
      const logs = resolveLogging(settings);

      if (!logs.enabled || !logs.channels.messages) return;
      if (logs.events.messageEdit === false) return;
      if (logs.blacklistChannels.includes(oldMessage.channel.id)) return;

      const logChannel = oldMessage.guild.channels.cache.get(logs.channels.messages) as TextChannel;
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('✏️ Message edited')
        .setAuthor({
          name: oldMessage.author?.username || 'Unknown',
          iconURL: oldMessage.author?.displayAvatarURL()
        })
        .addFields(
          { name: 'Channel', value: `<#${oldMessage.channel.id}>`, inline: true },
          { name: 'Autor', value: `<@${oldMessage.author?.id}>`, inline: true },
          { name: '📤 Original message', value: (oldMessage.content || '*empty*').substring(0, 1000) },
          { name: '📥 New message', value: (newMessage.content || '*empty*').substring(0, 1000) }
        )
        .setColor(0xFFFF00)
        .setTimestamp()
        .setFooter({ text: `Message ID: ${oldMessage.id}` });

      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Message edit log error:', error);
    }
  });

  client.on('messageDelete', async (message: Message | PartialMessage) => {
    if (!message.guild || message.author?.bot) return;

    try {
      const settings = await GuildSettings.findOne({ guildId: message.guild.id });
      const logs = resolveLogging(settings);

      if (!logs.enabled || !logs.channels.messages) return;
      if (logs.events.messageDelete === false) return;
      if (logs.blacklistChannels?.includes(message.channel.id)) return;

      const logChannel = message.guild.channels.cache.get(logs.channels.messages) as TextChannel;
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Message deleted')
        .setAuthor({
          name: message.author?.username || 'Unknown',
          iconURL: message.author?.displayAvatarURL()
        })
        .addFields(
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Autor', value: message.author ? `<@${message.author.id}>` : 'Unknown', inline: true },
          { name: '📝 Content', value: (message.content || '*empty/media*').substring(0, 1000) }
        )
        .setColor(0xFF0000)
        .setTimestamp()
        .setFooter({ text: `Message ID: ${message.id}` });

      if (message.attachments.size > 0) {
        const attachments = message.attachments.map(a => a.url).join('\n');
        embed.addFields({ name: '📎 Attachments', value: attachments.substring(0, 1000) });
      }

      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Message delete log error:', error);
    }
  });

  client.on('messageDeleteBulk', async (messages, _channel: GuildTextBasedChannel) => {
    const firstMessage = messages.first();
    if (!firstMessage?.guild) return;

    try {
      const settings = await GuildSettings.findOne({ guildId: firstMessage.guild.id });
      const logs = resolveLogging(settings);

      if (!logs.enabled || !logs.channels.messages) return;
      if (logs.events.messageBulkDelete === false) return;

      const logChannel = firstMessage.guild.channels.cache.get(logs.channels.messages) as TextChannel;
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Bulk message deletion')
        .addFields(
          { name: 'Channel', value: `<#${firstMessage.channel.id}>`, inline: true },
          { name: 'Message count', value: `${messages.size}`, inline: true }
        )
        .setColor(0xFF0000)
        .setTimestamp();

      const logContent = [...messages.values()]
        .reverse()
        .map((m: any) => `[${m.createdAt?.toISOString()}] ${m.author?.tag || 'Unknown'}: ${m.content || '*media*'}`)
        .join('\n');

      if (logContent.length > 0) {
        const buffer = Buffer.from(logContent, 'utf-8');
        await logChannel.send({
          embeds: [embed],
          files: [{
            attachment: buffer,
            name: `bulk_delete_${Date.now()}.txt`
          }]
        });
      } else {
        await logChannel.send({ embeds: [embed] });
      }
    } catch (error) {
      logger.error('Bulk delete log error:', error);
    }
  });
}
