/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, VoiceState, EmbedBuilder, ChannelType } from 'discord.js';
import { getDatabase } from '../../utils/database.js';
import { GuildSettings, UserData } from '../../utils/models.js';
import { featureAllowed } from '../modules/channelGuard.js';
import { reportError } from '../../utils/errorReporter.js';
import { resolveLeveling, resolveLogging, resolveTempChannels } from '../../shared/featureConfig.js';
import { logger } from '../../utils/logger.js';

const voiceXpSessions = new Map<string, number>();
const VOICE_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const voiceSessionSweeper = setInterval(() => {
  const cutoff = Date.now() - VOICE_SESSION_MAX_AGE_MS;
  for (const [key, startedAt] of voiceXpSessions) {
    if (startedAt < cutoff) voiceXpSessions.delete(key);
  }
}, 60 * 60 * 1000);
voiceSessionSweeper.unref?.();

export default function voiceStateUpdate(client: Client) {
  client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
    const db = getDatabase();
    const guildId = newState.guild.id;
    const userId = newState.member?.id;

    if (!userId) return;

    try {
      const settings = await GuildSettings.findOne({ guildId });
      const modules = settings?.modules || {};

      const tempConfig = resolveTempChannels(settings);

      if (tempConfig.enabled) {
        const triggerChannel = tempConfig.hubChannel;
        const category = tempConfig.category;

        if (
          triggerChannel &&
          newState.channelId === triggerChannel &&
          oldState.channelId !== triggerChannel &&
          featureAllowed(settings, 'tempChannels', newState.channel)
        ) {
          const defaultName = tempConfig.nameFormat
            .replace(/{user}/g, newState.member?.displayName || 'User')
            .replace(/{username}/g, newState.member?.user.username || 'User')
            .slice(0, 100);

          try {
            const channel = await newState.guild.channels.create({
              name: defaultName,
              type: ChannelType.GuildVoice,
              parent: category || undefined,
              bitrate: tempConfig.bitrate,
              userLimit: tempConfig.userLimit
            });

            await newState.member?.voice.setChannel(channel);

            await db.insert('temp_channels', {
              guild_id: guildId,
              channel_id: channel.id,
              owner_id: userId,
              is_private: false
            });
          } catch (e) {
            logger.error('Error creating temp channel:', e);
          }
        }

        if (oldState.channelId && oldState.channelId !== newState.channelId) {
          const tempChannel = await db.findOne('temp_channels', { channel_id: oldState.channelId });

          if (tempChannel) {
            const channel = oldState.guild.channels.cache.get(oldState.channelId);

            if (channel && channel.isVoiceBased() && channel.members.size === 0) {
              try {
                await channel.delete('Temp channel empty');
                await db.delete('temp_channels', { channel_id: oldState.channelId });
              } catch (error) {
                reportError('voiceStateUpdate:tempChannelCleanup', error, { channelId: oldState.channelId });
              }
            }
          }
        }
      }

      if (modules.voiceStats?.enabled !== false) {
        const blacklistChannels = modules.voiceStats?.blacklistChannels || [];

        if (!oldState.channelId && newState.channelId) {
          if (!blacklistChannels.includes(newState.channelId) &&
              featureAllowed(settings, 'voiceStats', newState.channel)) {
            const minUsers = modules.voiceStats?.minUsers || 1;
            const channel = newState.channel;

            if (channel && channel.members.size >= minUsers) {
              await db.upsert('voice_stats', {
                guild_id: guildId,
                user_id: userId,
                session_start: new Date().toISOString()
              }, ['guild_id', 'user_id']);
            }
          }
        }

        if (oldState.channelId && !newState.channelId) {
          const stats = await db.findOne('voice_stats', {
            guild_id: guildId,
            user_id: userId
          });

          if (stats?.session_start) {
            const sessionStart = new Date(stats.session_start);
            const duration = Math.floor((Date.now() - sessionStart.getTime()) / 1000);

            const ignoreMuted = modules.voiceStats?.ignoreMuted;
            const ignoreDeafened = modules.voiceStats?.ignoreDeafened;

            let shouldCount = true;
            if (ignoreMuted && oldState.mute) shouldCount = false;
            if (ignoreDeafened && oldState.deaf) shouldCount = false;

            if (shouldCount && duration > 0) {
              await db.update('voice_stats', {
                total_time: (stats.total_time || 0) + duration,
                session_start: null
              }, { id: stats.id });
            } else {
              await db.update('voice_stats', { session_start: null }, { id: stats.id });
            }
          }
        }
      }

      await handleVoiceXp(settings, oldState, newState, guildId, userId);

      const logConfig = resolveLogging(settings);

      if (logConfig.enabled && logConfig.channels.voice) {
        const logChannel = newState.guild.channels.cache.get(logConfig.channels.voice);
        if (!logChannel?.isTextBased()) return;

        const events = logConfig.events;

        if (!oldState.channelId && newState.channelId && events.voiceJoin !== false) {
          const embed = new EmbedBuilder()
            .setTitle('🔊 Voice Join')
            .setDescription(`<@${userId}> sa pripojil do ${newState.channel}`)
            .setColor(0x00FF00)
            .setTimestamp();

          await (logChannel as any).send({ embeds: [embed] });
        }

        if (oldState.channelId && !newState.channelId && events.voiceLeave !== false) {
          const embed = new EmbedBuilder()
            .setTitle('🔇 Voice Leave')
            .setDescription(`<@${userId}> opustil ${oldState.channel}`)
            .setColor(0xFF0000)
            .setTimestamp();

          await (logChannel as any).send({ embeds: [embed] });
        }

        if (oldState.channelId && newState.channelId &&
            oldState.channelId !== newState.channelId && events.voiceMove !== false) {
          const embed = new EmbedBuilder()
            .setTitle('🔄 Voice Move')
            .setDescription(`<@${userId}> sa presunul z ${oldState.channel} do ${newState.channel}`)
            .setColor(0xFFFF00)
            .setTimestamp();

          await (logChannel as any).send({ embeds: [embed] });
        }
      }
    } catch (error) {
      logger.error('Voice state update error:', error);
    }
  });
}

