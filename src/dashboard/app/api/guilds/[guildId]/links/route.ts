/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireGuildManager } from '@/lib/guildAuth';
import { loadAllSettings, loadAllSettingsForWrite, saveAllSettings } from '@/lib/guildSettings';
import { logAudit } from '@/lib/audit';

interface LinkEntry {
  name: string;
  url: string;
  description?: string;
}

function sanitizeLinks(input: any): LinkEntry[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((l: any) => l && typeof l.name === 'string' && typeof l.url === 'string')
    .map((l: any) => ({
      name: String(l.name).slice(0, 80),
      url: String(l.url).slice(0, 512),
      description: l.description ? String(l.description).slice(0, 200) : undefined
    }))
    .slice(0, 25);
}

export async function GET(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const __auth = await requireGuildManager(params.guildId);
  if (!__auth.ok) return __auth.response!;

  try {
    const { guildId } = params;
    const all = loadAllSettings();
    const record = all.find(s => s.guild_id === guildId);
    const general = record?.modules?.general || {};

    return NextResponse.json({
      linksEnabled: general.linksEnabled !== false,
      links: general.links || []
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const __auth = await requireGuildManager(params.guildId);
  if (!__auth.ok) return __auth.response!;

  try {
    const { guildId } = params;
    const body = await request.json();
    const links = sanitizeLinks(body.links);
    const linksEnabled = body.linksEnabled !== false;

    const all = loadAllSettingsForWrite();
    const index = all.findIndex(s => s.guild_id === guildId);

    if (index >= 0) {
      const record = all[index];
      record.modules = record.modules || {};
      record.modules.general = { ...(record.modules.general || {}), linksEnabled, links };
      record.updated_at = new Date().toISOString();
      all[index] = record;
    } else {
      all.push({
        guild_id: guildId,
        modules: { general: { enabled: true, linksEnabled, links } },
        created_at: new Date().toISOString()
      });
    }

    saveAllSettings(all);

    const actor = __auth.session?.user?.email || __auth.session?.user?.name || 'unknown';
    logAudit(guildId, actor, 'links_update', `Updated the custom links list (${links.length} link(s))`);

    return NextResponse.json({ success: true, linksEnabled, links });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
