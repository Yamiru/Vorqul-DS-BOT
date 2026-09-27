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

import { defaultModuleState } from '@shared/moduleRegistry';
import { canonicalModuleKey, moduleEnabled } from '@shared/settingsSchema';

function buildModules(stored: any): Record<string, any> {
  const defaults = defaultModuleState();
  const out: Record<string, any> = {};

  for (const [key, def] of Object.entries(defaults)) {
    const current = stored?.[key];
    out[key] = {
      ...(current && typeof current === 'object' ? current : {}),
      enabled: moduleEnabled(current, def),
    };
  }

  if (stored && typeof stored === 'object') {
    for (const [key, value] of Object.entries(stored)) {
      const canonical = canonicalModuleKey(key);
      if (out[canonical]) continue;
      out[canonical] = value && typeof value === 'object' ? value : { enabled: !!value };
    }
  }

  return out;
}

export async function GET(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const { guildId } = params;
  const auth = await requireGuildManager(guildId);
  if (!auth.ok) return auth.response!;

  try {
    const settings = getDashboardSettings(guildId);
    return NextResponse.json({ modules: buildModules(settings.modules) });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const { guildId } = params;
  const auth = await requireGuildManager(guildId);
  if (!auth.ok) return auth.response!;

  try {
    const body = await request.json();
    if (!body.module) {
      return NextResponse.json({ error: 'Module name required' }, { status: 400 });
    }

    const moduleKey = canonicalModuleKey(String(body.module));
    const settings = getDashboardSettings(guildId);
    const current = buildModules(settings.modules);
    const newState = !(current[moduleKey]?.enabled);

    patchSettings(guildId, { modules: { [moduleKey]: { enabled: newState } } });

    return NextResponse.json({ success: true, enabled: newState });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const { guildId } = params;
  const auth = await requireGuildManager(guildId);
  if (!auth.ok) return auth.response!;

  try {
    const body = await request.json();
    if (!body.module || typeof body.settings !== 'object') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const moduleKey = canonicalModuleKey(String(body.module));
    patchSettings(guildId, { modules: { [moduleKey]: body.settings } });
    return NextResponse.json({ success: true, message: `Module ${moduleKey} updated` });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
