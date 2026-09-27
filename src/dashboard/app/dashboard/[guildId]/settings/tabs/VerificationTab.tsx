'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useState } from 'react';
import type { SettingsTabProps } from './types';
import { useT } from '../../../../components/LanguageProvider';

export default function VerificationTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { btnPrimary, cardStyle, deployPanel, inputStyle, labelStyle, roles, settings, textChannels, updateSettings } = ctx;
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      await deployPanel(t('modules.verification.label'), 'verification/deploy', settings.verification);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ color: 'white', fontWeight: '600' }}>✅ {t('modules.verification.label')}</h3>
                <input type="checkbox" checked={settings.verification?.enabled || false} onChange={() => updateSettings('verification.enabled', !settings.verification?.enabled)} style={{ accentColor: '#14707A', width: '20px', height: '20px' }} />
              </div>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div><label style={labelStyle}>{t('tabsB.verification.type')}</label>
                  <select value={settings.verification?.type || 'button'} onChange={(e) => updateSettings('verification.type', e.target.value)} style={inputStyle}>
                    <option value="button">{t('tabsB.verification.typeButton')}</option>
                    <option value="reaction">{t('tabsB.verification.typeReaction')}</option>
                    <option value="captcha">{t('tabsB.verification.typeCaptcha')}</option>
                  </select>
                </div>
                <div><label style={labelStyle}>{t('tabsB.common.channel')}</label>
                  <select value={settings.verification?.channelId || ''} onChange={(e) => updateSettings('verification.channelId', e.target.value || null)} style={inputStyle}>
                    <option value="">{t('tabsB.common.select')}</option>
                    {textChannels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>{t('tabsB.verification.roleAfter')}</label>
                  <select value={settings.verification?.roleId || ''} onChange={(e) => updateSettings('verification.roleId', e.target.value || null)} style={inputStyle}>
                    <option value="">{t('tabsB.common.select')}</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>{t('tabsB.common.title')}</label><input type="text" value={settings.verification?.title || ''} onChange={(e) => updateSettings('verification.title', e.target.value)} style={inputStyle} placeholder={`✅ ${t('modules.verification.label')}`} /></div>
                <div><label style={labelStyle}>{t('tabsB.common.message')}</label><textarea value={settings.verification?.message || ''} onChange={(e) => updateSettings('verification.message', e.target.value)} rows={2} style={inputStyle} /></div>
                <div><label style={labelStyle}>{t('tabsB.common.buttonText')}</label><input type="text" value={settings.verification?.buttonText || ''} onChange={(e) => updateSettings('verification.buttonText', e.target.value)} style={inputStyle} placeholder={t('tabsB.verification.buttonTextPh')} /></div>
              </div>
              <button onClick={handleSend} disabled={sending} style={{ ...btnPrimary, marginTop: '16px', opacity: sending ? 0.6 : 1 }}>{sending ? `⏳ ${t('tabsB.common.sending')}` : `📤 ${t('tabsB.verification.send')}`}</button>
            </div>
    </>
  );
}
