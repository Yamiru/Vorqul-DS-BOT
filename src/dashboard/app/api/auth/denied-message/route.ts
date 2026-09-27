/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const message =
    process.env.AUTH_DENIED_MESSAGE ||
    'Your account is not authorized to access this dashboard. Please contact the administrator.';
  return NextResponse.json({ message });
}
