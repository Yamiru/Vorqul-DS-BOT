'use client';

import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import Logo from './components/Logo';
import Icon from './components/Icon';
import { LanguageSwitcher, useT } from './components/LanguageProvider';
import { LANGUAGES } from '@/lib/languages';
import { brand } from '@/lib/brand';

type FeatureIcon =
  | 'moderation' | 'automod' | 'logging' | 'welcome' | 'leveling'
  | 'economy' | 'ticket' | 'gift' | 'feed' | 'crypto' | 'link' | 'globe';

const DISCORD_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const STATS: { value: string; key: string; color?: string }[] = [
  { value: '85+', key: 'lp.stat.commands' },
  { value: '30+', key: 'lp.stat.modules' },
  { value: String(LANGUAGES.length), key: 'lp.stat.languages' },
  { value: '24/7', key: 'lp.stat.uptime', color: '#7FA05B' },
];

const FEATURES: { icon: FeatureIcon; color: string }[] = [
  { icon: 'moderation', color: '#D06450' },
  { icon: 'automod', color: '#B0567E' },
  { icon: 'logging', color: '#3ba55d' },
  { icon: 'welcome', color: '#D9A441' },
  { icon: 'leveling', color: '#E3C766' },
  { icon: 'economy', color: '#7FA05B' },
  { icon: 'ticket', color: '#9333ea' },
  { icon: 'gift', color: '#C08BD0' },
  { icon: 'feed', color: '#ff4500' },
  { icon: 'crypto', color: '#14707A' },
  { icon: 'link', color: '#00b0f4' },
  { icon: 'globe', color: '#ec4899' },
];

export default function Home() {
  const { data: session, status } = useSession();
  const t = useT();
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '';
  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;

  const [restricted, setRestricted] = useState(false);
  const [version, setVersion] = useState('');
  useEffect(() => {
    fetch('/api/gate').then((r) => r.json()).then((d) => {
      setRestricted(!!d?.restricted);
      setVersion(String(d?.version || ''));
    }).catch(() => {});
  }, []);
  // When the owner restricted the dashboard (ALLOWED_EMAILS/ALLOWED_IDS), only
  // an owner-tier account may add the bot to a new server - anyone else, even
  // signed in, must not be able to expand it beyond the servers it already runs.
  const canInvite = !restricted || (session as any)?.isOwnerTier === true;

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#14120F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="animate-spin" style={{ width: '48px', height: '48px', border: '4px solid #14707A', borderTopColor: 'transparent', borderRadius: '50%' }} />
          <p style={{ color: '#948C7C' }}>{t('lp.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lp">
      <nav className="lp-nav">
        <div className="lp-container">
          <div className="lp-nav-inner">
            <div className="lp-brand">
              <Logo size={38} />
              <span className="lp-brand-text">{brand.name}</span>
            </div>

            <div className="lp-nav-actions">
              <LanguageSwitcher compact />
              {session ? (
                <>
                  <Link href="/dashboard" className="btn btn-primary">{t('lp.dashboard')}</Link>
                  <div className="lp-user">
                    {session.user?.image && <img src={session.user.image} alt={t('app.common.avatar')} />}
                    <span className="lp-user-name">{session.user?.name}</span>
                  </div>
                </>
              ) : (
                <button onClick={() => signIn('discord')} className="btn btn-primary">
                  {DISCORD_ICON}
                  {t('lp.signIn')}
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="lp-hero">
        <div className="lp-mesh" />
        <div className="aurora"><span></span><span></span><span></span></div>

        <div className="lp-container">
          <div className="lp-hero-inner">
            <div className="lp-logo-wrap">
              <div className="float"><Logo size={108} glow /></div>
              <div className="lp-logo-check">
                <svg width="16" height="16" fill="#0b3d1f" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
              </div>
            </div>

            <div className="lp-eyebrow animate-fadeInUp">
              <span className="dot" /> {t('lp.eyebrow')}
            </div>

            {version && (
              <p style={{ color: '#948C7C', fontSize: '13px', marginBottom: '12px' }}>{t('lp.version', { version })}</p>
            )}

            <h1 className="lp-title animate-fadeInUp" style={{ animationDelay: '60ms' }}>
              <span className="gradient-animate">Vorqul</span>
              <span style={{ color: 'white' }}> DS BOT</span>
            </h1>

            <p className="lp-subtitle animate-fadeInUp" style={{ animationDelay: '120ms' }}>
              {t('lp.subtitle', { author: 'Yamiru' })}
            </p>

            <div className="lp-cta animate-fadeInUp" style={{ animationDelay: '180ms' }}>
              {session ? (
                <Link href="/dashboard" className="btn btn-primary lp-btn-lg">{t('lp.openDashboard')}</Link>
              ) : (
                <button onClick={() => signIn('discord')} className="btn btn-primary lp-btn-lg">
                  {DISCORD_ICON}
                  {t('lp.getStarted')}
                </button>
              )}
              {canInvite && (
                <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary lp-btn-lg">
                  {t('lp.addToServer')}
                </a>
              )}
            </div>

            <div className="lp-stats">
              {STATS.map((stat, i) => (
                <div key={i} className="lp-stat animate-fadeInUp" style={{ animationDelay: `${220 + i * 70}ms` }}>
                  <div className="lp-stat-value" style={{ color: stat.color || 'white' }}>{stat.value}</div>
                  <div className="lp-stat-label">{t(stat.key)}</div>
                </div>
              ))}
            </div>

            <div className="lp-features">
              {FEATURES.map((f, i) => (
                <div key={i} className="lp-feature animate-fadeInUp" style={{ animationDelay: `${i * 55}ms`, ['--accent' as string]: f.color } as CSSProperties}>
                  <div className="lp-feature-icon" style={{ color: f.color }}><Icon name={f.icon} size={24} /></div>
                  <h3>{t(`lp.f.${f.icon}.t`)}</h3>
                  <p>{t(`lp.f.${f.icon}.d`)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-inner">
            <div className="lp-footer-brand">
              <Logo size={34} />
              <span>{brand.name}</span>
            </div>
            <p>© 2024-2026 <a href={brand.site} target="_blank" rel="noreferrer">{brand.product}</a> {t('app.lp.by')} <a href="https://yamiru.com" target="_blank" rel="noreferrer">{brand.author}</a> · <a href={brand.repo} target="_blank" rel="noreferrer">GitHub</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
