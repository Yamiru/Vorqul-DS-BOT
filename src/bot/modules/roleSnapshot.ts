/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Guild } from 'discord.js';
import { CronJob } from 'cron';
import { getDatabase } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';
import { suppress } from '../../utils/suppress.js';

const MAX_FETCH_MEMBERS = 50000;

async function snapshotGuild(guild: Guild): Promise<void> {
  try {
    if (guild.members.cache.size < guild.memberCount && guild.memberCount <= MAX_FETCH_MEMBERS) {
      await guild.members.fetch();
    }
  } catch (error) {
      logger.debug('roleSnapshot: suppressed error', error);
    }

  const db = getDatabase();
  const total = guild.memberCount || guild.members.cache.size;

  await db.delete('analytics_roles', { guild_id: guild.id }).catch(suppress('roleSnapshot'));

  const roles = [...guild.roles.cache.values()].filter(r => r.id !== guild.id);
  for (const role of roles) {
    const count = role.members.size;
    if (count === 0) continue;
    await db.insert('analytics_roles', {
      guild_id: guild.id,
      role_id: role.id,
      name: role.name,
      color: role.hexColor,
      position: role.position,
      count,
      member_total: total,
      updated_at: new Date().toISOString()
    });
  }
}

async function snapshotAll(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    await snapshotGuild(guild).catch(err => logger.error(`Role snapshot failed for ${guild.id}:`, err as Error));
  }
}

let job: CronJob | null = null;

export function initRoleSnapshot(client: Client): void {
  if (job) return;
  setTimeout(() => { snapshotAll(client).catch(suppress('roleSnapshot')); }, 30000);
  job = new CronJob('0 */6 * * *', () => { snapshotAll(client).catch(suppress('roleSnapshot')); });
  job.start();
  logger.info('Role snapshot scheduler started');
}
