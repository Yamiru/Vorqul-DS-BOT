/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { CronJob } from 'cron';
import { getDatabase } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';
import { suppress } from '../../utils/suppress.js';

interface DailyDelta { messages: number; joins: number; leaves: number; commands: number; voice: number; }

const daily = new Map<string, DailyDelta>();
const hourly = new Map<string, number>();
const channels = new Map<string, { count: number; name: string }>();
const users = new Map<string, { count: number; name: string }>();
const commands = new Map<string, number>();

function today(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function bumpDaily(guildId: string, field: keyof DailyDelta, by = 1): void {
  const key = `${guildId}|${today()}`;
  const d = daily.get(key) || { messages: 0, joins: 0, leaves: 0, commands: 0, voice: 0 };
  d[field] += by;
  daily.set(key, d);
}

export function recordMessage(guildId: string, channelId: string, channelName: string, userId: string, userName: string): void {
  bumpDaily(guildId, 'messages');
  const n = new Date();
  const hKey = `${guildId}|${n.getDay()}|${n.getHours()}`;
  hourly.set(hKey, (hourly.get(hKey) || 0) + 1);

  const cKey = `${guildId}|${channelId}`;
  const c = channels.get(cKey) || { count: 0, name: channelName };
  c.count += 1; if (channelName) c.name = channelName;
  channels.set(cKey, c);

  const uKey = `${guildId}|${userId}`;
  const u = users.get(uKey) || { count: 0, name: userName };
  u.count += 1; if (userName) u.name = userName;
  users.set(uKey, u);
}

export function recordJoin(guildId: string): void { bumpDaily(guildId, 'joins'); }
export function recordLeave(guildId: string): void { bumpDaily(guildId, 'leaves'); }

export function recordCommand(guildId: string, name: string): void {
  bumpDaily(guildId, 'commands');
  const key = `${guildId}|${name}`;
  commands.set(key, (commands.get(key) || 0) + 1);
}

export function recordVoiceMinutes(guildId: string, minutes: number): void {
  if (minutes <= 0) return;
  bumpDaily(guildId, 'voice', minutes);
}

async function incRow(table: string, where: Record<string, any>, inc: Record<string, number>, extra: Record<string, any> = {}): Promise<void> {
  const db = getDatabase();
  const existing = await db.findOne<any>(table, where);
  const data: Record<string, any> = { ...where, ...extra };
  for (const [k, v] of Object.entries(inc)) data[k] = (existing?.[k] || 0) + v;
  await db.upsert(table, data, Object.keys(where));
}

let flushing = false;

export async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const d = new Map(daily); daily.clear();
    const h = new Map(hourly); hourly.clear();
    const ch = new Map(channels); channels.clear();
    const us = new Map(users); users.clear();
    const cm = new Map(commands); commands.clear();

    for (const [key, v] of d) {
      const [guild_id, date] = key.split('|');
      await incRow('analytics_daily', { guild_id, date }, { messages: v.messages, joins: v.joins, leaves: v.leaves, commands: v.commands, voice_minutes: v.voice });
    }
    for (const [key, v] of h) {
      const [guild_id, dow, hour] = key.split('|');
      await incRow('analytics_hourly', { guild_id, dow: Number(dow), hour: Number(hour) }, { messages: v });
    }
    for (const [key, v] of ch) {
      const [guild_id, channel_id] = key.split('|');
      await incRow('analytics_channels', { guild_id, channel_id }, { messages: v.count }, { name: v.name });
    }
    for (const [key, v] of us) {
      const [guild_id, user_id] = key.split('|');
      await incRow('analytics_users', { guild_id, user_id }, { messages: v.count }, { name: v.name });
    }
    for (const [key, v] of cm) {
      const [guild_id, name] = key.split('|');
      await incRow('analytics_commands', { guild_id, name }, { count: v });
    }
  } catch (err) {
    logger.error('Analytics flush failed:', err as Error);
  } finally {
    flushing = false;
  }
}

let job: CronJob | null = null;

export function initStatsTracker(): void {
  if (job) return;
  job = new CronJob('* * * * *', () => { flush().catch(suppress('statsTracker')); });
  job.start();
  logger.info('Analytics stats tracker started');
}
