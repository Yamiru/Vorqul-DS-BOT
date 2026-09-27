/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { CronJob } from 'cron';
import { logger } from '../../utils/logger.js';
import { getDatabase } from '../../utils/database.js';
import { endGiveaway } from '../commands/fun/giveaway.js';

class TaskScheduler {
  private client: Client;
  private giveawayJob: CronJob;
  private scheduledMessageJob: CronJob;

  constructor(client: Client) {
    this.client = client;
    this.giveawayJob = new CronJob('* * * * *', () => {
      this.checkGiveaways().catch(err => logger.error('Giveaway auto-end failed:', err as Error));
    });
    this.scheduledMessageJob = new CronJob('* * * * *', () => {
      this.checkScheduledMessages().catch(err => logger.error('Scheduled message check failed:', err as Error));
    });
  }

  start(): void {
    this.giveawayJob.start();
    this.scheduledMessageJob.start();
    logger.info('Task scheduler started');
  }

  private async checkGiveaways(): Promise<void> {
    const db = getDatabase();
    const open: any[] = await db.find('giveaways', { ended: 0 });
    const now = Date.now();

    for (const giveaway of open) {
      if (!giveaway.ends_at) continue;
      const endsAt = new Date(giveaway.ends_at).getTime();
      if (Number.isNaN(endsAt) || endsAt > now) continue;

      try {
        await endGiveaway(this.client, giveaway);
      } catch (error) {
        logger.error('Error ending giveaway:', error as Error);
      }
    }
  }

  private async checkScheduledMessages(): Promise<void> {
    const db = getDatabase();
    const due: any[] = await db.find('scheduled_messages', { sent: 0 });
    const now = Date.now();

    for (const msg of due) {
      if (!msg.scheduled_for) continue;
      const scheduledFor = new Date(msg.scheduled_for).getTime();
      if (Number.isNaN(scheduledFor) || scheduledFor > now) continue;

      await this.sendScheduledMessage(msg);
    }
  }

  private async sendScheduledMessage(msg: any): Promise<void> {
    const db = getDatabase();

    try {
      const channel = this.client.channels.cache.get(msg.channel_id) as TextChannel | undefined;
      if (!channel?.isTextBased()) {
        await db.update('scheduled_messages', { sent: 1 }, { id: msg.id });
        return;
      }

      const sendOptions: any = {};
      if (msg.content) sendOptions.content = msg.content;
      if (msg.embed) sendOptions.embeds = [new EmbedBuilder(msg.embed)];

      await channel.send(sendOptions);

      const update: Record<string, any> = { sent: 1 };

      if (msg.recurring && msg.recurring !== 'none') {
        const nextDate = new Date(msg.scheduled_for);
        switch (msg.recurring) {
          case 'daily':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
          case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
        }
        update.sent = 0;
        update.scheduled_for = nextDate.toISOString();
      }

      await db.update('scheduled_messages', update, { id: msg.id });
      logger.info(`Scheduled message sent in guild ${msg.guild_id}`);
    } catch (error) {
      logger.error('Error sending scheduled message:', error as Error);
      await db.update('scheduled_messages', { sent: 1 }, { id: msg.id }).catch(() => {});
    }
  }
}

let scheduler: TaskScheduler | null = null;

export function initTaskScheduler(client: Client): void {
  if (scheduler) return;
  scheduler = new TaskScheduler(client);
  scheduler.start();
}

export default TaskScheduler;
