/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDashboardSettings } from './guildSettings';

const DATA_DIR = process.env.DATA_PATH || './data';
const JSON_DIR = path.join(DATA_DIR, 'json');
const FILE = path.join(JSON_DIR, 'audit_log.json');
const MAX_ROWS = 2000;

function notifyWebhook(guildId: string, actor: string, type: string, summary: string): void {
  try {
    const settings: any = getDashboardSettings(guildId);
    const wh = settings?.webhooks;
    if (!wh?.enabled || !wh.url || wh.events?.dashboardLog === false) return;

    const bodyObj = { event: 'dashboardLog', guildId, timestamp: new Date().toISOString(), data: { actor, type, summary } };
    const raw = JSON.stringify(bodyObj);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'Vorqul-DS-BOT' };
    if (wh.secret) headers['X-Vorqul-Signature'] = 'sha256=' + crypto.createHmac('sha256', wh.secret).update(raw).digest('hex');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    fetch(wh.url, { method: 'POST', headers, body: raw, signal: controller.signal })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  } catch (error) {
    console.debug('audit: webhook notify suppressed error', error);
  }
}

function read(): any[] {
  try {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch (error) {
    console.debug('audit: suppressed error', error);
  }
  return [];
}
function write(rows: any[]): void {
  if (!fs.existsSync(JSON_DIR)) fs.mkdirSync(JSON_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows.slice(-MAX_ROWS), null, 2), 'utf-8');
}

export function logAudit(guildId: string, actor: string, type: string, summary: string): void {
  try {
    const rows = read();
    rows.push({ guild_id: guildId, actor: actor || 'unknown', type, summary, created_at: new Date().toISOString() });
    write(rows);
  } catch (error) {
      console.debug('audit: suppressed error', error);
    }
  notifyWebhook(guildId, actor, type, summary);
}

export function listAudit(guildId: string, limit = 150): any[] {
  return read().filter(r => r.guild_id === guildId).slice(-limit).reverse();
}