async function handleVoiceXp(
  settings: any,
  oldState: VoiceState,
  newState: VoiceState,
  guildId: string,
  userId: string
): Promise<void> {
  const config = resolveLeveling(settings);
  if (!config.enabled || !config.voiceXp || config.voiceXpPerMinute <= 0) return;

  const sessionKey = `${guildId}-${userId}`;

  if (!oldState.channelId && newState.channelId) {
    if (config.noXpChannels.includes(newState.channelId)) return;
    if (config.noXpRoles.some((roleId) => newState.member?.roles.cache.has(roleId))) return;
    voiceXpSessions.set(sessionKey, Date.now());
    return;
  }

  if (!oldState.channelId || newState.channelId) return;

  const startedAt = voiceXpSessions.get(sessionKey);
  voiceXpSessions.delete(sessionKey);
  if (!startedAt) return;

  const minutes = Math.floor((Date.now() - startedAt) / 60000);
  if (minutes <= 0) return;

  const gained = Math.max(1, Math.round(minutes * config.voiceXpPerMinute * config.xpMultiplier));

  try {
    let userData = await UserData.findOne({ odId: userId, guildId });
    if (!userData) {
      userData = await UserData.create({ odId: userId, guildId, xp: 0, level: 0, totalXp: 0, messages: 0 });
    }

    let newXp = (userData.xp || 0) + gained;
    const newTotalXp = (userData.totalXp || 0) + gained;
    let newLevel = userData.level || 0;

    while (config.maxLevel === 0 || newLevel < config.maxLevel) {
      const needed = 5 * Math.pow(newLevel + 1, 2) + 50 * (newLevel + 1) + 100;
      if (newXp < needed) break;
      newLevel += 1;
      newXp -= needed;
    }

    await UserData.findOneAndUpdate(
      { odId: userId, guildId },
      { $set: { xp: newXp, totalXp: newTotalXp, level: newLevel } }
    );
  } catch (error) {
    reportError('voiceStateUpdate:voiceXp', error, { guildId, userId });
  }
}
