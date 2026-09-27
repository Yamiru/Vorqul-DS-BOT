/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireGuildManager } from '@/lib/guildAuth';
import { getDashboardSettings } from '@/lib/guildSettings';

export async function POST(_request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const auth = await requireGuildManager(params.guildId);
  if (!auth.ok) return auth.response!;

  const settings: any = getDashboardSettings(params.guildId);
  const wh = settings?.webhooks;
  if (!wh?.url) {
    return NextResponse.json({ ok: false, error: 'No webhook URL configured.' }, { status: 400 });
  }

  const bodyObj = {
    event: 'test',
    guildId: params.guildId,
    timestamp: new Date().toISOString(),
    data: { message: 'This is a test event from your Vorqul dashboard.' }
  };
  const raw = JSON.stringify(bodyObj);

  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': 'Vorqul-DS-BOT' };
  if (wh.secret) headers['X-Vorqul-Signature'] = 'sha256=' + crypto.createHmac('sha256', wh.secret).update(raw).digest('hex');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(wh.url, { method: 'POST', headers, body: raw, signal: controller.signal });
    clearTimeout(timer);
    return NextResponse.json({ ok: res.ok, status: res.status });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Request failed' }, { status: 502 });
  }
}
