/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireGuildManager } from '@/lib/guildAuth';
import { listAudit } from '@/lib/audit';

const DATA_DIR = process.env.DATA_PATH || './data';
const JSON_DIR = path.join(DATA_DIR, 'json');

function loadTable(name: string): any[] {
  try {
    const f = path.join(JSON_DIR, `${name}.json`);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch (error) {
      console.debug('route: suppressed error', error);
    }
  return [];
}

export async function GET(_request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const auth = await requireGuildManager(params.guildId);
  if (!auth.ok) return auth.response!;
  const gid = params.guildId;

  const modItems = loadTable('mod_logs')
    .filter(r => r.guild_id === gid)
    .map(r => ({
      kind: 'moderation',
      type: r.action || 'action',
      actor: r.moderator_id ? `<@${r.moderator_id}>` : 'system',
      target: r.user_id ? `<@${r.user_id}>` : '',
      detail: r.reason || '',
      at: r.created_at || ''
    }));

  const auditItems = listAudit(gid, 500).map(r => ({
    kind: 'dashboard',
    type: r.type || 'event',
    actor: r.actor || 'unknown',
    target: '',
    detail: r.summary || '',
    at: r.created_at || ''
  }));

  const items = [...modItems, ...auditItems]
    .filter(i => i.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 200);

  return NextResponse.json({ items });
}
