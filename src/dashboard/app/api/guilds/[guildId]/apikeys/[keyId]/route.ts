/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireGuildManager } from '@/lib/guildAuth';
import { revokeKey } from '@/lib/apiKeys';
import { logAudit } from '@/lib/audit';

export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ guildId: string; keyId: string }> }
) {
  const params = await props.params;
  const auth = await requireGuildManager(params.guildId);
  if (!auth.ok) return auth.response!;

  const removed = revokeKey(params.guildId, params.keyId);
  if (removed) {
    const actor = auth.session?.user?.email || auth.session?.user?.name || 'unknown';
    logAudit(params.guildId, actor, 'apikey_revoke', `Revoked an API key`);
  }
  return NextResponse.json({ ok: removed });
}
