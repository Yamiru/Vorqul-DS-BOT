'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import ListInput from '../../../../components/ListInput';
import { useT } from '../../../../components/LanguageProvider';
import type { SettingsTabProps } from './types';

export default function ApplicationsTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, roles, settings, textChannels, updateSettings } = ctx;

  return (
    <>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ color: 'white', fontWeight: '600' }}>{t('tabsA.applications.title')}</h3>
                <input type="checkbox" checked={settings.applications?.enabled || false} onChange={() => updateSettings('applications.enabled', !settings.applications?.enabled)} style={{ accentColor: '#14707A', width: '20px', height: '20px' }} />
              </div>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div><label style={labelStyle}>{t('tabsA.applications.channel')}</label>
                  <select value={settings.applications?.channel || ''} onChange={(e) => updateSettings('applications.channel', e.target.value || null)} style={inputStyle}>
                    <option value="">{t('tabsA.common.select')}</option>
                    {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>{t('tabsA.applications.reviewChannel')}</label>
                  <select value={settings.applications?.reviewChannel || ''} onChange={(e) => updateSettings('applications.reviewChannel', e.target.value || null)} style={inputStyle}>
                    <option value="">{t('tabsA.common.select')}</option>
                    {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>{t('tabsA.applications.approvedRole')}</label>
                  <select value={settings.applications?.approvedRole || ''} onChange={(e) => updateSettings('applications.approvedRole', e.target.value || null)} style={inputStyle}>
                    <option value="">{t('tabsA.common.none')}</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>{t('tabsA.applications.questions')}</label>
                  <ListInput value={settings.applications?.questions || []} onChange={(v) => updateSettings('applications.questions', v)} mode="lines" rows={5} style={inputStyle} placeholder={t('tabsA.applications.questionsPlaceholder')} />
                </div>
              </div>
            </div>
    </>
  );
}
