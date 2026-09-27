/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const GATE_COOKIE = 'vd_gate';
const ALLOW_PREFIXES = ['/gate', '/api/gate'];

async function expectedToken(password: string, secret: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}:${secret}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD || '';

  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (ALLOW_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next();

  const cookie = req.cookies.get(GATE_COOKIE)?.value;
  const expected = await expectedToken(password, process.env.NEXTAUTH_SECRET || 'vorqul');

  if (cookie && cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/gate';
  url.searchParams.set('next', pathname + (req.nextUrl.search || ''));
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff|woff2|ttf)$).*)']
};
