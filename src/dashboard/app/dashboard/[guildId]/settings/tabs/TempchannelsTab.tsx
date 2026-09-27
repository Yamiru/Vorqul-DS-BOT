'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import type { SettingsTabProps } from './types';
import { useT } from '../../../../components/LanguageProvider';

export default function TempchannelsTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, categories, inputStyle, labelStyle, settings, updateSettings, voiceChannels } = ctx;

  return (
    <>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ color: 'white', fontWeight: '600' }}>{t('tabsB.temp.title')}</h3>
                <input type="checkbox" checked={settings.tempChannels?.enabled || false} onChange={() => updateSettings('tempChannels.enabled', !settings.tempChannels?.enabled)} style={{ accentColor: '#14707A', width: '20px', height: '20px' }} />
              </div>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div><label style={labelStyle}>{t('tabsB.temp.hub')}</label>
                  <select value={settings.tempChannels?.hubChannel || ''} onChange={(e) => updateSettings('tempChannels.hubChannel', e.target.value || null)} style={inputStyle}>
                    <option value="">{t('tabsB.common.select')}</option>
                    {voiceChannels.map(c => <option key={c.id} value={c.id}>🔊 {c.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>{t('tabsB.temp.category')}</label>
                  <select value={settings.tempChannels?.category || ''} onChange={(e) => updateSettings('tempChannels.category', e.target.value || null)} style={inputStyle}>
                    <option value="">{t('tabsB.temp.sameCategory')}</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>{t('tabsB.temp.nameFormat')}</label><input type="text" value={settings.tempChannels?.nameFormat || ''} onChange={(e) => updateSettings('tempChannels.nameFormat', e.target.value)} style={inputStyle} placeholder={t('tabsB.temp.nameFormatPh')} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsB.temp.limit')}</label><input type="number" value={settings.tempChannels?.userLimit || 0} onChange={(e) => updateSettings('tempChannels.userLimit', parseInt(e.target.value))} style={inputStyle} min={0} max={99} /></div>
                  <div><label style={labelStyle}>{t('tabsB.temp.bitrate')}</label><input type="number" value={settings.tempChannels?.bitrate || 64} onChange={(e) => updateSettings('tempChannels.bitrate', parseInt(e.target.value))} style={inputStyle} /></div>
                </div>
              </div>
            </div>
    </>
  );
}
