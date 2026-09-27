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

const DATA_DIR = process.env.DATA_PATH || './data';
const JSON_DIR = path.join(DATA_DIR, 'json');
const FILE = path.join(JSON_DIR, 'api_keys.json');

function read(): any[] {
  try {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch (error) {
    console.debug('apiKeys: suppressed error', error);
  }
  return [];
}
function write(rows: any[]): void {
  if (!fs.existsSync(JSON_DIR)) fs.mkdirSync(JSON_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf-8');
  fs.renameSync(tmp, FILE);
}

function sameHash(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf-8'), Buffer.from(b, 'utf-8'));
}

export function hashKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function listKeys(guildId: string) {
  return read()
    .filter(r => r.guild_id === guildId)
    .map(r => ({ id: r.id, name: r.name, prefix: r.prefix, created_at: r.created_at, last_used: r.last_used || null }));
}

export function createKey(guildId: string, name: string, actor: string): { id: string; key: string } {
  const rows = read();
  const raw = 'vdb_' + crypto.randomBytes(24).toString('hex');
  const id = crypto.randomUUID();
  rows.push({
    id,
    guild_id: guildId,
    name: name || 'API key',
    key_hash: hashKey(raw),
    prefix: raw.slice(0, 12),
    created_by: actor,
    created_at: new Date().toISOString(),
    last_used: null
  });
  write(rows);
  return { id, key: raw };
}

export function revokeKey(guildId: string, id: string): boolean {
  const rows = read();
  const next = rows.filter(r => !(r.guild_id === guildId && r.id === id));
  write(next);
  return next.length !== rows.length;
}

const LAST_USED_INTERVAL_MS = 60_000;

export function verifyKey(guildId: string, raw: string): boolean {
  if (!raw) return false;
  const h = hashKey(raw);
  const rows = read();
  const row = rows.find(r => r.guild_id === guildId && sameHash(String(r.key_hash || ''), h));
  if (!row) return false;

  const now = Date.now();
  const previous = row.last_used ? Date.parse(row.last_used) : 0;
  if (!Number.isFinite(previous) || now - previous > LAST_USED_INTERVAL_MS) {
    row.last_used = new Date(now).toISOString();
    try {
      write(rows);
    } catch (error) {
      console.warn('apiKeys: could not persist last_used', error);
    }
  }

  return true;
}
