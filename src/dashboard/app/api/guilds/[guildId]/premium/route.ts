/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireGuildManager } from '@/lib/guildAuth';
import { getPremiumTier, getLimits } from '@/lib/premium';

export async function GET(_request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
 const params = await props.params;
 const auth = await requireGuildManager(params.guildId);
 if (!auth.ok) return auth.response!;
 const tier = getPremiumTier(params.guildId);
 return NextResponse.json({ tier, limits: getLimits(tier) });
}
