'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import ListInput from '../../../../components/ListInput';
import type { SettingsTabProps } from './types';
import { useT } from '../../../../components/LanguageProvider';

export default function SocialsTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, roles, settings, textChannels, updateSettings } = ctx;

  return (
    <>
            <div style={{ display: 'grid', gap: '16px' }}>
              <p style={{ color: '#948C7C', fontSize: '13px', margin: 0 }}>{t('tabsB.socials.intro')}</p>
              {[
                { key: 'youtube', label: '📺 YouTube', accLabel: t('tabsB.socials.accYoutube'), accPh: 'UC...' },
                { key: 'twitch', label: '🎮 Twitch', accLabel: t('tabsB.socials.accTwitch'), accPh: 'shroud' },
                { key: 'reddit', label: '📰 Reddit', accLabel: t('tabsB.socials.accReddit'), accPh: 'gaming' },
                { key: 'rss', label: '📡 RSS', accLabel: t('tabsB.socials.accRss'), accPh: 'https://example.com/feed.xml' },
              ].map((net) => {
                const cfg: any = (settings.socials?.[net.key]) || {};
                return (
                  <div key={net.key} style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: cfg.enabled ? '14px' : '0' }}>
                      <h3 style={{ color: 'white', fontWeight: '600' }}>{net.label}</h3>
                      <input type="checkbox" checked={!!cfg.enabled} onChange={() => updateSettings(`socials.${net.key}.enabled`, !cfg.enabled)} style={{ accentColor: '#14707A', width: '20px', height: '20px' }} />
                    </div>
                    {cfg.enabled && (
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <div><label style={labelStyle}>{t('tabsB.socials.notifChannel')}</label>
                          <select value={cfg.channel || ''} onChange={(e) => updateSettings(`socials.${net.key}.channel`, e.target.value || null)} style={inputStyle}>
                            <option value="">{t('tabsB.common.select')}</option>
                            {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                          </select>
                        </div>
                        <div><label style={labelStyle}>{net.accLabel}</label>
                          <ListInput value={cfg.accounts || []} onChange={(v) => updateSettings(`socials.${net.key}.accounts`, v)} rows={3} style={inputStyle} placeholder={net.accPh} />
                        </div>
                        <div><label style={labelStyle}>{t('tabsB.socials.mentionRole')}</label>
                          <select value={cfg.mention || ''} onChange={(e) => updateSettings(`socials.${net.key}.mention`, e.target.value || null)} style={inputStyle}>
                            <option value="">{t('tabsB.common.none')}</option>
                            {roles.map(r => <option key={r.id} value={r.id}>@{r.name}</option>)}
                          </select>
                        </div>
                        <div><label style={labelStyle}>{t('tabsB.socials.customMessage')}</label>
                          <input type="text" value={cfg.message || ''} onChange={(e) => updateSettings(`socials.${net.key}.message`, e.target.value)} style={inputStyle} placeholder={t('tabsB.socials.customPh')} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
    </>
  );
}
