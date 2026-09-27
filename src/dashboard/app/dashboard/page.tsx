'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Logo from '../components/Logo';
import BotStatusPanel from '../components/BotStatusPanel';
import { useT, LanguageSwitcher } from '../components/LanguageProvider';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  hasBot?: boolean;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; needsRelogin: boolean } | null>(null);
  const [restricted, setRestricted] = useState(false);
  const t = useT();

  // When the owner restricted the dashboard (ALLOWED_EMAILS/ALLOWED_IDS), only
  // an owner-tier account may add the bot to a new server - a guild manager
  // let in through one server must not be able to invite it to another.
  const canInvite = !restricted || (session as any)?.isOwnerTier === true;

  useEffect(() => {
    fetch('/api/gate').then((r) => r.json()).then((d) => setRestricted(!!d?.restricted)).catch(() => {});
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchGuilds();
    }
  }, [status]);

  const fetchGuilds = async () => {
    setError(null);
    try {
      const res = await fetch('/api/me/guilds', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError({
          message: data?.message || t('app.dash.loadErr', { status: res.status }),
          needsRelogin: data?.error === 'token_expired' || data?.error === 'unauthenticated'
        });
        setGuilds([]);
        return;
      }

      setGuilds(Array.isArray(data.guilds) ? data.guilds : []);
    } catch (err) {
      console.error('Error fetching guilds:', err);
      setError({ message: t('home.apiUnreachable'), needsRelogin: false });
      setGuilds([]);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#14120F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="animate-spin" style={{ width: '48px', height: '48px', border: '4px solid #14707A', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
          <p style={{ color: '#948C7C' }}>{t('app.dash.loading')}</p>
        </div>
      </div>
    );
  }

  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#14120F' }}>
      <header style={{ backgroundColor: '#1B1815', borderBottom: '1px solid #3A332A' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
              <Logo size={40} />
              <span style={{ fontSize: '18px', fontWeight: '600', color: 'white' }}>Vorqul DS BOT</span>
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {session?.user?.image && (
                  <img src={session.user.image} alt={t('app.common.avatar')} style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                )}
                <span style={{ color: '#EDE6D8' }}>{session?.user?.name}</span>
              </div>
              <LanguageSwitcher compact />
              <button onClick={() => signOut()} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
                {t('home.signOut')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
        <BotStatusPanel />

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', color: '#EDE6D8', marginBottom: '8px' }}>{t('home.yourServers')}</h1>
          <p style={{ color: '#948C7C' }}>{t('home.selectServer')}</p>
        </div>

        <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#7FA05B', borderRadius: '50%' }}></div>
            <span style={{ color: '#948C7C', fontSize: '14px' }}>{t('home.botAdded')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#D06450', borderRadius: '50%' }}></div>
            <span style={{ color: '#948C7C', fontSize: '14px' }}>{t('home.botMissing')}</span>
          </div>
        </div>

        {error ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ color: '#EDE6D8', marginBottom: '8px' }}>{t('home.loadFailed')}</h3>
            <p style={{ color: '#948C7C', marginBottom: '24px' }}>{error.message}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {error.needsRelogin ? (
                <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn btn-primary">
                  {t('home.relogin')}
                </button>
              ) : (
                <button onClick={() => { setLoading(true); fetchGuilds(); }} className="btn btn-primary">
                  {t('common.retry')}
                </button>
              )}
            </div>
          </div>
        ) : guilds.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <h3 style={{ color: '#EDE6D8', marginBottom: '8px' }}>{t('home.noServers')}</h3>
            <p style={{ color: '#948C7C', marginBottom: '24px' }}>
              {t('home.noServersHint')}
            </p>
            {canInvite && (
              <a href={`https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                {t('home.addBot')}
              </a>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {guilds.map((guild) => (
              <div key={guild.id} style={{ position: 'relative' }}>
                {guild.hasBot ? (
                  <Link href={`/dashboard/${guild.id}/settings`} style={{ textDecoration: 'none' }}>
                    <div className="card" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      cursor: 'pointer',
                      borderColor: '#7FA05B',
                      background: 'linear-gradient(135deg, rgba(87, 242, 135, 0.1), transparent)'
                    }}>
                      {guild.icon ? (
                        <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`} alt={guild.name} style={{ width: '56px', height: '56px', borderRadius: '16px' }} />
                      ) : (
                        <div style={{ width: '56px', height: '56px', backgroundColor: '#7FA05B', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '600', color: 'white' }}>
                          {guild.name.charAt(0)}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ color: 'white', fontWeight: '600', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{guild.name}</h3>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="badge badge-green">✓ {t('app.dash.botActive')}</span>
                          <span className={`badge ${guild.owner ? 'badge-blue' : 'badge-blue'}`} style={{ opacity: 0.7 }}>
                            {guild.owner ? `👑 ${t('app.dash.owner')}` : `⚙️ ${t('app.dash.admin')}`}
                          </span>
                        </div>
                      </div>
                      <svg width="20" height="20" fill="#7FA05B" viewBox="0 0 24 24">
                        <path d="M9.29 6.71a.996.996 0 0 0 0 1.41L13.17 12l-3.88 3.88a.996.996 0 1 0 1.41 1.41l4.59-4.59a.996.996 0 0 0 0-1.41L10.7 6.7c-.38-.38-1.02-.38-1.41.01z"/>
                      </svg>
                    </div>
                  </Link>
                ) : (
                  <div className="card" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    opacity: 0.7,
                    borderColor: '#3A332A'
                  }}>
                    {guild.icon ? (
                      <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`} alt={guild.name} style={{ width: '56px', height: '56px', borderRadius: '16px', filter: 'grayscale(50%)' }} />
                    ) : (
                      <div style={{ width: '56px', height: '56px', backgroundColor: '#3A332A', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '600', color: '#948C7C' }}>
                        {guild.name.charAt(0)}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ color: '#948C7C', fontWeight: '600', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{guild.name}</h3>
                      <span className="badge badge-red">✗ {t('home.botMissing')}</span>
                    </div>
                    {canInvite && (
                      <a
                        href={`https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands&guild_id=${guild.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('app.dash.add')}
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
