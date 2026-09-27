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

export default function ConfessionsTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, settings, textChannels, updateSettings } = ctx;

  return (
    <>
            <div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsA.confessions.title')}</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.confessions?.enabled || false} onChange={() => updateSettings('confessions.enabled', !settings.confessions?.enabled)} style={{ accentColor: '#14707A' }} />
                  <span style={{ color: '#EDE6D8' }}>{t('tabsA.confessions.enable', { command: '/confess' })}</span>
                </label>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsA.confessions.channel')}</label>
                    <select value={settings.confessions?.channel || ''} onChange={(e) => updateSettings('confessions.channel', e.target.value)} style={inputStyle}>
                      <option value="">{t('tabsA.common.select')}</option>
                      {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                  </div>
                  <div><label style={labelStyle}>{t('tabsA.confessions.logChannel')}</label>
                    <select value={settings.confessions?.logChannel || ''} onChange={(e) => updateSettings('confessions.logChannel', e.target.value)} style={inputStyle}>
                      <option value="">{t('tabsA.common.none')}</option>
                      {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={settings.confessions?.allowReplies ?? true} onChange={() => updateSettings('confessions.allowReplies', !(settings.confessions?.allowReplies ?? true))} style={{ accentColor: '#14707A' }} />
                    <span style={{ color: '#EDE6D8' }}>{t('tabsA.confessions.allowReplies')}</span>
                  </label>
                  <div><label style={labelStyle}>{t('tabsA.confessions.minAccountAge')}</label>
                    <input type="number" min={0} value={settings.confessions?.minAccountAgeDays || 0} onChange={(e) => updateSettings('confessions.minAccountAgeDays', parseInt(e.target.value) || 0)} style={{ ...inputStyle, width: '120px' }} />
                  </div>
                </div>
              </div>
              <div style={cardStyle}>
                <p style={{ color: '#948C7C', fontSize: '12px', margin: 0 }}>{t('tabsA.confessions.help')}</p>
              </div>
            </div>
    </>
  );
}
