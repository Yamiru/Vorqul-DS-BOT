/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Events, Message, TextChannel, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { i18n } from '../../utils/i18n.js';
import { EmbedHelper } from '../../utils/embedHelper.js';
import { GuildSettings, UserData, ShadowMute } from '../../utils/models.js';
import { randomInt } from '../../utils/helpers.js';
import { featureAllowed } from '../modules/channelGuard.js';
import {
  detectPhishing,
  detectFakeNitro,
  detectCryptoScam,
  detectCustomRegex,
  detectMassMention
} from '../../utils/automodDetectors.js';
import { isModuleEnabled } from '../../utils/channelScope.js';
import { resolveLeveling } from '../../shared/featureConfig.js';
import type { Event } from '../types.js';
import { suppress } from '../../utils/suppress.js';

const xpCooldowns = new Map<string, number>();

const messageCache = new Map<string, { count: number; lastMessage: string; timestamps: number[] }>();

const repeatCache = new Map<string, { last: string; repeats: number; ts: number }>();

const infractionCache = new Map<string, number[]>();

const CACHE_SWEEP_MS = 5 * 60_000;
const CACHE_MAX_AGE_MS = 30 * 60_000;

const sweeper = setInterval(() => {
  const now = Date.now();

  for (const [key, at] of xpCooldowns) {
    if (now - at > CACHE_MAX_AGE_MS) xpCooldowns.delete(key);
  }

  for (const [key, entry] of messageCache) {
    const last = entry.timestamps[entry.timestamps.length - 1] ?? 0;
    if (now - last > CACHE_MAX_AGE_MS) messageCache.delete(key);
  }

  for (const [key, entry] of repeatCache) {
    if (now - entry.ts > CACHE_MAX_AGE_MS) repeatCache.delete(key);
  }

  for (const [key, timestamps] of infractionCache) {
    const fresh = timestamps.filter((t) => now - t < CACHE_MAX_AGE_MS);
    if (fresh.length === 0) infractionCache.delete(key);
    else infractionCache.set(key, fresh);
  }
}, CACHE_SWEEP_MS);

sweeper.unref?.();

const event: Event<typeof Events.MessageCreate> = {
  name: Events.MessageCreate,
  execute: async (client: Client, message: Message) => {
    if (message.author.bot || !message.guild) return;

    try {
      const settings = await GuildSettings.findOne({ guildId: message.guild.id });

      if (!settings) return;

      const guildId = message.guild.id;

      try {
        const sm = await ShadowMute.findOne({ guildId, userId: message.author.id });
        if (sm) { await message.delete().catch(suppress('messageCreate')); return; }
      } catch (error) {
          logger.debug('messageCreate: suppressed error', error);
        }

      if (featureAllowed(settings, 'automod', message.channel)) {
        const automodResult = await runAutomod(message, settings);
        if (automodResult) return;
      }

      if (
        isModuleEnabled(settings, 'leveling') &&
        settings.leveling?.enabled !== false &&
        featureAllowed(settings, 'leveling', message.channel)
      ) {
        await handleLeveling(client, message, settings);
      }
    } catch (error) {
      logger.error('Error in messageCreate event:', error as Error);
    }
  }
};

