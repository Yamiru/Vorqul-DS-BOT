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

export default function BirthdayTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { btnPrimary, btnSecondary, cardStyle, inputStyle, labelStyle, roles, settings, textChannels, updateSettings } = ctx;

  return (
    <>
            <div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsA.birthday.title')}</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.birthday?.enabled || false} onChange={() => updateSettings('birthday.enabled', !settings.birthday?.enabled)} style={{ accentColor: '#14707A' }} />
                  <span style={{ color: '#EDE6D8' }}>{t('tabsA.birthday.enable')}</span>
                </label>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsA.birthday.channel')}</label>
                    <select value={settings.birthday?.channel || ''} onChange={(e) => updateSettings('birthday.channel', e.target.value)} style={inputStyle}>
                      <option value="">{t('tabsA.common.select')}</option>
                      {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                  </div>
                  <div><label style={labelStyle}>{t('tabsA.birthday.role')}</label>
                    <select value={settings.birthday?.role || ''} onChange={(e) => updateSettings('birthday.role', e.target.value)} style={inputStyle}>
                      <option value="">{t('tabsA.common.none')}</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div><label style={labelStyle}>{t('tabsA.birthday.message', { user: '{user}', username: '{username}', age: '{age}', server: '{server}' })}</label><textarea value={settings.birthday?.message || ''} onChange={(e) => updateSettings('birthday.message', e.target.value)} rows={2} style={inputStyle} placeholder={t('tabsA.birthday.messagePlaceholder', { user: '{user}' })} /></div>
                  <div>
                    <label style={labelStyle}>{t('tabsA.birthday.messageType')}</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => updateSettings('birthday.useEmbed', false)} style={!settings.birthday?.useEmbed ? btnPrimary : btnSecondary}>{t('tabsA.birthday.plainText')}</button>
                      <button type="button" onClick={() => updateSettings('birthday.useEmbed', true)} style={settings.birthday?.useEmbed ? btnPrimary : btnSecondary}>{t('tabsA.birthday.embed')}</button>
                    </div>
                  </div>
                  {settings.birthday?.useEmbed && (
                    <div><label style={labelStyle}>{t('tabsA.birthday.embedColor')}</label><input type="color" value={settings.birthday?.color || '#E3C766'} onChange={(e) => updateSettings('birthday.color', e.target.value)} style={{ width: '120px', height: '38px', border: 'none', borderRadius: '6px' }} /></div>
                  )}
                </div>
              </div>
              <div style={cardStyle}>
                <p style={{ color: '#948C7C', fontSize: '12px', margin: 0 }}>{t('tabsA.birthday.help', { set: '/birthday set', view: '/birthday view', list: '/birthday list' })}</p>
              </div>
            </div>
    </>
  );
}
