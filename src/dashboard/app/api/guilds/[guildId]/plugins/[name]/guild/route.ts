/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireGuildAdmin, sameOrigin } from '@/lib/guildAuth';
import { PluginError, saveGuildPluginSettings } from '@/lib/plugins';
import { guildChannelTypes } from '@/lib/guildChannels';
import { logAudit } from '@/lib/audit';

export async function PUT(request: NextRequest, props: { params: Promise<{ guildId: string; name: string }> }) {
  const { guildId, name } = await props.params;
  if (!sameOrigin(request)) return NextResponse.json({ error: 'cross_origin' }, { status: 403 });
  const auth = await requireGuildAdmin(guildId);
  if (!auth.ok) return auth.response!;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || typeof body.values !== 'object' || body.values === null) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  try {
    const saved = await saveGuildPluginSettings(name, guildId, body.values, () => guildChannelTypes(guildId));
    if ('errors' in saved) return NextResponse.json({ error: 'invalid_settings', fields: saved.errors }, { status: 400 });
    const actor = auth.session?.user?.email || auth.session?.user?.name || 'unknown';
    logAudit(guildId, actor, 'plugin_guild_settings', `Changed the server settings of plugin "${name}"`);
    return NextResponse.json({ ok: true, values: saved.values });
  } catch (error) {
    if (error instanceof PluginError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error('[plugins]', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
