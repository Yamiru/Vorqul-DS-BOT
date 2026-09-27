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

export default function AutoresponseTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { btnDanger, btnSecondary, cardStyle, inputStyle, settings, updateSettings } = ctx;

  return (
    <>
            <div style={cardStyle}>
              <h3 style={{ color: 'white', marginBottom: '16px', fontWeight: '600' }}>{t('tabsA.autoresponse.title')}</h3>
              <p style={{ color: '#948C7C', fontSize: '13px', marginBottom: '16px' }}>{t('tabsA.autoresponse.intro')}</p>
              {(settings.autoResponses || []).map((ar: any, i: number) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <input type="text" value={ar.trigger} onChange={(e) => { const ars = [...(settings.autoResponses || [])]; ars[i].trigger = e.target.value; updateSettings('autoResponses', ars); }} placeholder={t('tabsA.autoresponse.trigger')} style={inputStyle} />
                  <input type="text" value={ar.response} onChange={(e) => { const ars = [...(settings.autoResponses || [])]; ars[i].response = e.target.value; updateSettings('autoResponses', ars); }} placeholder={t('tabsA.autoresponse.answer')} style={inputStyle} />
                  <button onClick={() => updateSettings('autoResponses', (settings.autoResponses || []).filter((_: any, idx: number) => idx !== i))} style={btnDanger}>✕</button>
                </div>
              ))}
              <button onClick={() => updateSettings('autoResponses', [...(settings.autoResponses || []), { trigger: '', response: '' }])} style={btnSecondary}>{t('tabsA.autoresponse.add')}</button>
            </div>
    </>
  );
}
