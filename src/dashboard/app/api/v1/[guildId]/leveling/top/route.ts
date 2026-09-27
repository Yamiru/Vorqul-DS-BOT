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
const FILE = path.join(DATA_DIR, 'json', 'user_data.json');

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

  const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10) || 20));

  let rows: any[] = [];
  try {
    if (fs.existsSync(FILE)) rows = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch (error) {
    console.debug('route: suppressed error', error);
  }

  const top = rows
    .filter(r => r.guild_id === gid)
    .sort((a, b) => (b.level || 0) - (a.level || 0) || (b.xp || 0) - (a.xp || 0))
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, userId: r.user_id, level: r.level || 0, xp: r.xp || 0 }));

  return NextResponse.json({ guildId: gid, count: top.length, leaderboard: top, generatedAt: new Date().toISOString() });
}
