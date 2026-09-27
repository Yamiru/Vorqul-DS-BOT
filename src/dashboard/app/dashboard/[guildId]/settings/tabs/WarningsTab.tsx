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

export default function WarningsTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { btnDanger, btnSecondary, cardStyle, inputStyle, roles, settings, updateSettings } = ctx;

  return (
    <>
            <div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsB.warnings.title')}</h3>
                <p style={{ color: '#948C7C', fontSize: '12px', marginBottom: '12px' }}>{t('tabsB.warnings.hint')}</p>
                {(settings.warningActions || []).map((wa: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="number" value={wa.count} onChange={(e) => { const waa = [...(settings.warningActions || [])]; waa[i].count = parseInt(e.target.value); updateSettings('warningActions', waa); }} style={{ ...inputStyle, width: '60px' }} />
                    <span style={{ color: '#948C7C', fontSize: '12px' }}>{t('tabsB.warnings.warnsWithin')}</span>
                    <input type="number" value={wa.days} onChange={(e) => { const waa = [...(settings.warningActions || [])]; waa[i].days = parseInt(e.target.value); updateSettings('warningActions', waa); }} style={{ ...inputStyle, width: '60px' }} />
                    <span style={{ color: '#948C7C', fontSize: '12px' }}>{t('tabsB.warnings.daysArrow')}</span>
                    <select value={wa.action} onChange={(e) => { const waa = [...(settings.warningActions || [])]; waa[i].action = e.target.value; updateSettings('warningActions', waa); }} style={{ ...inputStyle, width: '100px' }}>
                      <option value="mute">{t('tabsB.warnings.mute')}</option>
                      <option value="kick">{t('tabsB.warnings.kick')}</option>
                      <option value="tempban">{t('tabsB.warnings.tempban')}</option>
                      <option value="ban">{t('tabsB.warnings.ban')}</option>
                    </select>
                    <button onClick={() => updateSettings('warningActions', (settings.warningActions || []).filter((_: any, idx: number) => idx !== i))} style={btnDanger}>✕</button>
                  </div>
                ))}
                <button onClick={() => updateSettings('warningActions', [...(settings.warningActions || []), { count: 3, days: 7, action: 'mute' }])} style={btnSecondary}>{t('tabsB.common.add')}</button>
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsB.warnings.immunity')}</h3>
                <MultiSelect items={roles} value={settings.immunityRoles || []} onChange={(v) => updateSettings('immunityRoles', v)} placeholder={t('tabsB.common.searchRole')} emptyLabel={t('tabsB.warnings.noImmune')} prefix="@" />
              </div>
            </div>
    </>
  );
}
