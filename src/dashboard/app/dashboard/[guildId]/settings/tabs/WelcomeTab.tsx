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

export default function WelcomeTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { btnSecondary, cardStyle, embedFieldset, inputStyle, labelStyle, msgTypeSwitch, roles, savedMsgRow, settings, textChannels, updateSettings, uploadImage, uploading, welcomeImageRef, welcomeCardBgRef } = ctx;
  const card = settings.welcomeCard || {};

  return (
    <>
            <div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '16px', fontWeight: '600' }}>{t('tabsB.welcome.welcomeHeading')}</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsB.common.channel')}</label>
                    <select value={settings.welcomeChannel || ''} onChange={(e) => updateSettings('welcomeChannel', e.target.value || null)} style={inputStyle}>
                      <option value="">{t('tabsB.common.disabledOpt')}</option>
                      {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                  </div>
                  <div><label style={labelStyle}>{t('tabsB.welcome.messageVars')}</label>
                    <textarea value={settings.welcomeMessage || ''} onChange={(e) => updateSettings('welcomeMessage', e.target.value)} rows={3} style={inputStyle} placeholder={t('tabsB.welcome.messagePh')} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('tabsB.common.messageType')}</label>
                    {msgTypeSwitch('welcomeEmbed.enabled')}
                    <p style={{ color: '#948C7C', fontSize: '11px', marginTop: '6px' }}>{t('tabsB.welcome.msgTypeHint')}</p>
                  </div>
                  {savedMsgRow('welcomeEmbed', 'welcomeEmbed.enabled', t('tabsB.welcome.welcomeLabel'))}
                  {settings.welcomeEmbed?.enabled && (
                    <div style={{ backgroundColor: '#1B1815', padding: '16px', borderRadius: '8px', display: 'grid', gap: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                        <div><label style={labelStyle}>{t('tabsB.common.title')}</label><input type="text" value={settings.welcomeEmbed?.title || ''} onChange={(e) => updateSettings('welcomeEmbed.title', e.target.value)} style={inputStyle} placeholder={t('tabsB.welcome.titlePh')} /></div>
                        <div><label style={labelStyle}>{t('tabsB.common.color')}</label><input type="color" value={settings.welcomeEmbed?.color || '#14707A'} onChange={(e) => updateSettings('welcomeEmbed.color', e.target.value)} style={{ width: '100%', height: '38px', border: 'none', borderRadius: '6px' }} /></div>
                      </div>
                      <div><label style={labelStyle}>{t('tabsB.common.description')}</label><textarea value={settings.welcomeEmbed?.description || ''} onChange={(e) => updateSettings('welcomeEmbed.description', e.target.value)} rows={2} style={inputStyle} /></div>
                      <div>
                        <label style={labelStyle}>{t('tabsB.welcome.bannerImage')}</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input type="text" value={settings.welcomeEmbed?.image || ''} onChange={(e) => updateSettings('welcomeEmbed.image', e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder={t('tabsB.welcome.imagePh')} />
                          <input type="file" ref={welcomeImageRef} accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) uploadImage(e.target.files[0], 'welcomeImage'); }} />
                          <button onClick={() => welcomeImageRef.current?.click()} disabled={uploading} style={btnSecondary}>
                            {uploading ? '⏳' : '📤'} {t('tabsB.common.upload')}
                          </button>
                        </div>
                        {settings.welcomeEmbed?.image && (
                          <div style={{ marginTop: '8px' }}>
                            <img src={settings.welcomeEmbed.image} alt={t('tabsB.welcome.preview')} style={{ maxWidth: '200px', maxHeight: '100px', borderRadius: '6px' }} onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                          </div>
                        )}
                      </div>
                      <div><label style={labelStyle}>{t('tabsB.welcome.thumbnail')}</label><input type="text" value={settings.welcomeEmbed?.thumbnail || ''} onChange={(e) => updateSettings('welcomeEmbed.thumbnail', e.target.value)} style={inputStyle} placeholder="{avatar}" /></div>
                      <div><label style={labelStyle}>{t('tabsB.welcome.footer')}</label><input type="text" value={settings.welcomeEmbed?.footer || ''} onChange={(e) => updateSettings('welcomeEmbed.footer', e.target.value)} style={inputStyle} /></div>
                    </div>
                  )}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <h3 style={{ color: 'white', fontWeight: '600' }}>{t('cfg.welcome.cardCard')}</h3>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!card.enabled} onChange={() => updateSettings('welcomeCard.enabled', !card.enabled)} style={{ accentColor: '#14707A' }} />
                    <span style={{ color: '#EDE6D8', fontSize: '13px' }}>{t('cfg.welcome.cardEnable')}</span>
                  </label>
                </div>
                <p style={{ color: '#948C7C', fontSize: '11px', marginBottom: '16px' }}>{t('cfg.welcome.cardDesc')}</p>
                {card.enabled && (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                      <div><label style={labelStyle}>{t('cfg.welcome.cardTitle')}</label>
                        <input type="text" value={card.title || ''} onChange={(e) => updateSettings('welcomeCard.title', e.target.value)} style={inputStyle} placeholder={t('cfg.welcome.cardTitlePlaceholder')} />
                      </div>
                      <div><label style={labelStyle}>{t('cfg.welcome.accentColor')}</label>
                        <input type="color" value={card.accentColor || '#14707A'} onChange={(e) => updateSettings('welcomeCard.accentColor', e.target.value)} style={{ width: '100%', height: '38px', border: 'none', borderRadius: '6px' }} />
                      </div>
                    </div>
                    <div><label style={labelStyle}>{t('cfg.welcome.cardSubtitle')}</label>
                      <input type="text" value={card.subtitle || ''} onChange={(e) => updateSettings('welcomeCard.subtitle', e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div><label style={labelStyle}>{t('cfg.welcome.textColor')}</label>
                        <input type="color" value={card.textColor || '#ffffff'} onChange={(e) => updateSettings('welcomeCard.textColor', e.target.value)} style={{ width: '100%', height: '38px', border: 'none', borderRadius: '6px' }} />
                      </div>
                      <div><label style={labelStyle}>{t('cfg.welcome.bgColor')}</label>
                        <input type="color" value={card.backgroundColor || '#1B1815'} onChange={(e) => updateSettings('welcomeCard.backgroundColor', e.target.value)} style={{ width: '100%', height: '38px', border: 'none', borderRadius: '6px' }} />
                      </div>
                    </div>
                    <p style={{ color: '#948C7C', fontSize: '11px' }}>{t('cfg.welcome.bgColorHint')}</p>
                    <div>
                      <label style={labelStyle}>{t('cfg.welcome.bgUrl')}</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input type="text" value={card.backgroundUrl || ''} onChange={(e) => updateSettings('welcomeCard.backgroundUrl', e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder={t('cfg.welcome.bgUrlPlaceholder')} />
                        <input type="file" ref={welcomeCardBgRef} accept="image/png,image/jpeg,image/gif,image/webp" style={{ display: 'none' }}
                          onChange={(e) => { if (e.target.files?.[0]) uploadImage(e.target.files[0], 'welcomeCardBg'); e.target.value = ''; }} />
                        <button onClick={() => welcomeCardBgRef.current?.click()} disabled={uploading} style={btnSecondary}>
                          {uploading ? '⏳' : '📤'} {t('cfg.welcome.upload')}
                        </button>
                      </div>
                      <p style={{ color: '#948C7C', fontSize: '11px', marginTop: '4px' }}>{t('cfg.welcome.bgUrlHint')}</p>
                      {card.backgroundUrl && (
                        <div style={{ marginTop: '8px' }}>
                          <img src={card.backgroundUrl} alt={t('tabsB.welcome.preview')} style={{ maxWidth: '200px', maxHeight: '100px', borderRadius: '6px' }} onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '16px', fontWeight: '600' }}>{t('tabsB.welcome.goodbyeHeading')}</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsB.common.channel')}</label>
                    <select value={settings.goodbyeChannel || ''} onChange={(e) => updateSettings('goodbyeChannel', e.target.value || null)} style={inputStyle}>
                      <option value="">{t('tabsB.common.disabledOpt')}</option>
                      {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </select>
                  </div>
                  <div><label style={labelStyle}>{t('tabsB.welcome.messageVars')}</label><textarea value={settings.goodbyeMessage || ''} onChange={(e) => updateSettings('goodbyeMessage', e.target.value)} rows={2} style={inputStyle} /></div>
                  <div>
                    <label style={labelStyle}>{t('tabsB.common.messageType')}</label>
                    {msgTypeSwitch('goodbyeEmbed.enabled')}
                  </div>
                  {savedMsgRow('goodbyeEmbed', 'goodbyeEmbed.enabled', t('tabsB.welcome.goodbyeLabel'))}
                  {settings.goodbyeEmbed?.enabled && embedFieldset('goodbyeEmbed')}
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '16px', fontWeight: '600' }}>{t('tabsB.welcome.autoRole')}</h3>
                <select value={settings.autoRole || ''} onChange={(e) => updateSettings('autoRole', e.target.value || null)} style={inputStyle}>
                  <option value="">{t('tabsB.common.none')}</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '16px', fontWeight: '600' }}>{t('tabsB.welcome.dmHeading')}</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.welcomeDM?.enabled || false} onChange={() => updateSettings('welcomeDM.enabled', !settings.welcomeDM?.enabled)} style={{ accentColor: '#14707A' }} />
                  <span style={{ color: '#EDE6D8' }}>{t('tabsB.welcome.sendDm')}</span>
                </label>
                {settings.welcomeDM?.enabled && (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <textarea value={settings.welcomeDM?.message || ''} onChange={(e) => updateSettings('welcomeDM.message', e.target.value)} rows={3} style={inputStyle} placeholder={t('tabsB.welcome.dmPh')} />
                    <div>
                      <label style={labelStyle}>{t('tabsB.common.messageType')}</label>
                      {msgTypeSwitch('welcomeDM.embedEnabled')}
                    </div>
                    {savedMsgRow('welcomeDM', 'welcomeDM.embedEnabled', t('tabsB.welcome.dmLabel'))}
                    {settings.welcomeDM?.embedEnabled && embedFieldset('welcomeDM')}
                  </div>
                )}
              </div>
            </div>
    </>
  );
}
