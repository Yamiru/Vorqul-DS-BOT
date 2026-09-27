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

export default function AppealsTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, settings, textChannels, updateSettings } = ctx;

  return (
    <>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ color: 'white', fontWeight: '600' }}>{t('tabsA.appeals.title')}</h3>
              </div>
              <p style={{ color: '#948C7C', fontSize: '12px', marginBottom: '16px' }}>{t('tabsA.appeals.intro', { command: '/appeal' })}</p>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>{t('tabsA.appeals.channel')}</label>
                  <select value={settings.moderation?.appealsChannel || ''} onChange={(e) => updateSettings('moderation.appealsChannel', e.target.value || null)} style={inputStyle}>
                    <option value="">{t('tabsA.common.none')}</option>
                    {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{t('tabsA.appeals.instructions')}</label>
                  <textarea value={settings.appealInfo?.instructions || ''} onChange={(e) => updateSettings('appealInfo.instructions', e.target.value)} rows={3} style={inputStyle} placeholder={t('tabsA.appeals.instructionsPlaceholder')} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.appealInfo?.enabled || false} onChange={() => updateSettings('appealInfo.enabled', !settings.appealInfo?.enabled)} style={{ accentColor: '#14707A', width: '18px', height: '18px' }} />
                  <span style={{ color: '#EDE6D8', fontSize: '13px' }}>{t('tabsA.appeals.enablePublic')}</span>
                </label>
              </div>
            </div>
    </>
  );
}
