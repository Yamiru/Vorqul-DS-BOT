/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import { brand } from '../lib/brand';

export const metadata: Metadata = {
  title: 'Vorqul DS BOT Dashboard',
  description: 'Manage your Discord bot settings',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
    ],
  },
  openGraph: {
    title: 'Vorqul DS BOT Dashboard',
    description: 'Manage your Discord bot settings',
    url: 'https://vorqul.com',
    siteName: 'Vorqul DS BOT',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#14120F',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sk" className="dark">
      <body className="min-h-screen bg-discord-darker">
        <Providers>{children}</Providers>
        <a
          href={brand.site}
          target="_blank"
          rel="noopener noreferrer"
          style={{ position: 'fixed', right: 12, bottom: 8, zIndex: 40, fontSize: 11, opacity: 0.7, color: '#948C7C', textDecoration: 'none' }}
        >
          {brand.product} · {brand.footer}
        </a>
      </body>
    </html>
  );
}
