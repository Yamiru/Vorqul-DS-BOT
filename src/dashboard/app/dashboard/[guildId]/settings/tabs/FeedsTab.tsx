'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useState } from 'react';
import { useT } from '../../../../components/LanguageProvider';
import type { SettingsTabProps } from './types';

export default function FeedsTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { btnDanger, btnSecondary, cardStyle, guildId, inputStyle, settings, textChannels, updateSettings } = ctx;
  const [forcing, setForcing] = useState<number | null>(null);
  const [forceMsg, setForceMsg] = useState<{ index: number; kind: 'ok' | 'error'; text: string } | null>(null);

  const forceSend = async (i: number) => {
    setForcing(i);
    setForceMsg(null);
    try {
      const res = await fetch(`/api/guilds/${guildId}/feeds/force`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: i })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setForceMsg({ index: i, kind: 'error', text: data.error || t('tabsA.feeds.forceError') });
        return;
      }
      setForceMsg({ index: i, kind: 'ok', text: t('tabsA.feeds.forceSent', { title: data.title || '' }) });
    } catch {
      setForceMsg({ index: i, kind: 'error', text: t('tabsA.feeds.forceError') });
    } finally {
      setForcing(null);
    }
  };

  return (
    <>
            <div style={cardStyle}>
              <h3 style={{ color: 'white', marginBottom: '16px', fontWeight: '600' }}>{t('tabsA.feeds.title')}</h3>
              <p style={{ color: '#948C7C', fontSize: '13px', marginBottom: '16px' }}>{t('tabsA.feeds.intro')}</p>
              {(settings.feeds || []).map((feed: any, i: number) => (
                <div key={i} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: '8px', alignItems: 'center' }}>
                    <input type="text" value={feed.url} onChange={(e) => { const f = [...(settings.feeds || [])]; f[i].url = e.target.value; updateSettings('feeds', f); }} placeholder={t('tabsA.feeds.urlPlaceholder')} style={inputStyle} />
                    <select value={feed.channel} onChange={(e) => { const f = [...(settings.feeds || [])]; f[i].channel = e.target.value; updateSettings('feeds', f); }} style={inputStyle}>
                      <option value="">{t('tabsA.feeds.channel')}</option>
                      {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => forceSend(i)}
                      disabled={forcing === i || !feed.url || !feed.channel}
                      style={{ ...btnSecondary, opacity: (forcing === i || !feed.url || !feed.channel) ? 0.6 : 1 }}
                      title={t('tabsA.feeds.forceHint')}
                    >
                      {forcing === i ? '⏳' : '📤'} {t('tabsA.feeds.force')}
                    </button>
                    <button onClick={() => updateSettings('feeds', (settings.feeds || []).filter((_: any, idx: number) => idx !== i))} style={btnDanger}>✕</button>
                  </div>
                  {forceMsg?.index === i && (
                    <p style={{ fontSize: '11px', marginTop: '4px', color: forceMsg.kind === 'ok' ? '#6E8F4E' : '#D06450' }}>{forceMsg.text}</p>
                  )}
                </div>
              ))}
              <button onClick={() => updateSettings('feeds', [...(settings.feeds || []), { url: '', channel: '' }])} style={btnSecondary}>{t('tabsA.autoresponse.add')}</button>
            </div>
    </>
  );
}
