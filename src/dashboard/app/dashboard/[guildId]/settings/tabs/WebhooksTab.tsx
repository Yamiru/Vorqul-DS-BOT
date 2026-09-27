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

export default function WebhooksTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { btnSecondary, cardStyle, guildId, inputStyle, labelStyle, settings, updateSettings } = ctx;

  return (
    <>
            <div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsB.webhooks.title')}</h3>
                <p style={{ color: '#948C7C', fontSize: '13px', marginBottom: '14px' }}>
                  {(() => {
                    const parts = t('tabsB.webhooks.intro', { sig: '@@SIG@@' }).split('@@SIG@@');
                    return <>{parts[0]}<code>X-Vorqul-Signature: sha256=HMAC(secret, body)</code>{parts[1]}</>;
                  })()}
                </p>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.webhooks?.enabled || false} onChange={() => updateSettings('webhooks.enabled', !settings.webhooks?.enabled)} style={{ accentColor: '#14707A' }} />
                  <span style={{ color: '#EDE6D8' }}>{t('tabsB.webhooks.enable')}</span>
                </label>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsB.webhooks.url')}</label>
                    <input type="url" placeholder="https://example.com/hook" value={settings.webhooks?.url || ''} onChange={(e) => updateSettings('webhooks.url', e.target.value)} style={inputStyle} />
                  </div>
                  <div><label style={labelStyle}>{t('tabsB.webhooks.secret')}</label>
                    <input type="text" placeholder={t('tabsB.webhooks.secretPh')} value={settings.webhooks?.secret || ''} onChange={(e) => updateSettings('webhooks.secret', e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('tabsB.webhooks.events')}</label>
                    <div style={{ display: 'grid', gap: '8px', marginTop: '4px' }}>
                      {[
                        { k: 'memberJoin', l: t('tabsB.webhooks.memberJoin') },
                        { k: 'memberLeave', l: t('tabsB.webhooks.memberLeave') },
                        { k: 'memberBan', l: t('tabsB.webhooks.memberBan') },
                        { k: 'memberUnban', l: t('tabsB.webhooks.memberUnban') },
                        { k: 'dashboardLog', l: t('tabsB.webhooks.dashboardLog') }
                      ].map(ev => (
                        <label key={ev.k} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={settings.webhooks?.events?.[ev.k] !== false} onChange={() => updateSettings(`webhooks.events.${ev.k}`, !(settings.webhooks?.events?.[ev.k] !== false))} style={{ accentColor: '#14707A' }} />
                          <span style={{ color: '#EDE6D8' }}>{ev.l}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #3A332A', paddingTop: '12px' }}>
                    <button
                      style={btnSecondary}
                      onClick={async () => {
                        try {
                          const r = await fetch(`/api/guilds/${guildId}/webhooks/test`, { method: 'POST' });
                          const j = await r.json();
                          alert(j.ok ? `✅ ${t('tabsB.webhooks.testSent', { status: j.status })}` : `❌ ${j.error || t('tabsB.webhooks.failed')}`);
                        } catch { alert(`❌ ${t('tabsB.webhooks.requestFailed')}`); }
                      }}
                    >{t('tabsB.webhooks.sendTest')}</button>
                    <span style={{ color: '#948C7C', fontSize: '12px', marginLeft: '10px' }}>{t('tabsB.webhooks.saveFirst')}</span>
                  </div>
                </div>
              </div>
            </div>
    </>
  );
}