async function runAutomod(message: Message, settings: IGuildSettingsType): Promise<boolean> {
  const automod = settings.automod;
  if (!automod || automod.enabled === false) return false;

  const userId = message.author.id;
  const content = message.content;

  if (Array.isArray(automod.ignoredChannels) && automod.ignoredChannels.includes(message.channel.id)) {
    return false;
  }

  if (automod.ignoreAdmins !== false && message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    return false;
  }

  if (Array.isArray(automod.bypassRoles) && automod.bypassRoles.length > 0 &&
      automod.bypassRoles.some((r: string) => message.member?.roles.cache.has(r))) {
    return false;
  }

  if (automod.spam?.enabled) {
    const key = `${message.guild!.id}-${userId}`;
    const now = Date.now();
    const cache = messageCache.get(key) || { count: 0, lastMessage: '', timestamps: [] };

    cache.timestamps = cache.timestamps.filter(t => now - t < automod.spam.interval);
    cache.timestamps.push(now);
    cache.count = cache.timestamps.length;

    if (cache.count >= automod.spam.maxMessages) {
      await handleAutomodAction(message, automod.spam.action, automod.spam.duration, 'spam');
      await recordInfraction(message, automod);
      messageCache.delete(key);
      return true;
    }

    messageCache.set(key, cache);
  }

  if (automod.links?.enabled) {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = content.match(urlRegex);

    if (urls) {
      const whitelist: string[] = automod.links.whitelist || [];
      const hasUnauthorizedLink = urls.some((url: string) => {
        return !whitelist.some((w: string) => url.includes(w));
      });

      if (hasUnauthorizedLink) {
        await handleAutomodAction(message, automod.links.action, 0, 'links');
        await recordInfraction(message, automod);
        return true;
      }
    }
  }

  if (automod.invites?.enabled) {
    const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[^\s]+/gi;
    if (inviteRegex.test(content)) {
      await handleAutomodAction(message, automod.invites.action, 0, 'invites');
      await recordInfraction(message, automod);
      return true;
    }
  }

  if (automod.caps?.enabled) {
    if (content.length >= automod.caps.minLength) {
      const capsCount = (content.match(/[A-Z]/g) || []).length;
      const percentage = (capsCount / content.length) * 100;

      if (percentage >= automod.caps.percentage) {
        await handleAutomodAction(message, automod.caps.action, 0, 'caps');
        await recordInfraction(message, automod);
        return true;
      }
    }
  }

  if (automod.mentions?.enabled) {
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    if (mentionCount >= automod.mentions.maxMentions) {
      await handleAutomodAction(message, automod.mentions.action || 'timeout', automod.mentions.duration ? automod.mentions.duration*1000 : 300000, 'mentions');
      await recordInfraction(message, automod);
      return true;
    }
  }

  if (automod.attachments?.enabled && message.attachments.size > 0) {
    const imagesOnly = automod.attachments.imagesOnly === true;
    const relevant = imagesOnly
      ? message.attachments.filter((a: any) => (a.contentType || '').startsWith('image/')).size
      : message.attachments.size;
    const max: number = automod.attachments.maxAttachments ?? 0;
    if (relevant > 0 && relevant > max) {
      await handleAutomodAction(message, automod.attachments.action || 'delete', 0, 'attachments');
      await recordInfraction(message, automod);
      return true;
    }
  }

  if (automod.blacklist?.length > 0) {
    const lowerContent = content.toLowerCase();
    const hasBlacklisted = automod.blacklist.some((word: string) =>
      lowerContent.includes(word.toLowerCase())
    );

    if (hasBlacklisted) {
      await handleAutomodAction(message, automod.blacklist_action || 'delete', 0, 'blacklist');
      await recordInfraction(message, automod);
      return true;
    }
  }

  if (automod.repeated?.enabled) {
    const maxRepeats: number = automod.repeated.maxRepeats || 3;
    const charRunRegex = /(.)\1{9,}/;
    const key = `${message.guild!.id}-${userId}`;
    const now = Date.now();
    const entry = repeatCache.get(key);
    const normalized = content.trim().toLowerCase();

    let trippedRepeat = false;
    if (normalized.length > 0) {
      if (entry && entry.last === normalized && (now - entry.ts) < 30000) {
        entry.repeats += 1;
        entry.ts = now;
        if (entry.repeats >= maxRepeats) {
          trippedRepeat = true;
          repeatCache.delete(key);
        } else {
          repeatCache.set(key, entry);
        }
      } else {
        repeatCache.set(key, { last: normalized, repeats: 1, ts: now });
      }
    }

    if (trippedRepeat || charRunRegex.test(content)) {
      await handleAutomodAction(message, automod.repeated.action || 'delete', 0, 'repeatedText');
      await recordInfraction(message, automod);
      return true;
    }
  }

  if (automod.emojis?.enabled) {
    const max: number = automod.emojis.maxEmojis || 5;
    const customEmojis = (content.match(/<a?:\w+:\d+>/g) || []).length;
    const unicodeEmojis = (content.match(/\p{Extended_Pictographic}/gu) || []).length;
    if (customEmojis + unicodeEmojis >= max) {
      await handleAutomodAction(message, automod.emojis.action || 'delete', 0, 'emojis');
      await recordInfraction(message, automod);
      return true;
    }
  }

  if (automod.spoilers?.enabled) {
    const max: number = automod.spoilers.maxSpoilers || 3;
    const spoilerCount = (content.match(/\|\|[^|]+\|\|/g) || []).length;
    if (spoilerCount >= max) {
      await handleAutomodAction(message, automod.spoilers.action || 'delete', 0, 'spoilers');
      await recordInfraction(message, automod);
      return true;
    }
  }

  if (automod.phishing?.enabled) {
    const result = detectPhishing(content);
    if (result.matched) {
      await handleAutomodAction(message, automod.phishing.action || 'ban', automod.phishing.duration || 0, 'phishing');
      await recordInfraction(message, automod);
      return true;
    }
  }

  if (automod.fakeNitro?.enabled) {
    const result = detectFakeNitro(content);
    if (result.matched) {
      await handleAutomodAction(message, automod.fakeNitro.action || 'timeout', automod.fakeNitro.duration || 600, 'fakeNitro');
      await recordInfraction(message, automod);
      return true;
    }
  }

  if (automod.cryptoScam?.enabled) {
    const result = detectCryptoScam(content);
    if (result.matched) {
      await handleAutomodAction(message, automod.cryptoScam.action || 'delete', automod.cryptoScam.duration || 0, 'cryptoScam');
      await recordInfraction(message, automod);
      return true;
    }
  }

  if (automod.regex?.enabled) {
    const result = detectCustomRegex(content, automod.regex.rules || []);
    if (result.matched) {
      await handleAutomodAction(message, automod.regex.action || 'delete', automod.regex.duration || 0, 'regex');
      await recordInfraction(message, automod);
      return true;
    }
  }

  if (automod.massMention?.enabled) {
    const result = detectMassMention(
      content,
      automod.massMention.maxMentions || 5,
      automod.massMention.countEveryone !== false
    );
    if (result.matched) {
      await handleAutomodAction(message, automod.massMention.action || 'timeout', automod.massMention.duration || 600, 'massMention');
      await recordInfraction(message, automod);
      return true;
    }
  }

  if (automod.zalgo?.enabled) {
    const combining = (content.match(/[\u0300-\u036f\u0489\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g) || []).length;
    const base = content.replace(/\s/g, '').length || 1;
    if (combining >= 8 && combining / base > 0.3) {
      await handleAutomodAction(message, automod.zalgo.action || 'delete', 0, 'zalgo');
      await recordInfraction(message, automod);
      return true;
    }
  }

  return false;
}

async function recordInfraction(message: Message, automod: any): Promise<void> {
  if (!automod?.escalation?.enabled || !Array.isArray(automod.escalation.rules)) return;

  const key = `${message.guild!.id}-${message.author.id}`;
  const now = Date.now();
  const windowMs = (automod.escalation.windowMinutes || 60) * 60000;

  const list = (infractionCache.get(key) || []).filter(t => now - t < windowMs);
  list.push(now);
  infractionCache.set(key, list);

  const count = list.length;

  const matched = automod.escalation.rules
    .filter((r: any) => count >= (r.infractions || 0))
    .sort((a: any, b: any) => (b.infractions || 0) - (a.infractions || 0))[0];

  if (!matched) return;

  const member = message.member;
  if (!member) return;

  try {
    switch (matched.action) {
      case 'timeout':
      case 'mute':
        if (member.moderatable) {
          await member.timeout((matched.duration || 600) * 1000, `AutoMod escalation: ${count} violations`);
        }
        break;
      case 'kick':
        if (member.kickable) await member.kick(`AutoMod escalation: ${count} violations`);
        break;
      case 'ban':
        if (member.bannable) await member.ban({ reason: `AutoMod escalation: ${count} violations` });
        break;
    }
  } catch (err) {
    logger.error('AutoMod escalation failed:', err as Error);
  }
}

async function handleAutomodAction(
  message: Message,
  action: string,
  duration: number,
  type: string
): Promise<void> {
  const guildId = message.guild!.id;

  try {
    if (message.deletable) {
      try {
        await message.delete();
        await notifyUserInChannel(message, guildId);
      } catch (error) {
        logger.debug('Automod delete failed (message likely already gone):', error as Error);
      }
    }

    switch (action) {
      case 'timeout':
        if (message.member?.moderatable) {
          await message.member.timeout(duration || 300000, `Automod: ${type}`);
        }
        break;
      case 'kick':
        if (message.member?.kickable) {
          await message.member.kick(`Automod: ${type}`);
        }
        break;
      case 'ban':
        if (message.member?.bannable) {
          await message.member.ban({ reason: `Automod: ${type}` });
        }
        break;
    }

    const settings = await GuildSettings.findOne({ guildId });
    if (settings?.logChannels?.moderation) {
      const logChannel = message.guild!.channels.cache.get(settings.logChannels.moderation) as TextChannel;

      if (logChannel) {
        const embed = EmbedHelper.warning(
          i18n.t(`automod.${type}`, guildId, { user: message.author.tag })
        )
          .addFields(
            { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: 'Action', value: action, inline: true },
            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
          )
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });
      }
    }
  } catch (error) {
    logger.error('Automod action failed:', error as Error);
  }
}

