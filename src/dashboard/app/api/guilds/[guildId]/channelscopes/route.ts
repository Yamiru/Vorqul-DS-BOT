/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDashboardSettings, replaceSettingsKey } from '@/lib/guildSettings';
import { requireGuildManager } from '@/lib/guildAuth';
import { sanitizeScopeMap } from '@/lib/channelScope';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const { guildId } = params;
  const auth = await requireGuildManager(guildId);
  if (!auth.ok) return auth.response!;

  try {
    const settings = getDashboardSettings(guildId);
    return NextResponse.json({
      channelScopes: sanitizeScopeMap(settings.channelScopes),
      commandScopes: settings.commandScopes || {},
    });
  } catch (error) {
    console.error('Error fetching channel scopes:', error);
    return NextResponse.json({ error: 'Failed to fetch channel scopes' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const { guildId } = params;
  const auth = await requireGuildManager(guildId);
  if (!auth.ok) return auth.response!;

  try {
    const body = await request.json();
    const channelScopes = sanitizeScopeMap(body.channelScopes);

    replaceSettingsKey(guildId, 'channelScopes', channelScopes);

    const actor = auth.session?.user?.email || auth.session?.user?.name || 'unknown';
    const restricted = Object.keys(channelScopes);
    logAudit(
      guildId,
      actor,
      'config_update',
      restricted.length > 0
        ? `Channel scopes: ${restricted.join(', ')}`
        : 'Channel scopes cleared'
    );

    return NextResponse.json({ success: true, channelScopes });
  } catch (error) {
    console.error('Error saving channel scopes:', error);
    return NextResponse.json({ error: 'Failed to save channel scopes' }, { status: 500 });
  }
}
