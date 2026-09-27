/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { requestIsHttps } from '@/lib/requestProtocol';
import { dashboardIsRestricted } from '@/lib/auth';
import { readVersion } from '@shared/version';

const GATE_COOKIE = 'vd_gate';

function token(password: string, secret: string): string {
  return crypto.createHash('sha256').update(`${password}:${secret}`).digest('hex');
}

export async function GET() {
  return NextResponse.json({
    enabled: !!(process.env.DASHBOARD_PASSWORD || ''),
    restricted: dashboardIsRestricted(),
    version: readVersion()
  });
}

export async function POST(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD || '';

  if (!password) return NextResponse.json({ ok: true });

  if (!rateLimit(`gate:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ ok: false, error: 'Too many attempts, slow down and try again in a minute.' }, { status: 429 });
  }

  let submitted: string;
  try {
    const body = await req.json();
    submitted = String(body?.password || '');
  } catch {
    submitted = '';
  }

  const a = Buffer.from(submitted);
  const b = Buffer.from(password);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });

  const isHttps = requestIsHttps(req.headers, req.nextUrl.protocol);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, token(password, process.env.NEXTAUTH_SECRET || 'vorqul'), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
