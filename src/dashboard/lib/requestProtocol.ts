/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
export function requestIsHttps(headers: Headers, urlProtocol?: string): boolean {
  const forwarded = headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (forwarded) return forwarded === 'https';
  if (headers.get('x-forwarded-ssl')?.toLowerCase() === 'on') return true;
  return urlProtocol === 'https:';
}
