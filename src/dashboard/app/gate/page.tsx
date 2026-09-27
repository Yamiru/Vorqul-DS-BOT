'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Logo from '../components/Logo';
import { brand } from '../../lib/brand';
import { useT } from '../components/LanguageProvider';

function GateContent() {
  const t = useT();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        window.location.href = next.startsWith('/') ? next : '/';
        return;
      }
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || t('app.gate.tooMany'));
      } else {
        setError(t('app.gate.wrong'));
      }
      setLoading(false);
    } catch {
      setError(t('app.gate.network'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-discord-darker flex items-center justify-center p-4">
      <div className="bg-discord-dark rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><Logo size={72} glow /></div>
          <h1 className="text-3xl font-bold text-white mb-2">{brand.name}</h1>
          <p className="text-discord-muted">{t('app.gate.title')}</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <input
          type="password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder={t('app.gate.placeholder')}
          className="w-full bg-discord-darker border border-discord-muted/30 text-white px-4 py-3 rounded-lg mb-4 focus:outline-none focus:border-discord-blurple"
        />

        <button
          onClick={submit}
          disabled={loading || !password}
          className="w-full bg-discord-blurple hover:bg-discord-blurple/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {loading ? t('app.gate.checking') : t('app.gate.unlock')}
        </button>

        <p className="text-discord-muted text-xs text-center mt-6">
          {t('app.gate.note')}
        </p>
      </div>
    </div>
  );
}

export default function GatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-discord-darker" />}>
      <GateContent />
    </Suspense>
  );
}
