/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Message, EmbedBuilder } from 'discord.js';
import { GuildSettings } from '../../utils/models.js';
import { featureAllowed } from '../modules/channelGuard.js';
import { logger } from '../../utils/logger.js';
import { suppress } from '../../utils/suppress.js';

const guildLocks = new Map<string, Promise<void>>();

function withGuildLock(guildId: string, task: () => Promise<void>): void {
  const previous = guildLocks.get(guildId) || Promise.resolve();
  const next = previous.then(task, task);
  guildLocks.set(guildId, next.finally(() => {
    if (guildLocks.get(guildId) === next) guildLocks.delete(guildId);
  }));
}

export default function countingHandler(client: Client) {
  client.on('messageCreate', (message: Message) => {
    if (message.author.bot || !message.guild) return;
    const guildId = message.guild.id;

    withGuildLock(guildId, () => processCountingMessage(message, guildId));
  });
}

async function processCountingMessage(message: Message, guildId: string): Promise<void> {
    try {
      const settings = await GuildSettings.findOne({ guildId });
      const counting = settings?.modules?.counting;

      if (!counting?.enabled || !counting?.channel) return;
      if (message.channel.id !== counting.channel) return;
      if (!featureAllowed(settings, 'counting', message.channel)) return;

      const content = message.content.trim();
      const isCleanInteger = /^\d+$/.test(content);
      const number = isCleanInteger ? parseInt(content, 10) : NaN;

      if (isNaN(number)) {
        if (counting.deleteWrong) {
          await message.delete().catch(suppress('counting'));
        }
        return;
      }

      const currentCount = counting.currentCount || 0;
      const expectedNumber = currentCount + 1;
      const lastUser = counting.lastUser || '';

      if (!counting.allowSameUser && message.author.id === lastUser) {
        await message.react('❌').catch(suppress('counting'));

        const reply = await message.reply({
          embeds: [
            new EmbedBuilder()
              .setDescription('❌ You cannot count twice in a row!')
              .setColor(0xFF0000)
          ]
        });

        setTimeout(() => { void reply.delete().catch(suppress('counting')); }, 5000);

        if (counting.deleteWrong) {
          await message.delete().catch(suppress('counting'));
        }
        return;
      }

      if (number !== expectedNumber) {
        await message.react('❌').catch(suppress('counting'));

        const bestOnReset = Math.max(counting.highScore || 0, currentCount);
        await GuildSettings.findOneAndUpdate(
          { guildId },
          { $set: { modules: { ...(settings!.modules || {}), counting: { ...counting, currentCount: 0, lastUser: '', highScore: bestOnReset } } } },
          { upsert: true }
        );

        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('💥 Counting reset!')
              .setDescription(`${message.author} broke the count!\nThe expected number was **${expectedNumber}**.`)
              .setColor(0xFF0000)
          ]
        });

        if (counting.deleteWrong) {
          setTimeout(() => message.delete().catch(suppress('counting')), 3000);
        }
        return;
      }

      await message.react('✅').catch(suppress('counting'));

      const newHigh = Math.max(counting.highScore || 0, number);
      await GuildSettings.findOneAndUpdate(
        { guildId },
        { $set: { modules: { ...(settings!.modules || {}), counting: { ...counting, currentCount: number, lastUser: message.author.id, highScore: newHigh } } } },
        { upsert: true }
      );

      if (number % 100 === 0) {
        await message.react('🎉').catch(suppress('counting'));
      } else if (number % 50 === 0) {
        await message.react('⭐').catch(suppress('counting'));
      } else if (number % 10 === 0) {
        await message.react('🔥').catch(suppress('counting'));
      }

      if (counting.goal && number === counting.goal) {
        try {
          const annId = counting.goalChannel || counting.channel;
          const annChannel: any = message.guild!.channels.cache.get(annId);
          if (annChannel && typeof annChannel.send === 'function') {
            await annChannel.send({
              embeds: [new EmbedBuilder()
                .setTitle('🎯 Counting goal reached!')
                .setDescription(`The server counted all the way to **${counting.goal}**! 🎉\nReached by ${message.author}.`)
                .setColor(0x57F287)
                .setTimestamp()]
            }).catch(suppress('counting'));
          }
          if (counting.goalRole) {
            const member = await message.guild!.members.fetch(message.author.id).catch(() => null);
            if (member && !member.roles.cache.has(counting.goalRole)) await member.roles.add(counting.goalRole).catch(suppress('counting'));
          }
        } catch (error) {
            logger.debug('counting: suppressed error', error);
          }
      }
    } catch (error) {
      logger.error('Counting error:', error);
    }
}
