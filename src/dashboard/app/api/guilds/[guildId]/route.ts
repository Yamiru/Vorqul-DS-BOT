/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDashboardSettings, patchSettings } from '@/lib/guildSettings';
import { requireGuildManager } from '@/lib/guildAuth';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { validateSettingsPatch } from '@/lib/validateSettings';

export async function GET(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const { guildId } = params;
  const auth = await requireGuildManager(guildId);
  if (!auth.ok) return auth.response!;

  try {
    return NextResponse.json(getDashboardSettings(guildId));
  } catch (error) {
    console.error('Error fetching guild settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const { guildId } = params;
  const auth = await requireGuildManager(guildId);
  if (!auth.ok) return auth.response!;

  if (!rateLimit(`settings:${clientIp(request)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests, slow down.' }, { status: 429 });
  }

  try {
    const rawUpdates = await request.json();

    const validation = validateSettingsPatch(rawUpdates);
    if (!validation.ok || !validation.data) {
      return NextResponse.json({ error: validation.error || 'Invalid settings payload' }, { status: 400 });
    }

    const updates = validation.data;
    delete updates._id;
    delete updates.guildId;

    const merged = patchSettings(guildId, updates);
    return NextResponse.json({ ...merged, guildId });
  } catch (error) {
    console.error('Error updating guild settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
