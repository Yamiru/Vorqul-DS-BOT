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
import { buildPollEmbed, buildPollButtons, PollOption } from './pollView.js';
import { suppress } from '../../utils/suppress.js';

class PollScheduler {
  private client: Client;
  private job: CronJob;

  constructor(client: Client) {
    this.client = client;
    this.job = new CronJob('* * * * *', () => {
      this.checkPolls().catch(err => logger.error('Poll auto-close failed:', err as Error));
    });
  }

  start(): void {
    this.job.start();
    logger.info('Poll scheduler started');
  }

  private async checkPolls(): Promise<void> {
    const db = getDatabase();
    const open: any[] = await db.find('polls', { ended: 0 });
    const now = Date.now();

    for (const poll of open) {
      if (!poll.ends_at) continue;
      const ends = new Date(poll.ends_at).getTime();
      if (Number.isNaN(ends) || ends > now) continue;

      try {
        const channel = await this.client.channels.fetch(poll.channel_id).catch(() => null) as TextChannel | null;
        if (channel) {
          const message = await channel.messages.fetch(poll.message_id).catch(() => null);
          if (message) {
            const options: PollOption[] = Array.isArray(poll.options) ? poll.options : [];
            await message.edit({
              embeds: [buildPollEmbed(poll.question, options, { ended: true })],
              components: buildPollButtons(options, true)
            }).catch(suppress('pollScheduler'));
          }
        }
      } catch (error) {
          logger.debug('pollScheduler: suppressed error', error);
        }

      await db.update('polls', { ended: 1 }, { message_id: poll.message_id });
    }
  }
}

let scheduler: PollScheduler | null = null;

export function initPollScheduler(client: Client): void {
  if (scheduler) return;
  scheduler = new PollScheduler(client);
  scheduler.start();
}
