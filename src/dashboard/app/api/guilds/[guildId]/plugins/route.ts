/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireGuildAdmin, requireBotOwner, isBotOwner, botOwners } from '@/lib/guildAuth';
import { listPlugins, installPluginZip, PluginError, MAX_UPLOAD_BYTES } from '@/lib/plugins';
import { logAudit } from '@/lib/audit';

function problem(error: unknown) {
  if (error instanceof PluginError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }
  console.error('[plugins]', error);
  return NextResponse.json({ error: 'server_error' }, { status: 500 });
}

export async function GET(_request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await props.params;
  const auth = await requireGuildAdmin(guildId);
  if (!auth.ok) return auth.response!;

  const viewerId = String(auth.session?.user?.id || '');
  return NextResponse.json({
    canManage: await isBotOwner(viewerId),
    ownerConfigured: (await botOwners()).length > 0,
    viewerId,
    ...listPlugins(guildId)
  });
}

export async function POST(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await props.params;
  const auth = await requireBotOwner(guildId, request);
  if (!auth.ok) return auth.response!;

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'no_file' }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });

    const replace = form.get('replace') === 'true';
    const result = installPluginZip(Buffer.from(await file.arrayBuffer()), { replace });

    const actor = auth.session?.user?.email || auth.session?.user?.name || 'unknown';
    logAudit(guildId, actor, 'plugin_install', `${replace ? 'Updated' : 'Installed'} plugin "${result.name}" v${result.version}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return problem(error);
  }
}
