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

export default function TagsTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { btnDanger, btnSecondary, cardStyle, inputStyle, settings, updateSettings } = ctx;

  return (
    <>
            <div style={cardStyle}>
              <h3 style={{ color: 'white', marginBottom: '16px', fontWeight: '600' }}>{t('tabsB.tags.title')}</h3>
              <p style={{ color: '#948C7C', fontSize: '13px', marginBottom: '16px' }}>{t('tabsB.tags.hint')}</p>
              {(settings.tags || []).map((tag: any, i: number) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <input type="text" value={tag.name} onChange={(e) => { const t = [...(settings.tags || [])]; t[i].name = e.target.value; updateSettings('tags', t); }} placeholder={t('tabsB.tags.namePh')} style={inputStyle} />
                  <input type="text" value={tag.content} onChange={(e) => { const t = [...(settings.tags || [])]; t[i].content = e.target.value; updateSettings('tags', t); }} placeholder={t('tabsB.tags.contentPh')} style={inputStyle} />
                  <button onClick={() => updateSettings('tags', (settings.tags || []).filter((_: any, idx: number) => idx !== i))} style={btnDanger}>✕</button>
                </div>
              ))}
              <button onClick={() => updateSettings('tags', [...(settings.tags || []), { name: '', content: '' }])} style={btnSecondary}>{t('tabsB.common.add')}</button>
            </div>
    </>
  );
}
