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
import { verifyKey } from '@/lib/apiKeys';
import { rateLimit, clientIp } from '@/lib/rateLimit';

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

function bearer(req: NextRequest): string {
  const h = req.headers.get('authorization') || '';
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : '';
}

export async function GET(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const gid = params.guildId;
  if (!rateLimit(`apiv1:${clientIp(request)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  if (!verifyKey(gid, bearer(request))) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  const daily = loadTable('analytics_daily').filter(r => r.guild_id === gid);
  const last30 = daily.slice(-30);
  const sum = (k: string) => last30.reduce((s, r) => s + (r[k] || 0), 0);

  const roles = loadTable('analytics_roles').filter(r => r.guild_id === gid);
  const memberTotal = roles.length ? Math.max(...roles.map(r => r.member_total || 0)) : null;

  return NextResponse.json({
    guildId: gid,
    memberTotal,
    period: 'last_30_days',
    totals: {
      messages: sum('messages'),
      joins: sum('joins'),
      leaves: sum('leaves'),
      commands: sum('commands'),
      voiceMinutes: sum('voice_minutes')
    },
    generatedAt: new Date().toISOString()
  });
}
