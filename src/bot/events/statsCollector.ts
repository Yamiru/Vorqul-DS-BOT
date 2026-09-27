/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client } from 'discord.js';
import {
  recordMessage,
  recordJoin,
  recordLeave,
  recordCommand,
  recordVoiceMinutes
} from '../modules/statsTracker.js';
import { logger } from '../../utils/logger.js';

const voiceJoins = new Map<string, number>();

export default function statsCollector(client: Client): void {
  client.on('messageCreate', (message: any) => {
    try {
      if (!message.guild || message.author?.bot) return;
      const ch = message.channel;
      recordMessage(message.guild.id, ch.id, ch.name || '', message.author.id, message.author.username || '');
    } catch (error) {
        logger.debug('statsCollector: suppressed error', error);
      }
  });

  client.on('guildMemberAdd', (member: any) => {
    try {
      if (member.guild) recordJoin(member.guild.id);
    } catch (error) {
      logger.debug('statsCollector: suppressed error', error);
    }
  });

  client.on('guildMemberRemove', (member: any) => {
    try {
      if (member.guild) recordLeave(member.guild.id);
    } catch (error) {
      logger.debug('statsCollector: suppressed error', error);
    }
  });

  client.on('interactionCreate', (interaction: any) => {
    try {
      if (interaction.isChatInputCommand?.() && interaction.guildId) {
        recordCommand(interaction.guildId, interaction.commandName);
      }
    } catch (error) {
        logger.debug('statsCollector: suppressed error', error);
      }
  });

  client.on('voiceStateUpdate', (oldState: any, newState: any) => {
    try {
      const guildId = (newState.guild || oldState.guild)?.id;
      const userId = newState.id || oldState.id;
      if (!guildId || !userId) return;
      const key = `${guildId}|${userId}`;
      const wasIn = !!oldState.channelId;
      const isIn = !!newState.channelId;

      if (!wasIn && isIn) {
        voiceJoins.set(key, Date.now());
      } else if (wasIn && !isIn) {
        const start = voiceJoins.get(key);
        if (start) { recordVoiceMinutes(guildId, Math.round((Date.now() - start) / 60000)); voiceJoins.delete(key); }
      } else if (wasIn && isIn && oldState.channelId !== newState.channelId) {
        const start = voiceJoins.get(key);
        if (start) recordVoiceMinutes(guildId, Math.round((Date.now() - start) / 60000));
        voiceJoins.set(key, Date.now());
      }
    } catch (error) {
        logger.debug('statsCollector: suppressed error', error);
      }
  });
}
