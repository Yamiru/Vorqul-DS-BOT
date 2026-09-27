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

export default function StickyTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { btnDanger, btnPrimary, btnSecondary, cardStyle, inputStyle, labelStyle, removeStickyEntry, saveStickyEntry, setStickyForm, settings, stickyForm, textChannels } = ctx;

  return (
    <>
            <div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '6px', fontWeight: '600' }}>{t('tabsB.sticky.title')}</h3>
                <p style={{ color: '#948C7C', fontSize: '12px', marginBottom: '14px' }}>{(() => {
                  const parts = t('tabsB.sticky.intro', { cmd: '@@CMD@@' }).split('@@CMD@@');
                  return <>{parts[0]}<code>/sticky set</code>{parts[1]}</>;
                })()}</p>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsB.common.channel')}</label>
                    <select value={stickyForm.channelId} onChange={(e) => setStickyForm({ ...stickyForm, channelId: e.target.value })} style={inputStyle}>
                      <option value="">{t('tabsB.common.select')}</option>
                      {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                  </div>
                  <div><label style={labelStyle}>{t('tabsB.common.message')}</label><textarea value={stickyForm.content} onChange={(e) => setStickyForm({ ...stickyForm, content: e.target.value })} rows={3} style={inputStyle} placeholder={t('tabsB.sticky.messagePh')} /></div>
                  <div>
                    <label style={labelStyle}>{t('tabsB.common.messageType')}</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => setStickyForm({ ...stickyForm, useEmbed: false })} style={!stickyForm.useEmbed ? btnPrimary : btnSecondary}>💬 {t('tabsB.sticky.plainText')}</button>
                      <button type="button" onClick={() => setStickyForm({ ...stickyForm, useEmbed: true })} style={stickyForm.useEmbed ? btnPrimary : btnSecondary}>📋 {t('tabsB.sticky.embed')}</button>
                    </div>
                  </div>
                  {stickyForm.useEmbed && (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                      <div><label style={labelStyle}>{t('tabsB.sticky.embedTitle')}</label><input type="text" value={stickyForm.title} onChange={(e) => setStickyForm({ ...stickyForm, title: e.target.value })} style={inputStyle} /></div>
                      <div><label style={labelStyle}>{t('tabsB.common.color')}</label><input type="color" value={stickyForm.color} onChange={(e) => setStickyForm({ ...stickyForm, color: e.target.value })} style={{ width: '100%', height: '38px', border: 'none', borderRadius: '6px' }} /></div>
                    </div>
                  )}
                  <div><button onClick={saveStickyEntry} style={btnPrimary}>➕ {t('tabsB.sticky.addUpdate')}</button></div>
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '14px', fontWeight: '600' }}>{t('tabsB.sticky.active')}</h3>
                {(!((settings as any).sticky) || (settings as any).sticky.length === 0) ? (
                  <p style={{ color: '#948C7C', fontSize: '13px' }}>{t('tabsB.sticky.none')}</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {(settings as any).sticky.map((s: any) => (
                      <div key={s.channelId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1B1815', padding: '10px 12px', borderRadius: '6px' }}>
                        <span style={{ color: '#EDE6D8', fontSize: '13px' }}>#{textChannels.find(c => c.id === s.channelId)?.name || s.channelId} - {s.useEmbed ? t('tabsB.sticky.kindEmbed') : t('tabsB.sticky.kindText')}: {(s.content || '').slice(0, 50)}</span>
                        <button onClick={() => removeStickyEntry(s.channelId)} style={btnDanger}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ color: '#948C7C', fontSize: '11px', marginTop: '10px' }}>{t('tabsB.sticky.saveHint')}</p>
              </div>
            </div>
    </>
  );
}
