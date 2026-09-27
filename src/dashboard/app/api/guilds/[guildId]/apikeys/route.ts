/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireGuildManager } from '@/lib/guildAuth';
import { listKeys, createKey } from '@/lib/apiKeys';
import { logAudit } from '@/lib/audit';

export async function GET(_request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const auth = await requireGuildManager(params.guildId);
  if (!auth.ok) return auth.response!;
  return NextResponse.json({ keys: listKeys(params.guildId) });
}

export async function POST(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const auth = await requireGuildManager(params.guildId);
  if (!auth.ok) return auth.response!;

  let name = 'API key';
  try {
    const body = await request.json(); if (body?.name) name = String(body.name).slice(0, 60);
  } catch (error) {
    console.debug('route: suppressed error', error);
  }

  const actor = auth.session?.user?.email || auth.session?.user?.name || 'unknown';
  const { id, key } = createKey(params.guildId, name, actor);
  logAudit(params.guildId, actor, 'apikey_create', `Created API key "${name}"`);

  return NextResponse.json({ id, key });
}
