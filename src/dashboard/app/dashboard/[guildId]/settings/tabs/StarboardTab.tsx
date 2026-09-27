'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import MultiSelect from '../../../../components/MultiSelect';
import type { SettingsTabProps } from './types';
import { useT } from '../../../../components/LanguageProvider';

export default function StarboardTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, settings, textChannels, updateSettings } = ctx;

  return (
    <>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ color: 'white', fontWeight: '600' }}>{t('tabsB.starboard.title')}</h3>
                <input type="checkbox" checked={settings.starboard?.enabled || false} onChange={() => updateSettings('starboard.enabled', !settings.starboard?.enabled)} style={{ accentColor: '#14707A', width: '20px', height: '20px' }} />
              </div>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div><label style={labelStyle}>{t('tabsB.starboard.channel')}</label>
                  <select value={settings.starboard?.channelId || ''} onChange={(e) => updateSettings('starboard.channelId', e.target.value || null)} style={inputStyle}>
                    <option value="">{t('tabsB.common.select')}</option>
                    {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsB.common.emoji')}</label><input type="text" value={settings.starboard?.emoji || '⭐'} onChange={(e) => updateSettings('starboard.emoji', e.target.value)} style={{ ...inputStyle, width: '60px' }} /></div>
                  <div><label style={labelStyle}>{t('tabsB.starboard.minReactions')}</label><input type="number" value={settings.starboard?.threshold || 5} onChange={(e) => updateSettings('starboard.threshold', parseInt(e.target.value))} style={inputStyle} min={1} /></div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.starboard?.selfStar || false} onChange={() => updateSettings('starboard.selfStar', !settings.starboard?.selfStar)} style={{ accentColor: '#14707A' }} />
                  <span style={{ color: '#EDE6D8' }}>{t('tabsB.starboard.selfStar')}</span>
                </label>
                <div><label style={labelStyle}>{t('tabsB.starboard.ignoredChannels')}</label>
                  <MultiSelect items={textChannels} value={settings.starboard?.ignoredChannels || []} onChange={(v) => updateSettings('starboard.ignoredChannels', v)} placeholder={t('tabsB.common.searchChannel')} emptyLabel={t('tabsB.starboard.noneIgnored')} prefix="#" maxHeight={140} />
                </div>
              </div>
            </div>
    </>
  );
}
