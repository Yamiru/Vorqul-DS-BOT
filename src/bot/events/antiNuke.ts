/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import {
  Client,
  Guild,
  GuildAuditLogsEntry,
  AuditLogEvent,
  EmbedBuilder,
  TextChannel,
  PermissionFlagsBits,
} from 'discord.js';
import { GuildSettings } from '../../utils/models.js';
import { logger } from '../../utils/logger.js';
import { suppress } from '../../utils/suppress.js';

type WatchedAction =
  | 'channelDelete'
  | 'channelCreate'
  | 'roleDelete'
  | 'roleCreate'
  | 'ban'
  | 'kick'
  | 'webhookCreate'
  | 'emojiDelete'
  | 'memberRoleUpdate';

interface ActionLimit {
  enabled: boolean;
  max: number;
  windowSeconds: number;
}

interface AntiNukeConfig {
  enabled: boolean;
  logChannel: string;
  punishment: 'removeRoles' | 'kick' | 'ban';
  whitelistUsers: string[];
  whitelistRoles: string[];
  ignoreBots: boolean;
  limits: Record<WatchedAction, ActionLimit>;
}

const ACTION_LABELS: Record<WatchedAction, string> = {
  channelDelete: 'mazanie kanálov',
  channelCreate: 'vytváranie kanálov',
  roleDelete: 'mazanie rolí',
  roleCreate: 'vytváranie rolí',
  ban: 'banovanie členov',
  kick: 'vyhadzovanie členov',
  webhookCreate: 'vytváranie webhookov',
  emojiDelete: 'mazanie emoji',
  memberRoleUpdate: 'rozdávanie rolí',
};

const DEFAULT_LIMITS: Record<WatchedAction, ActionLimit> = {
  channelDelete: { enabled: true, max: 3, windowSeconds: 20 },
  channelCreate: { enabled: true, max: 5, windowSeconds: 20 },
  roleDelete: { enabled: true, max: 3, windowSeconds: 20 },
  roleCreate: { enabled: true, max: 5, windowSeconds: 20 },
  ban: { enabled: true, max: 3, windowSeconds: 30 },
  kick: { enabled: true, max: 5, windowSeconds: 30 },
  webhookCreate: { enabled: true, max: 3, windowSeconds: 30 },
  emojiDelete: { enabled: false, max: 5, windowSeconds: 30 },
  memberRoleUpdate: { enabled: false, max: 6, windowSeconds: 20 },
};

export function resolveAntiNukeConfig(settings: any): AntiNukeConfig | null {
  const raw = settings?.antinuke || settings?.antiNuke;
  if (!raw || raw.enabled !== true) return null;

  const limits = {} as Record<WatchedAction, ActionLimit>;
  for (const [action, fallback] of Object.entries(DEFAULT_LIMITS) as [WatchedAction, ActionLimit][]) {
    const given = raw.limits?.[action] || {};
    limits[action] = {
      enabled: given.enabled ?? fallback.enabled,
      max: Math.max(1, Number(given.max ?? fallback.max) || fallback.max),
      windowSeconds: Math.max(1, Number(given.windowSeconds ?? fallback.windowSeconds) || fallback.windowSeconds),
    };
  }

  return {
    enabled: true,
    logChannel: raw.logChannel || '',
    punishment: ['removeRoles', 'kick', 'ban'].includes(raw.punishment) ? raw.punishment : 'removeRoles',
    whitelistUsers: Array.isArray(raw.whitelistUsers) ? raw.whitelistUsers : [],
    whitelistRoles: Array.isArray(raw.whitelistRoles) ? raw.whitelistRoles : [],
    ignoreBots: raw.ignoreBots === true,
    limits,
  };
}

const buckets = new Map<string, number[]>();

const punished = new Map<string, number>();
const PUNISH_COOLDOWN_MS = 60_000;

function recordAndCheck(key: string, limit: ActionLimit): number | null {
  const now = Date.now();
  const windowMs = limit.windowSeconds * 1000;

  const timestamps = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  timestamps.push(now);
  buckets.set(key, timestamps);

  return timestamps.length >= limit.max ? timestamps.length : null;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of buckets) {
    const fresh = timestamps.filter((t) => now - t < 300_000);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
  for (const [key, at] of punished) {
    if (now - at > PUNISH_COOLDOWN_MS) punished.delete(key);
  }
}, 120_000).unref?.();

async function isWhitelisted(
  guild: Guild,
  userId: string,
  config: AntiNukeConfig
): Promise<boolean> {
  if (userId === guild.ownerId) return true;
  if (userId === guild.client.user?.id) return true;
  if (config.whitelistUsers.includes(userId)) return true;

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return false;
  if (config.ignoreBots && member.user.bot) return true;
  if (config.whitelistRoles.some((roleId) => member.roles.cache.has(roleId))) return true;

  return false;
}

