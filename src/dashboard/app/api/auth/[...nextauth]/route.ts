/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import NextAuth from 'next-auth';
import { getAuthOptions } from '@/lib/auth';
import { requestIsHttps } from '@/lib/requestProtocol';
import { NextRequest } from 'next/server';

// Do not wrap `req` in a new NextRequest here. next-auth's app-router handler
// reads headers/cookies from next/headers' own request-scoped headers()/
// cookies() functions, not from the request object passed to it - so a
// rebuilt NextRequest changes nothing for next-auth, while re-constructing
// Next's own NextRequest/NextURL classes like this can crash on some builds
// with "Cannot read private member #state from an object whose class did
// not declare it" (the two copies of those classes end up in different
// compiled chunks). https detection below reads the original, untouched
// request and only feeds `useSecureCookies`, so it is unaffected.
async function handler(req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const params = await context.params;
  const https = requestIsHttps(req.headers, req.nextUrl.protocol);
  return NextAuth(req, { params }, getAuthOptions(https));
}

export { handler as GET, handler as POST };
