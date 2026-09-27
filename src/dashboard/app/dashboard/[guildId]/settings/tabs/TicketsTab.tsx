'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useState } from 'react';
import MultiSelect from '../../../../components/MultiSelect';
import type { SettingsTabProps } from './types';
import { useT } from '../../../../components/LanguageProvider';

export default function TicketsTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { btnDanger, btnPrimary, btnSecondary, cardStyle, categories, deployPanel, inputStyle, labelStyle, roles, settings, textChannels, updateSettings } = ctx;
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      await deployPanel(t('tabsB.tickets.panelName'), 'tickets/deploy', settings.tickets);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
            <div>
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ color: 'white', fontWeight: '600' }}>{t('tabsB.tickets.title')}</h3>
                  <input type="checkbox" checked={settings.tickets?.enabled || false} onChange={() => updateSettings('tickets.enabled', !settings.tickets?.enabled)} style={{ accentColor: '#14707A', width: '20px', height: '20px' }} />
                </div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div><label style={labelStyle}>{t('tabsB.tickets.panelChannel')}</label>
                      <select value={settings.tickets?.panelChannel || ''} onChange={(e) => updateSettings('tickets.panelChannel', e.target.value || null)} style={inputStyle}>
                        <option value="">{t('tabsB.common.select')}</option>
                        {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                      </select>
                    </div>
                    <div><label style={labelStyle}>{t('tabsB.tickets.ticketCategory')}</label>
                      <select value={settings.tickets?.categoryId || ''} onChange={(e) => updateSettings('tickets.categoryId', e.target.value || null)} style={inputStyle}>
                        <option value="">{t('tabsB.common.select')}</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><label style={labelStyle}>{t('tabsB.common.supportRole')}</label>
                    <MultiSelect items={roles} value={settings.tickets?.supportRoles || []} onChange={(v) => updateSettings('tickets.supportRoles', v)} placeholder={t('tabsB.common.searchRole')} emptyLabel={t('tabsB.tickets.noSupportRole')} prefix="@" maxHeight={140} />
                  </div>
                  <div><label style={labelStyle}>{t('tabsB.tickets.transcriptChannel')}</label>
                    <select value={settings.tickets?.transcriptChannel || ''} onChange={(e) => updateSettings('tickets.transcriptChannel', e.target.value || null)} style={inputStyle}>
                      <option value="">{t('tabsB.common.none')}</option>
                      {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                  </div>
                  <div><label style={labelStyle}>{t('tabsB.tickets.maxPerUser')}</label>
                    <input type="number" value={settings.tickets?.maxTicketsPerUser || 1} onChange={(e) => updateSettings('tickets.maxTicketsPerUser', parseInt(e.target.value))} style={{ ...inputStyle, width: '80px' }} />
                  </div>
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsB.tickets.panel')}</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                    <div><label style={labelStyle}>{t('tabsB.common.title')}</label><input type="text" value={settings.tickets?.panelTitle || ''} onChange={(e) => updateSettings('tickets.panelTitle', e.target.value)} style={inputStyle} placeholder={t('tabsB.tickets.panelTitlePh')} /></div>
                    <div><label style={labelStyle}>{t('tabsB.common.color')}</label><input type="color" value={settings.tickets?.panelColor || '#14707A'} onChange={(e) => updateSettings('tickets.panelColor', e.target.value)} style={{ width: '100%', height: '38px', border: 'none', borderRadius: '6px' }} /></div>
                  </div>
                  <div><label style={labelStyle}>{t('tabsB.common.description')}</label><textarea value={settings.tickets?.panelDescription || ''} onChange={(e) => updateSettings('tickets.panelDescription', e.target.value)} rows={2} style={inputStyle} placeholder={t('tabsB.tickets.panelDescPh')} /></div>
                  <div><label style={labelStyle}>{t('tabsB.common.buttonText')}</label><input type="text" value={settings.tickets?.buttonText || ''} onChange={(e) => updateSettings('tickets.buttonText', e.target.value)} style={inputStyle} placeholder={t('tabsB.tickets.buttonTextPh')} /></div>
                  <div><label style={labelStyle}>{t('tabsB.tickets.welcomeInTicket')}</label><textarea value={settings.tickets?.welcomeMessage || ''} onChange={(e) => updateSettings('tickets.welcomeMessage', e.target.value)} rows={2} style={inputStyle} placeholder={t('tabsB.tickets.welcomePh')} /></div>
                </div>

                <div style={{ marginTop: '18px', borderTop: '1px solid #221E19', paddingTop: '14px' }}>
                  <h4 style={{ color: 'white', marginBottom: '6px', fontWeight: '600' }}>{t('tabsB.tickets.categoriesTitle')}</h4>
                  <p style={{ color: '#948C7C', fontSize: '12px', marginBottom: '12px' }}>{t('tabsB.tickets.categoriesHint')}</p>
                  {(settings.tickets?.categories || []).map((cat: any, i: number) => (
                    <div key={i} style={{ ...cardStyle, marginBottom: '10px', padding: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px', gap: '8px', marginBottom: '8px' }}>
                        <div><label style={labelStyle}>{t('tabsB.tickets.buttonName')}</label><input type="text" value={cat.label || ''} onChange={(e) => { const cs = [...(settings.tickets?.categories || [])]; cs[i] = { ...cs[i], label: e.target.value }; updateSettings('tickets.categories', cs); }} style={inputStyle} placeholder={t('tabsB.tickets.defaultCategoryLabel')} /></div>
                        <div><label style={labelStyle}>{t('tabsB.common.emoji')}</label><input type="text" value={cat.emoji || ''} onChange={(e) => { const cs = [...(settings.tickets?.categories || [])]; cs[i] = { ...cs[i], emoji: e.target.value }; updateSettings('tickets.categories', cs); }} style={inputStyle} placeholder="🎫" /></div>
                      </div>
                      <div style={{ marginBottom: '8px' }}><label style={labelStyle}>{t('tabsB.tickets.discordCategory')}</label>
                        <select value={cat.categoryId || ''} onChange={(e) => { const cs = [...(settings.tickets?.categories || [])]; cs[i] = { ...cs[i], categoryId: e.target.value || null }; updateSettings('tickets.categories', cs); }} style={inputStyle}>
                          <option value="">{t('tabsB.tickets.defaultOption')}</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div style={{ marginBottom: '8px' }}><label style={labelStyle}>{t('tabsB.common.supportRole')}</label>
                        <MultiSelect items={roles} value={cat.supportRoles || []} onChange={(v) => { const cs = [...(settings.tickets?.categories || [])]; cs[i] = { ...cs[i], supportRoles: v }; updateSettings('tickets.categories', cs); }} placeholder={t('tabsB.common.searchRole')} emptyLabel={t('tabsB.tickets.perMainSettings')} prefix="@" maxHeight={120} />
                      </div>
                      <div style={{ marginBottom: '8px' }}><label style={labelStyle}>{t('tickets.welcomeMessage')}</label><textarea value={cat.welcomeMessage || ''} onChange={(e) => { const cs = [...(settings.tickets?.categories || [])]; cs[i] = { ...cs[i], welcomeMessage: e.target.value }; updateSettings('tickets.categories', cs); }} rows={2} style={inputStyle} placeholder={t('tabsB.tickets.welcomePh')} /></div>
                      <button onClick={() => updateSettings('tickets.categories', (settings.tickets?.categories || []).filter((_: any, idx: number) => idx !== i))} style={btnDanger}>✕ {t('tabsB.tickets.removeCategory')}</button>
                    </div>
                  ))}
                  <button onClick={() => updateSettings('tickets.categories', [...(settings.tickets?.categories || []), { label: t('tabsB.tickets.defaultCategoryLabel'), emoji: '🎫', categoryId: '', supportRoles: [], welcomeMessage: '' }])} style={btnSecondary}>{t('tabsB.tickets.addCategory')}</button>
                </div>

                <button onClick={handleSend} disabled={sending} style={{ ...btnPrimary, marginTop: '16px', opacity: sending ? 0.6 : 1 }}>{sending ? `⏳ ${t('tabsB.common.sending')}` : `📤 ${t('tabsB.tickets.sendPanel')}`}</button>
              </div>
            </div>
    </>
  );
}
