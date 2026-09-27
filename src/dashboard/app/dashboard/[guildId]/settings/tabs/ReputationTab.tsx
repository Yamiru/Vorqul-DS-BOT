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

export default function ReputationTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, roles, settings, updateSettings } = ctx;

  return (
    <>
            <div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsB.reputation.title')}</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.reputation?.enabled ?? true} onChange={() => updateSettings('reputation.enabled', !(settings.reputation?.enabled ?? true))} style={{ accentColor: '#14707A' }} />
                  <span style={{ color: '#EDE6D8' }}>{t('tabsB.reputation.enable')} (<code>/rep</code>)</span>
                </label>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsB.reputation.cooldown')}</label>
                    <input type="number" min={0} value={settings.reputation?.cooldownHours ?? 12} onChange={(e) => updateSettings('reputation.cooldownHours', parseInt(e.target.value) || 0)} style={{ ...inputStyle, width: '120px' }} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={settings.reputation?.allowNegative ?? true} onChange={() => updateSettings('reputation.allowNegative', !(settings.reputation?.allowNegative ?? true))} style={{ accentColor: '#14707A' }} />
                    <span style={{ color: '#EDE6D8' }}>{t('tabsB.reputation.allowNegative')} (<code>/rep remove</code>)</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                    <div><label style={labelStyle}>{t('tabsB.reputation.rewardRole')}</label>
                      <select value={settings.reputation?.rewardRole || ''} onChange={(e) => updateSettings('reputation.rewardRole', e.target.value)} style={inputStyle}>
                        <option value="">{t('tabsB.common.none')}</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    <div><label style={labelStyle}>{t('tabsB.reputation.threshold')}</label>
                      <input type="number" min={0} value={settings.reputation?.rewardThreshold || 0} onChange={(e) => updateSettings('reputation.rewardThreshold', parseInt(e.target.value) || 0)} style={inputStyle} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
    </>
  );
}
