/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, TextChannel } from 'discord.js';
import { CronJob } from 'cron';
import { logger } from '../../utils/logger.js';
import { GuildSettings } from '../../utils/models.js';
import { getDatabase } from '../../utils/database.js';
import { buildConfiguredMessage } from '../../utils/messageRender.js';
import { suppress } from '../../utils/suppress.js';

interface BirthdayRow { guild_id: string; user_id: string; day: number; month: number; year?: number | null; }
interface ActiveRow { guild_id: string; user_id: string; role_id: string; date: string; }

export class BirthdayScheduler {
  private client: Client;
  private job: CronJob;

  constructor(client: Client) {
    this.client = client;

    this.job = new CronJob('0 8 * * *', () => {
      this.run().catch(err => logger.error('Birthday run failed:', err as Error));
    });
  }

  start(): void {
    this.job.start();
    logger.info('Birthday scheduler started');
  }

  stop(): void {
    this.job.stop();
  }

  private todayKey(now: Date): string {
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }

  async run(): Promise<void> {
    const db = getDatabase();
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const today = this.todayKey(now);

    const active = await db.find<ActiveRow>('birthday_active', {});
    for (const a of active) {
      if (a.date === today) continue;
      try {
        const guild = this.client.guilds.cache.get(a.guild_id);
        const member = guild ? await guild.members.fetch(a.user_id).catch(() => null) : null;
        if (member && a.role_id && member.roles.cache.has(a.role_id)) {
          await member.roles.remove(a.role_id).catch(suppress('birthdayScheduler'));
        }
      } catch (error) {
          logger.debug('birthdayScheduler: suppressed error', error);
        }
      await db.delete('birthday_active', { guild_id: a.guild_id, user_id: a.user_id });
    }

    for (const guild of this.client.guilds.cache.values()) {
      const settings = await GuildSettings.findOne({ guildId: guild.id });
      const cfg: any = (settings as any)?.birthday;
      if (!cfg || cfg.enabled !== true || !cfg.channel) continue;

      const channel = guild.channels.cache.get(cfg.channel) as TextChannel | undefined;
      if (!channel || typeof channel.send !== 'function') continue;

      const rows = await db.find<BirthdayRow>('birthdays', { guild_id: guild.id });
      const todays = rows.filter(r => r.day === day && r.month === month);

      for (const r of todays) {
        const member = await guild.members.fetch(r.user_id).catch(() => null);
        if (!member) continue;

        const age = r.year ? now.getFullYear() - r.year : null;
        const vars = {
          user: member.toString(),
          username: member.user.username,
          server: guild.name,
          age: age != null ? String(age) : '',
          avatar: member.user.displayAvatarURL({ size: 256 }),
        };

        const rendered = buildConfiguredMessage(
          cfg.useEmbed ? 'embed' : 'plain',
          { content: cfg.message, message: cfg.message, description: cfg.message, color: cfg.color, title: cfg.title, thumbnail: '{avatar}' },
          vars,
          { plainText: cfg.message || '🎉 Happy birthday {user}! 🎂', description: cfg.message, color: 0xfee75c }
        );

        const opts: any = {};
        if (rendered.content) opts.content = rendered.content;
        if (rendered.embeds) opts.embeds = rendered.embeds;
        if (!opts.content && !opts.embeds) opts.content = `🎉 Happy birthday ${member}! 🎂`;
        await channel.send(opts).catch(suppress('birthdayScheduler'));

        if (cfg.role) {
          try {
            await member.roles.add(cfg.role);
            await db.upsert('birthday_active', { guild_id: guild.id, user_id: r.user_id, role_id: cfg.role, date: today }, ['guild_id', 'user_id']);
          } catch (error) {
              logger.debug('birthdayScheduler: suppressed error', error);
            }
        }
      }
    }
  }
}

let scheduler: BirthdayScheduler | null = null;

export function initBirthdayScheduler(client: Client): void {
  if (scheduler) return;
  scheduler = new BirthdayScheduler(client);
  scheduler.start();
}
