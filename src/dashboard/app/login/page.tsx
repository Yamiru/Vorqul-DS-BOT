'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import { brand } from '../../lib/brand';
import { useT } from '../components/LanguageProvider';

function LoginContent() {
  const t = useT();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [deniedMessage, setDeniedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (error === 'AccessDenied') {
      fetch('/api/auth/denied-message')
        .then((r) => r.json())
        .then((d) => setDeniedMessage(d?.message || null))
        .catch((error: unknown) => console.debug('page: suppressed error', error));
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-discord-darker flex items-center justify-center p-4">
      <div className="bg-discord-dark rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><Logo size={72} glow /></div>
          <h1 className="text-3xl font-bold text-white mb-2">{brand.name}</h1>
          <p className="text-discord-muted">{brand.tagline}</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded mb-6">
            {error === 'OAuthSignin' && t('app.login.errSignin')}
            {error === 'OAuthCallback' && t('app.login.errCallbackProc')}
            {error === 'OAuthCreateAccount' && t('app.login.errCreate')}
            {error === 'Callback' && t('app.login.errCallback')}
            {error === 'AccessDenied' && (deniedMessage || t('app.login.errDenied'))}
            {!['OAuthSignin', 'OAuthCallback', 'OAuthCreateAccount', 'Callback', 'AccessDenied'].includes(error) && t('app.login.errUnexpected')}
          </div>
        )}

        <button
          onClick={() => signIn('discord', { callbackUrl })}
          className="w-full bg-discord-blurple hover:bg-discord-blurple/80 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-3"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          {t('app.login.signInDiscord')}
        </button>

        <div className="mt-6 text-center text-discord-muted text-sm">
          <p>{t('app.login.redirectHint')}</p>
        </div>

        <div className="mt-8 pt-6 border-t border-discord-light text-center">
          <a href="/" className="text-discord-blurple hover:underline text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icon name="back" size={16} /> {t('app.login.backHome')}
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const t = useT();
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-discord-darker flex items-center justify-center">
        <div className="text-white">{t('app.login.loading')}</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
