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

export default function CountingTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, roles, settings, textChannels, updateSettings } = ctx;

  return (
    <>
            <div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsA.counting.title')}</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.modules?.counting?.enabled || false} onChange={() => updateSettings('modules.counting.enabled', !settings.modules?.counting?.enabled)} style={{ accentColor: '#14707A' }} />
                  <span style={{ color: '#EDE6D8' }}>{t('tabsA.counting.enable')}</span>
                </label>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsA.counting.channel')}</label>
                    <select value={settings.modules?.counting?.channel || ''} onChange={(e) => updateSettings('modules.counting.channel', e.target.value)} style={inputStyle}>
                      <option value="">{t('tabsA.common.select')}</option>
                      {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={settings.modules?.counting?.allowSameUser || false} onChange={() => updateSettings('modules.counting.allowSameUser', !settings.modules?.counting?.allowSameUser)} style={{ accentColor: '#14707A' }} />
                    <span style={{ color: '#EDE6D8' }}>{t('tabsA.counting.allowSameUser')}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={settings.modules?.counting?.deleteWrong || false} onChange={() => updateSettings('modules.counting.deleteWrong', !settings.modules?.counting?.deleteWrong)} style={{ accentColor: '#14707A' }} />
                    <span style={{ color: '#EDE6D8' }}>{t('tabsA.counting.deleteWrong')}</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                    <div><label style={labelStyle}>{t('tabsA.counting.goal')}</label>
                      <input type="number" min={0} value={settings.modules?.counting?.goal || 0} onChange={(e) => updateSettings('modules.counting.goal', parseInt(e.target.value) || 0)} style={inputStyle} />
                    </div>
                    <div><label style={labelStyle}>{t('tabsA.counting.goalRole')}</label>
                      <select value={settings.modules?.counting?.goalRole || ''} onChange={(e) => updateSettings('modules.counting.goalRole', e.target.value)} style={inputStyle}>
                        <option value="">{t('tabsA.common.none')}</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ ...inputStyle, backgroundColor: '#1B1815', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#948C7C', fontSize: '12px' }}>{t('tabsA.counting.currentCount')}</span>
                    <span style={{ color: '#EDE6D8', fontSize: '13px' }}>{t('tabsA.counting.countAndBest', { count: settings.modules?.counting?.currentCount || 0, best: settings.modules?.counting?.highScore || 0 })}</span>
                  </div>
                </div>
              </div>
            </div>
    </>
  );
}
