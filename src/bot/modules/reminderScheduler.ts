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
import { getDatabase } from '../../utils/database.js';
import { EmbedHelper } from '../../utils/embedHelper.js';

class ReminderScheduler {
  private client: Client;
  private job: CronJob;

  constructor(client: Client) {
    this.client = client;
    this.job = new CronJob('* * * * *', () => {
      this.checkReminders().catch(err => logger.error('Reminder check failed:', err as Error));
    });
  }

  start(): void {
    this.job.start();
    logger.info('Reminder scheduler started');
  }

  private async checkReminders(): Promise<void> {
    const db = getDatabase();
    const pending: any[] = await db.find('reminders', { sent: 0 });
    const now = Date.now();

    for (const reminder of pending) {
      if (!reminder.remind_at) continue;
      const dueAt = new Date(reminder.remind_at).getTime();
      if (Number.isNaN(dueAt) || dueAt > now) continue;

      await this.sendReminder(reminder);
      await db.delete('reminders', { id: reminder.id });
    }
  }

  private async sendReminder(reminder: any): Promise<void> {
    try {
      const channel = this.client.channels.cache.get(reminder.channel_id) as TextChannel | undefined;

      if (!channel?.isTextBased()) {
        logger.warn(`Reminder channel not found: ${reminder.channel_id}`);
        return;
      }

      const createdAt = reminder.created_at ? new Date(reminder.created_at) : new Date();
      const embed = EmbedHelper.info('⏰ Reminder', reminder.message)
        .setFooter({ text: `Reminder set at ${createdAt.toLocaleString()}` });

      await channel.send({
        content: `<@${reminder.user_id}>`,
        embeds: [embed]
      });
    } catch (error) {
      logger.error('Error sending reminder:', error as Error);
    }
  }
}

let scheduler: ReminderScheduler | null = null;

export function initReminderScheduler(client: Client): void {
  if (scheduler) return;
  scheduler = new ReminderScheduler(client);
  scheduler.start();
}

export default ReminderScheduler;
