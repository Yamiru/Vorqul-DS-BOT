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

export default function EmbedTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { btnDanger, btnPrimary, btnSecondary, cardStyle, deleteSaved, duplicateSaved, embedImageRef, embedPreview, embedRole, inputStyle, labelStyle, loadSaved, resendSaved, roles, saveDraft, sendEmbed, sendingEmbed, setEmbedPreview, setEmbedRole, settings, textChannels, uploadImage, uploading } = ctx;

  return (
    <>
            <div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '16px', fontWeight: '600' }}>{t('tabsA.embed.title')}</h3>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button type="button" onClick={() => setEmbedPreview({ ...embedPreview, plain: false })} style={!embedPreview.plain ? btnPrimary : btnSecondary}>{t('tabsA.embed.modeEmbed')}</button>
                  <button type="button" onClick={() => setEmbedPreview({ ...embedPreview, plain: true })} style={embedPreview.plain ? btnPrimary : btnSecondary}>{t('tabsA.embed.modePlain')}</button>
                </div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                    <div><label style={labelStyle}>{t('tabsA.embed.channel')}</label>
                      <select value={embedPreview.channel || ''} onChange={(e) => setEmbedPreview({...embedPreview, channel: e.target.value})} style={inputStyle}>
                        <option value="">{t('tabsA.common.select')}</option>
                        {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                      </select>
                    </div>
                    <div><label style={labelStyle}>{t('tabsA.embed.color')}</label><input type="color" value={embedPreview.color || '#14707A'} onChange={(e) => setEmbedPreview({...embedPreview, color: e.target.value})} style={{ width: '100%', height: '38px', border: 'none', borderRadius: '6px' }} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><label style={labelStyle}>{t('tabsA.embed.senderName')}</label><input type="text" value={embedPreview.username || ''} onChange={(e) => setEmbedPreview({...embedPreview, username: e.target.value})} style={inputStyle} placeholder={t('tabsA.embed.senderNamePlaceholder')} /></div>
                    <div><label style={labelStyle}>{t('tabsA.embed.senderAvatar')}</label><input type="text" value={embedPreview.avatarUrl || ''} onChange={(e) => setEmbedPreview({...embedPreview, avatarUrl: e.target.value})} style={inputStyle} placeholder="https://..." /></div>
                  </div>
                  <p style={{ color: '#948C7C', fontSize: '11px', margin: 0 }}>{t('tabsA.embed.webhookNote')}</p>
                  <div>
                    <label style={labelStyle}>{embedPreview.plain ? t('tabsA.embed.messageText') : t('tabsA.embed.textOutside')}</label>
                    {embedPreview.plain
                      ? <textarea value={embedPreview.content || ''} onChange={(e) => setEmbedPreview({...embedPreview, content: e.target.value})} rows={5} style={inputStyle} placeholder={t('tabsA.embed.messagePlaceholder')} />
                      : <input type="text" value={embedPreview.content || ''} onChange={(e) => setEmbedPreview({...embedPreview, content: e.target.value})} style={inputStyle} placeholder={t('tabsA.embed.outsidePlaceholder')} />}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <select value={embedRole} onChange={(e) => setEmbedRole(e.target.value)} style={{ ...inputStyle, maxWidth: '260px' }}>
                        <option value="">{t('tabsA.embed.selectRole')}</option>
                        {roles.map(r => <option key={r.id} value={r.id}>@{r.name}</option>)}
                      </select>
                      <button type="button" onClick={() => { if (embedRole) setEmbedPreview({ ...embedPreview, content: `${(embedPreview.content || '')} <@&${embedRole}>`.trim() }); }} style={btnSecondary}>{t('tabsA.embed.addRoleMention')}</button>
                      <button type="button" onClick={() => setEmbedPreview({ ...embedPreview, content: `${(embedPreview.content || '')} @everyone`.trim() })} style={btnSecondary}>@everyone</button>
                      <button type="button" onClick={() => setEmbedPreview({ ...embedPreview, content: `${(embedPreview.content || '')} @here`.trim() })} style={btnSecondary}>@here</button>
                    </div>
                    <p style={{ color: '#948C7C', fontSize: '11px', marginTop: '6px' }}>{t('tabsA.embed.roleMentionNote', { format: '<@&id>' })}</p>
                  </div>
                  {!embedPreview.plain && (<>
                  <div><label style={labelStyle}>{t('tabsA.embed.author')}</label><input type="text" value={embedPreview.author || ''} onChange={(e) => setEmbedPreview({...embedPreview, author: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsA.embed.titleField')}</label><input type="text" value={embedPreview.title || ''} onChange={(e) => setEmbedPreview({...embedPreview, title: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsA.embed.description')}</label><textarea value={embedPreview.description || ''} onChange={(e) => setEmbedPreview({...embedPreview, description: e.target.value})} rows={4} style={inputStyle} /></div>
                  <div>
                    <label style={labelStyle}>{t('tabsA.embed.image')}</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input type="text" value={embedPreview.image || ''} onChange={(e) => setEmbedPreview({...embedPreview, image: e.target.value})} style={{ ...inputStyle, flex: 1 }} placeholder={t('tabsA.embed.imagePlaceholder')} />
                      <input type="file" ref={embedImageRef} accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) uploadImage(e.target.files[0], 'embedImage'); }} />
                      <button onClick={() => embedImageRef.current?.click()} disabled={uploading} style={btnSecondary}>
                        {uploading ? '⏳' : '📤'} {t('tabsA.embed.upload')}
                      </button>
                    </div>
                    {embedPreview.image && (
                      <div style={{ marginTop: '8px' }}>
                        <img src={embedPreview.image} alt={t('tabsA.embed.preview')} style={{ maxWidth: '200px', maxHeight: '100px', borderRadius: '6px' }} onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                      </div>
                    )}
                  </div>
                  <div><label style={labelStyle}>{t('tabsA.embed.thumbnailUrl')}</label><input type="text" value={embedPreview.thumbnail || ''} onChange={(e) => setEmbedPreview({...embedPreview, thumbnail: e.target.value})} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsA.embed.footer')}</label><input type="text" value={embedPreview.footer || ''} onChange={(e) => setEmbedPreview({...embedPreview, footer: e.target.value})} style={inputStyle} /></div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={embedPreview.timestamp || false} onChange={() => setEmbedPreview({...embedPreview, timestamp: !embedPreview.timestamp})} style={{ accentColor: '#14707A' }} />
                    <span style={{ color: '#EDE6D8' }}>{t('tabsA.embed.addTimestamp')}</span>
                  </label>
                  </>)}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                  <button onClick={sendEmbed} disabled={sendingEmbed} style={{ ...btnPrimary, opacity: sendingEmbed ? 0.6 : 1 }}>📤 {sendingEmbed ? t('tabsA.embed.sending') : (embedPreview.plain ? t('tabsA.embed.sendMessage') : t('tabsA.embed.sendEmbed'))}</button>
                  <button onClick={saveDraft} style={btnSecondary}>{t('tabsA.embed.saveDraft')}</button>
                </div>
              </div>

              <div style={{ ...cardStyle, marginTop: '20px' }}>
                <h3 style={{ color: 'white', marginBottom: '6px', fontWeight: '600' }}>{t('tabsA.embed.savedTitle')}</h3>
                <p style={{ color: '#948C7C', fontSize: '12px', marginBottom: '14px' }}>{t('tabsA.embed.savedIntro')}</p>
                {(!((settings as any)?.savedMessages) || (settings as any).savedMessages.length === 0) ? (
                  <p style={{ color: '#948C7C', fontSize: '13px' }}>{t('tabsA.embed.savedEmpty')}</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {((settings as any).savedMessages).map((m: any) => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '10px 12px', backgroundColor: '#1B1815', borderRadius: '8px' }}>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                          <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>{m.name || t('tabsA.embed.untitled')}</div>
                          <div style={{ color: '#948C7C', fontSize: '11px' }}>{m.sent ? t('tabsA.embed.statusSent') : t('tabsA.embed.statusDraft')} · {new Date(m.savedAt).toLocaleString()}</div>
                        </div>
                        <button onClick={() => loadSaved(m)} style={btnSecondary}>{t('tabsA.embed.edit')}</button>
                        <button onClick={() => duplicateSaved(m)} style={btnSecondary}>{t('tabsA.embed.duplicate')}</button>
                        <button onClick={() => resendSaved(m)} disabled={sendingEmbed} style={{ ...btnSecondary, opacity: sendingEmbed ? 0.6 : 1 }}>{t('tabsA.embed.resend')}</button>
                        <button onClick={() => deleteSaved(m.id)} style={btnDanger}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
    </>
  );
}
