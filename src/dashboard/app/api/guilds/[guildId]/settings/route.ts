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
import { logAudit } from '@/lib/audit';
import { validateSettingsPatch } from '@/lib/validateSettings';

export async function GET(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const { guildId } = params;
  const auth = await requireGuildManager(guildId);
  if (!auth.ok) return auth.response!;

  try {
    return NextResponse.json(getDashboardSettings(guildId));
  } catch (error) {
    console.error('Error fetching settings:', error);
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
    const rawBody = await request.json();

    const validation = validateSettingsPatch(rawBody);
    if (!validation.ok || !validation.data) {
      return NextResponse.json({ error: validation.error || 'Invalid settings payload' }, { status: 400 });
    }

    const body = validation.data;
    delete body._id;
    delete body.guildId;

    const merged = patchSettings(guildId, body);
    const changed = Object.keys(body).slice(0, 12).join(', ');
    const actor = auth.session?.user?.email || auth.session?.user?.name || 'unknown';
    logAudit(guildId, actor, 'config_update', changed ? `Updated: ${changed}` : 'Updated settings');
    console.log(`[Settings] Updated for guild ${guildId}, language: ${merged.language}`);
    return NextResponse.json({ success: true, language: merged.language });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