async function punish(
  guild: Guild,
  userId: string,
  action: WatchedAction,
  count: number,
  config: AntiNukeConfig
): Promise<string> {
  const member = await guild.members.fetch(userId).catch(() => null);
  const reason = `Anti-Nuke: ${ACTION_LABELS[action]} (${count}x)`;

  try {
    if (config.punishment === 'ban') {
      await guild.members.ban(userId, { reason });
      return 'zabanovaný';
    }

    if (config.punishment === 'kick') {
      if (!member) return 'nenájdený na serveri';
      await member.kick(reason);
      return 'vyhodený';
    }

    if (!member) return 'nenájdený na serveri';
    const me = guild.members.me;
    const removable = member.roles.cache.filter(
      (role) => role.id !== guild.id && !role.managed && (!me || role.position < me.roles.highest.position)
    );

    if (removable.size === 0) return 'nemal odoberateľné role';
    await member.roles.remove(removable, reason);
    return `odobraté role (${removable.size})`;
  } catch (error) {
    logger.error('Anti-Nuke punishment failed:', error as Error);
    return 'trest sa nepodarilo vykonať';
  }
}

async function report(
  guild: Guild,
  userId: string,
  action: WatchedAction,
  count: number,
  outcome: string,
  config: AntiNukeConfig
): Promise<void> {
  if (!config.logChannel) return;

  const channel = guild.channels.cache.get(config.logChannel) as TextChannel | undefined;
  if (!channel || typeof channel.send !== 'function') return;

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🛡️ Anti-Nuke zasiahol')
    .setDescription(
      `<@${userId}> prekročil limit pre **${ACTION_LABELS[action]}**.\n` +
        `Zaznamenaných akcií: **${count}** v okne ${config.limits[action].windowSeconds}s.`
    )
    .addFields(
      { name: 'Používateľ', value: `<@${userId}> (\`${userId}\`)`, inline: true },
      { name: 'Opatrenie', value: outcome, inline: true }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(suppress('antiNuke'));
}

async function handle(guild: Guild, userId: string, action: WatchedAction): Promise<void> {
  try {
    const settings = await GuildSettings.findOne({ guildId: guild.id });
    const config = resolveAntiNukeConfig(settings);
    if (!config) return;

    const limit = config.limits[action];
    if (!limit.enabled) return;

    if (await isWhitelisted(guild, userId, config)) return;

    const count = recordAndCheck(`${guild.id}:${userId}:${action}`, limit);
    if (count === null) return;

    const punishKey = `${guild.id}:${userId}`;
    const last = punished.get(punishKey);
    if (last && Date.now() - last < PUNISH_COOLDOWN_MS) return;
    punished.set(punishKey, Date.now());

    const outcome = await punish(guild, userId, action, count, config);
    await report(guild, userId, action, count, outcome, config);

    logger.warn(`[Anti-Nuke] ${userId} in ${guild.id}: ${action} x${count} -> ${outcome}`);
  } catch (error) {
    logger.error('Anti-Nuke handler failed:', error as Error);
  }
}

async function findExecutor(
  guild: Guild,
  type: AuditLogEvent,
  targetId?: string
): Promise<string | null> {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return null;

  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 5 });
    const entry = logs.entries.find((e: GuildAuditLogsEntry) => {
      if (Date.now() - e.createdTimestamp > 10_000) return false;
      if (targetId && (e.target as any)?.id && (e.target as any).id !== targetId) return false;
      return true;
    });
    return entry?.executor?.id || null;
  } catch {
    return null;
  }
}

export default function antiNukeHandler(client: Client) {
  const watch = (
    event: string,
    auditType: AuditLogEvent,
    action: WatchedAction,
    getGuild: (...args: any[]) => Guild | null,
    getTargetId?: (...args: any[]) => string | undefined
  ) => {
    client.on(event as any, async (...args: any[]) => {
      const guild = getGuild(...args);
      if (!guild) return;

      const settings = await GuildSettings.findOne({ guildId: guild.id }).catch(() => null);
      if (!resolveAntiNukeConfig(settings)) return;

      const executor = await findExecutor(guild, auditType, getTargetId?.(...args));
      if (executor) await handle(guild, executor, action);
    });
  };

  watch('channelDelete', AuditLogEvent.ChannelDelete, 'channelDelete',
    (channel: any) => channel?.guild ?? null, (channel: any) => channel?.id);

  watch('channelCreate', AuditLogEvent.ChannelCreate, 'channelCreate',
    (channel: any) => channel?.guild ?? null, (channel: any) => channel?.id);

  watch('roleDelete', AuditLogEvent.RoleDelete, 'roleDelete',
    (role: any) => role?.guild ?? null, (role: any) => role?.id);

  watch('roleCreate', AuditLogEvent.RoleCreate, 'roleCreate',
    (role: any) => role?.guild ?? null, (role: any) => role?.id);

  watch('guildBanAdd', AuditLogEvent.MemberBanAdd, 'ban',
    (ban: any) => ban?.guild ?? null, (ban: any) => ban?.user?.id);

  watch('guildMemberRemove', AuditLogEvent.MemberKick, 'kick',
    (member: any) => member?.guild ?? null, (member: any) => member?.id);

  watch('emojiDelete', AuditLogEvent.EmojiDelete, 'emojiDelete',
    (emoji: any) => emoji?.guild ?? null, (emoji: any) => emoji?.id);

  watch('webhooksUpdate', AuditLogEvent.WebhookCreate, 'webhookCreate',
    (channel: any) => channel?.guild ?? null);

  watch('guildMemberUpdate', AuditLogEvent.MemberRoleUpdate, 'memberRoleUpdate',
    (_old: any, next: any) => next?.guild ?? null, (_old: any, next: any) => next?.id);

  logger.info('Anti-Nuke watcher ready');
}
