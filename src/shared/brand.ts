/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
const SEALED = Object.freeze({
  product: 'Vorqul DS BOT',
  site: 'https://vorqul.com',
  footer: 'vorqul.com',
  author: 'Yamiru',
  repo: 'https://github.com/Yamiru/Vorqul-DS-BOT',
  version: '1.0.0'
});

const instance = (process.env.NEXT_PUBLIC_BRAND_NAME || '').trim().slice(0, 40);

export const brand = Object.freeze({
  ...SEALED,
  instance,
  name: instance ? `${instance} · ${SEALED.product}` : SEALED.product,
  tagline:
    process.env.NEXT_PUBLIC_BRAND_TAGLINE ||
    'Sign in with Discord to access the dashboard'
});
