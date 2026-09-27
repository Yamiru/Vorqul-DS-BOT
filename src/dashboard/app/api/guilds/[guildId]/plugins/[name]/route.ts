/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireBotOwner } from '@/lib/guildAuth';
import { PluginError, removePlugin, savePluginSettings, setPluginEnabled } from '@/lib/plugins';
import { logAudit } from '@/lib/audit';

type Props = { params: Promise<{ guildId: string; name: string }> };

function problem(error: unknown) {
  if (error instanceof PluginError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }
  console.error('[plugins]', error);
  return NextResponse.json({ error: 'server_error' }, { status: 500 });
}

export async function PATCH(request: NextRequest, props: Props) {
  const { guildId, name } = await props.params;
  const auth = await requireBotOwner(guildId, request);
  if (!auth.ok) return auth.response!;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const actor = auth.session?.user?.email || auth.session?.user?.name || 'unknown';
  try {
    if (typeof body.enabled === 'boolean') {
      setPluginEnabled(name, body.enabled);
      logAudit(guildId, actor, body.enabled ? 'plugin_enable' : 'plugin_disable', `${body.enabled ? 'Enabled' : 'Disabled'} plugin "${name}"`);
    }
    if (body.settings !== undefined) {
      const saved = savePluginSettings(name, body.settings);
      if ('errors' in saved) return NextResponse.json({ error: 'invalid_settings', fields: saved.errors }, { status: 400 });
      logAudit(guildId, actor, 'plugin_settings', `Changed settings of plugin "${name}"`);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return problem(error);
  }
}

export async function DELETE(request: NextRequest, props: Props) {
  const { guildId, name } = await props.params;
  const auth = await requireBotOwner(guildId, request);
  if (!auth.ok) return auth.response!;

  try {
    removePlugin(name);
    const actor = auth.session?.user?.email || auth.session?.user?.name || 'unknown';
    logAudit(guildId, actor, 'plugin_remove', `Removed plugin "${name}"`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return problem(error);
  }
}