const AUTOMOD_WARNING_TTL_MS = 6000;

async function notifyUserInChannel(message: Message, guildId: string): Promise<void> {
  const channel = message.channel as TextChannel;
  if (!channel.isTextBased?.() || typeof channel.send !== 'function') return;

  try {
    const notice = await channel.send({
      content: i18n.t('automod.userWarning', guildId, { user: message.author.toString() }),
      allowedMentions: { users: [message.author.id] }
    });
    setTimeout(() => notice.delete().catch(suppress('messageCreate:automodWarning')), AUTOMOD_WARNING_TTL_MS);
  } catch (error) {
    logger.debug('Automod user warning failed:', error as Error);
  }
}

async function handleLeveling(client: Client, message: Message, settings: IGuildSettingsType): Promise<void> {
  const guildId = message.guild!.id;
  const userId = message.author.id;
  const config = resolveLeveling(settings);

  if (!config.enabled) return;
  if (config.noXpChannels.includes(message.channel.id)) return;
  if (config.noXpRoles.some((roleId) => message.member?.roles.cache.has(roleId))) return;

  const cooldownKey = `${guildId}-${userId}`;
  const lastXp = xpCooldowns.get(cooldownKey);

  if (lastXp && Date.now() - lastXp < config.cooldownMs) return;

  xpCooldowns.set(cooldownKey, Date.now());

  const xpGained = Math.max(1, Math.round(randomInt(config.xpMin, config.xpMax) * config.xpMultiplier));

  let userData = await UserData.findOne({ odId: userId, guildId });

  if (!userData) {
    userData = await UserData.create({
      odId: userId,
      guildId,
      xp: 0,
      level: 0,
      totalXp: 0,
      messages: 0
    });
  }

  let newXp = (userData.xp || 0) + xpGained;
  const newTotalXp = (userData.totalXp || 0) + xpGained;
  const newMessages = (userData.messages || 0) + 1;
  let newLevel = userData.level || 0;
  let leveledUp = false;

  const atMaxLevel = config.maxLevel > 0 && newLevel >= config.maxLevel;

  while (!atMaxLevel) {
    const xpForNextLevel = calculateXpForLevel(newLevel + 1);
    if (newXp < xpForNextLevel) break;
    if (config.maxLevel > 0 && newLevel + 1 > config.maxLevel) break;
    newLevel += 1;
    newXp -= xpForNextLevel;
    leveledUp = true;
  }

  if (leveledUp) {
    await announceLevelUp(message, config, newLevel);
    await applyRoleRewards(message, config, newLevel);
  }

  await UserData.findOneAndUpdate(
    { odId: userId, guildId },
    { $set: { xp: newXp, totalXp: newTotalXp, messages: newMessages, level: newLevel } }
  );
}

