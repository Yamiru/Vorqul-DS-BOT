/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import crypto from 'crypto';
import axios from 'axios';
import { GuildSettings } from '../../utils/models.js';
import { logger } from '../../utils/logger.js';

export type WebhookEvent = 'memberJoin' | 'memberLeave' | 'memberBan' | 'memberUnban' | 'dashboardLog';

export async function dispatchWebhook(guildId: string, event: WebhookEvent, data: Record<string, any>): Promise<void> {
  try {
    const settings: any = await GuildSettings.findOne({ guildId });
    const wh = settings?.webhooks;
    if (!wh?.enabled || !wh.url) return;

    const events = wh.events || {};
    if (events[event] === false) return;

    const bodyObj = { event, guildId, timestamp: new Date().toISOString(), data };
    const raw = JSON.stringify(bodyObj);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Vorqul-DS-BOT'
    };
    if (wh.secret) {
      headers['X-Vorqul-Signature'] = 'sha256=' + crypto.createHmac('sha256', wh.secret).update(raw).digest('hex');
    }

    let target: URL;
    try {
      target = new URL(String(wh.url));
    } catch {
      logger.warn('Webhook target is not a valid URL, skipping.');
      return;
    }
    if (target.protocol !== 'https:') {
      logger.warn('Webhook target must use https, skipping.');
      return;
    }

    await axios.post(target.toString(), raw, {
      headers,
      timeout: 5000,
      maxRedirects: 0,
      maxContentLength: 1024 * 1024
    }).catch((err: any) => {
      logger.warn(`Webhook POST to ${target.host} failed: ${err?.message || err}`);
    });
  } catch (err) {
    logger.error('Webhook dispatch error:', err as Error);
  }
}
