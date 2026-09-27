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

export default function RemindersTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, settings, updateSettings } = ctx;

  return (
    <>
            <div style={cardStyle}>
              <h3 style={{ color: 'white', marginBottom: '16px', fontWeight: '600' }}>{t('tabsB.reminders.title')}</h3>
              <p style={{ color: '#948C7C', fontSize: '13px', marginBottom: '16px' }}>{t('tabsB.reminders.hint')}</p>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div><label style={labelStyle}>{t('tabsB.reminders.maxPerUser')}</label>
                  <input type="number" value={settings.reminders?.maxPerUser || 10} onChange={(e) => updateSettings('reminders.maxPerUser', parseInt(e.target.value))} style={{ ...inputStyle, width: '100px' }} />
                </div>
                <div><label style={labelStyle}>{t('tabsB.reminders.maxDuration')}</label>
                  <input type="number" value={settings.reminders?.maxDuration || 365} onChange={(e) => updateSettings('reminders.maxDuration', parseInt(e.target.value))} style={{ ...inputStyle, width: '100px' }} />
                </div>
              </div>
            </div>
    </>
  );
}
