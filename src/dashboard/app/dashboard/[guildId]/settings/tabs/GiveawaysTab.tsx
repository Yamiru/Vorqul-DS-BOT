'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useT } from '../../../../components/LanguageProvider';
import type { SettingsTabProps } from './types';

export default function GiveawaysTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, roles, settings, textChannels, updateSettings } = ctx;

  return (
    <>
            <div style={cardStyle}>
              <div style={{ backgroundColor: 'rgba(88,101,242,0.1)', border: '1px solid rgba(88,101,242,0.4)', borderRadius: '8px', padding: '14px 16px', marginBottom: '18px' }}>
                <div style={{ color: 'white', fontWeight: '600', marginBottom: '6px' }}>{t('tabsA.giveaways.howToTitle')}</div>
                <p style={{ color: '#EDE6D8', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                  {t('tabsA.giveaways.howToIntro', { command: '/giveaway start' })}
                </p>
                <ul style={{ color: '#948C7C', fontSize: '12px', lineHeight: 1.8, margin: '8px 0 0', paddingLeft: '18px' }}>
                  <li><b>prize</b> - {t('tabsA.giveaways.optPrize')}</li>
                  <li><b>duration</b> - {t('tabsA.giveaways.optDuration')}</li>
                  <li><b>winners</b> - {t('tabsA.giveaways.optWinners')}</li>
                  <li><b>channel</b> / <b>required_role</b> - {t('tabsA.giveaways.optOptional')}</li>
                </ul>
                <p style={{ color: '#948C7C', fontSize: '12px', margin: '8px 0 0' }}>
                  {t('tabsA.giveaways.howToOutro', { end: '/giveaway end', reroll: '/giveaway reroll', list: '/giveaway list' })}
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ color: 'white', fontWeight: '600' }}>{t('tabsA.giveaways.title')}</h3>
                <input type="checkbox" checked={settings.giveaways?.enabled || false} onChange={() => updateSettings('giveaways.enabled', !settings.giveaways?.enabled)} style={{ accentColor: '#14707A', width: '20px', height: '20px' }} />
              </div>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div><label style={labelStyle}>{t('tabsA.giveaways.channel')}</label>
                  <select value={settings.giveaways?.channel || ''} onChange={(e) => updateSettings('giveaways.channel', e.target.value || null)} style={inputStyle}>
                    <option value="">{t('tabsA.giveaways.any')}</option>
                    {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsA.giveaways.emoji')}</label><input type="text" value={settings.giveaways?.emoji || '🎉'} onChange={(e) => updateSettings('giveaways.emoji', e.target.value)} style={{ ...inputStyle, width: '60px' }} /></div>
                  <div><label style={labelStyle}>{t('tabsA.giveaways.color')}</label><input type="color" value={settings.giveaways?.color || '#14707A'} onChange={(e) => updateSettings('giveaways.color', e.target.value)} style={{ width: '60px', height: '38px', border: 'none', borderRadius: '6px' }} /></div>
                  <div><label style={labelStyle}>{t('tabsA.giveaways.managerRole')}</label>
                    <select value={settings.giveaways?.managerRole || ''} onChange={(e) => updateSettings('giveaways.managerRole', e.target.value || null)} style={inputStyle}>
                      <option value="">{t('tabsA.common.none')}</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.giveaways?.dmWinners || false} onChange={() => updateSettings('giveaways.dmWinners', !settings.giveaways?.dmWinners)} style={{ accentColor: '#14707A' }} />
                  <span style={{ color: '#EDE6D8' }}>{t('tabsA.giveaways.dmWinners')}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.giveaways?.requireRole || false} onChange={() => updateSettings('giveaways.requireRole', !settings.giveaways?.requireRole)} style={{ accentColor: '#14707A' }} />
                  <span style={{ color: '#EDE6D8' }}>{t('tabsA.giveaways.requireRole')}</span>
                </label>
              </div>
            </div>
    </>
  );
}