function renderLevelUpMessage(template: string, message: Message, level: number): string {
  return template
    .replace(/{user}/g, message.author.toString())
    .replace(/{username}/g, message.author.username)
    .replace(/{level}/g, String(level))
    .replace(/{server}/g, message.guild?.name || '');
}

async function announceLevelUp(
  message: Message,
  config: ReturnType<typeof resolveLeveling>,
  level: number
): Promise<void> {
  const target = config.levelUpChannel;
  if (target === 'disabled') return;

  const text = config.levelUpMessage
    ? renderLevelUpMessage(config.levelUpMessage, message, level)
    : i18n.t('leveling.levelUp', message.guild!.id, {
        user: message.author.toString(),
        level: String(level)
      });

  const embed = EmbedHelper.success(text).setThumbnail(message.author.displayAvatarURL());

  try {
    if (target === 'dm') {
      await message.author.send({ embeds: [embed] });
      return;
    }

    const channel = target
      ? (message.guild!.channels.cache.get(target) as TextChannel | undefined)
      : (message.channel as TextChannel);

    if (channel && typeof channel.send === 'function') {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    logger.error('Failed to send level up message:', error as Error);
  }
}

async function applyRoleRewards(
  message: Message,
  config: ReturnType<typeof resolveLeveling>,
  level: number
): Promise<void> {
  const member = message.member;
  if (!member || config.roleRewards.length === 0) return;

  const earned = config.roleRewards.filter((reward) => reward.level <= level);
  if (earned.length === 0) return;

  const keep = config.stackRoles ? earned : [earned[earned.length - 1]];
  const keepIds = new Set(keep.map((reward) => reward.roleId));

  try {
    for (const reward of keep) {
      if (!member.roles.cache.has(reward.roleId)) {
        await member.roles.add(reward.roleId);
      }
    }

    if (!config.stackRoles) {
      for (const reward of config.roleRewards) {
        if (keepIds.has(reward.roleId)) continue;
        if (member.roles.cache.has(reward.roleId)) {
          await member.roles.remove(reward.roleId);
        }
      }
    }
  } catch (error) {
    logger.error('Failed to sync level reward roles:', error as Error);
  }
}

function calculateXpForLevel(level: number): number {
  return 5 * Math.pow(level, 2) + 50 * level + 100;
}

type IGuildSettingsType = NonNullable<Awaited<ReturnType<typeof GuildSettings.findOne>>>;

export default event;
