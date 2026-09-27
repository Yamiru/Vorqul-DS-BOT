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

export default function ReactionrolesTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { btnDanger, btnPrimary, btnSecondary, cardStyle, deleteSavedPanel, inputStyle, labelStyle, loadSavedPanel, resendSavedPanel, roles, saveReactionRolesPanel, sendReactionRolesPanel, sendingRR, settings, stopEditingPanel, textChannels, updateReactionRolesPanel, updateSettings } = ctx;

  const rr = settings.reactionRoles || {};
  const BTN_STYLES: Record<number, { label: string; bg: string }> = {
    1: { label: t('tabsB.rr.colorBlue'), bg: '#5865F2' },
    2: { label: t('tabsB.rr.colorGrey'), bg: '#4E5058' },
    3: { label: t('tabsB.rr.colorGreen'), bg: '#248046' },
    4: { label: t('tabsB.rr.colorRed'), bg: '#DA373C' },
  };
  const roleName = (id: string) => roles.find((r: any) => r.id === id)?.name || '';

  return (
    <>
            <div>
              {rr.editing?.messageId && (
                <div style={{ ...cardStyle, borderLeft: '3px solid #14707A', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'white', fontSize: '13px', flex: 1, minWidth: '200px' }}>
                    {(() => {
                      const parts = t('tabsB.rr.editing', { id: '@@ID@@' }).split('@@ID@@');
                      return <>{parts[0]}<code>{rr.editing.messageId}</code>{parts[1]}</>;
                    })()}
                  </span>
                  <button onClick={stopEditingPanel} style={btnSecondary}>{t('tabsB.rr.stopEditing')}</button>
                </div>
              )}
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '16px', fontWeight: '600' }}>{t('tabsB.rr.title')}</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsB.common.channel')}</label>
                    <select value={settings.reactionRoles?.channel || ''} onChange={(e) => updateSettings('reactionRoles.channel', e.target.value || null)} style={inputStyle}>
                      <option value="">{t('tabsB.common.select')}</option>
                      {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                  </div>
                  <div><label style={labelStyle}>{t('tabsB.common.title')}</label><input type="text" value={settings.reactionRoles?.title || ''} onChange={(e) => updateSettings('reactionRoles.title', e.target.value)} style={inputStyle} placeholder={t('tabsB.rr.titlePh')} /></div>
                  <div><label style={labelStyle}>{t('tabsB.common.description')}</label><textarea value={settings.reactionRoles?.description || ''} onChange={(e) => updateSettings('reactionRoles.description', e.target.value)} rows={2} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsB.common.color')}</label><input type="color" value={settings.reactionRoles?.color || '#14707A'} onChange={(e) => updateSettings('reactionRoles.color', e.target.value)} style={{ width: '60px', height: '38px', border: 'none', borderRadius: '6px' }} /></div>
                  <div><label style={labelStyle}>{t('tabsB.rr.type')}</label>
                    <select value={settings.reactionRoles?.type || 'multiple'} onChange={(e) => updateSettings('reactionRoles.type', e.target.value)} style={inputStyle}>
                      <option value="multiple">{t('tabsB.rr.typeMultiple')}</option>
                      <option value="single">{t('tabsB.rr.typeSingle')}</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><label style={labelStyle}>{t('tabsB.rr.senderName')}</label><input type="text" value={settings.reactionRoles?.username || ''} onChange={(e) => updateSettings('reactionRoles.username', e.target.value)} style={inputStyle} placeholder={t('tabsB.rr.senderNamePh')} /></div>
                    <div><label style={labelStyle}>{t('tabsB.rr.senderAvatar')}</label><input type="text" value={settings.reactionRoles?.avatarUrl || ''} onChange={(e) => updateSettings('reactionRoles.avatarUrl', e.target.value)} style={inputStyle} placeholder="https://..." /></div>
                  </div>
                  <p style={{ color: '#948C7C', fontSize: '11px', margin: 0 }}>{t('tabsB.rr.webhookNote')}</p>
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsB.rr.buttons')}</h3>
                {(settings.reactionRoles?.buttons || []).map((btn: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input type="text" value={btn.emoji || ''} onChange={(e) => { const b = [...(settings.reactionRoles?.buttons || [])]; b[i] = { ...b[i], emoji: e.target.value }; updateSettings('reactionRoles.buttons', b); }} placeholder={t('tabsB.common.emoji')} style={{ ...inputStyle, width: '60px' }} />
                    <input type="text" value={btn.label || ''} onChange={(e) => { const b = [...(settings.reactionRoles?.buttons || [])]; b[i] = { ...b[i], label: e.target.value }; updateSettings('reactionRoles.buttons', b); }} placeholder={t('tabsB.rr.buttonLabelPh')} style={{ ...inputStyle, width: '100px' }} />
                    <select value={btn.roleId || ''} onChange={(e) => { const b = [...(settings.reactionRoles?.buttons || [])]; b[i] = { ...b[i], roleId: e.target.value }; updateSettings('reactionRoles.buttons', b); }} style={{ ...inputStyle, flex: 1 }}>
                      <option value="">{t('tabsB.common.role')}</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <select value={btn.style || 1} onChange={(e) => { const b = [...(settings.reactionRoles?.buttons || [])]; b[i] = { ...b[i], style: parseInt(e.target.value, 10) }; updateSettings('reactionRoles.buttons', b); }} style={{ ...inputStyle, width: '90px' }} title={t('tabsB.rr.buttonColor')}>
                      {Object.entries(BTN_STYLES).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                    </select>
                    <button onClick={() => updateSettings('reactionRoles.buttons', (settings.reactionRoles?.buttons || []).filter((_: any, idx: number) => idx !== i))} style={btnDanger}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => updateSettings('reactionRoles.buttons', [...(settings.reactionRoles?.buttons || []), { emoji: '🎮', label: t('tabsB.common.role'), roleId: '', style: 1 }])} style={btnSecondary}>{t('tabsB.common.add')}</button>
                  <button onClick={saveReactionRolesPanel} style={btnSecondary}>💾 {t('tabsB.common.save')}</button>
                  {rr.editing?.messageId && <button onClick={updateReactionRolesPanel} disabled={sendingRR} style={{ ...btnPrimary, opacity: sendingRR ? 0.6 : 1 }}>🔁 {sendingRR ? t('tabsB.common.sending') : t('tabsB.rr.updatePanel')}</button>}
                  <button onClick={sendReactionRolesPanel} disabled={sendingRR} style={{ ...(rr.editing?.messageId ? btnSecondary : btnPrimary), opacity: sendingRR ? 0.6 : 1 }}>📤 {sendingRR ? t('tabsB.common.sending') : (rr.editing?.messageId ? t('tabsB.rr.sendAsNew') : t('tabsB.rr.send'))}</button>
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsB.rr.preview')}</h3>
                <div style={{ backgroundColor: '#313338', borderRadius: '8px', padding: '14px', maxWidth: '520px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    {rr.avatarUrl
                      ? <img src={rr.avatarUrl} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      : <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#14707A' }} />}
                    <span style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>{(rr.username || '').trim() || 'Vorqul DS BOT'}</span>
                    <span style={{ backgroundColor: '#5865F2', color: 'white', fontSize: '9px', borderRadius: '3px', padding: '1px 4px' }}>{(rr.username || '').trim() || rr.avatarUrl ? 'APP' : 'BOT'}</span>
                  </div>
                  <div style={{ borderLeft: `4px solid ${rr.color || '#14707A'}`, backgroundColor: '#2B2D31', borderRadius: '4px', padding: '10px 12px' }}>
                    <div style={{ color: 'white', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{(rr.title || '').trim() || t('tabsB.rr.titlePh')}</div>
                    <div style={{ color: '#DBDEE1', fontSize: '13px', whiteSpace: 'pre-wrap' }}>{(rr.description || '').trim() || t('tabsB.rr.defaultDescription')}</div>
                    <div style={{ color: '#949BA4', fontSize: '11px', marginTop: '8px' }}>{t('tabsB.rr.footer')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {(rr.buttons || []).map((b: any, i: number) => (
                      <span key={i} style={{ backgroundColor: BTN_STYLES[b.style || 1]?.bg || BTN_STYLES[1].bg, color: 'white', fontSize: '13px', borderRadius: '4px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px', opacity: b.roleId ? 1 : 0.45 }}>
                        {b.emoji && !/^\d+$/.test(b.emoji) && !b.emoji.startsWith('<') ? <span>{b.emoji}</span> : null}
                        <span>{(b.label || '').trim() || roleName(b.roleId) || t('tabsB.common.role')}</span>
                      </span>
                    ))}
                    {(!rr.buttons || rr.buttons.length === 0) && <span style={{ color: '#949BA4', fontSize: '12px' }}>{t('tabsB.rr.noButtons')}</span>}
                  </div>
                  {rr.type === 'single' && <div style={{ color: '#949BA4', fontSize: '11px', marginTop: '6px' }}>{t('tabsB.rr.singleMode')}</div>}
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '6px', fontWeight: '600' }}>{t('tabsB.rr.savedPanels')}</h3>
                <p style={{ color: '#948C7C', fontSize: '12px', marginBottom: '12px' }}>{t('tabsB.rr.savedHint')}</p>
                {(!((settings as any)?.savedReactionRoles) || (settings as any).savedReactionRoles.length === 0) ? (
                  <p style={{ color: '#948C7C', fontSize: '13px' }}>{t('tabsB.rr.noSaved')}</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {((settings as any).savedReactionRoles).map((p: any) => (
                      <div key={p.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: 'white', fontSize: '13px', flex: 1, minWidth: '140px' }}>
                          {p.name} <span style={{ color: '#948C7C', fontSize: '11px' }}>({t('tabsB.rr.savedMeta', { count: (p.data?.buttons || []).length, status: p.messageId ? t('tabsB.rr.onDiscord') : p.sent ? t('tabsB.rr.sent') : t('tabsB.rr.draft'), date: new Date(p.savedAt).toLocaleDateString() })})</span>
                        </span>
                        <button onClick={() => loadSavedPanel(p)} style={btnSecondary}>✏️ {t('tabsB.rr.load')}</button>
                        <button onClick={() => resendSavedPanel(p)} disabled={sendingRR} style={{ ...btnSecondary, opacity: sendingRR ? 0.6 : 1 }}>📤 {t('tabsB.rr.send')}</button>
                        <button onClick={() => deleteSavedPanel(p.id)} style={btnDanger}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
    </>
  );
}
