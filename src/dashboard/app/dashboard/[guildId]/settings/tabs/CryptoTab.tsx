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

export default function CryptoTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, settings, updateSettings } = ctx;

  return (
    <>
            <div>
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ color: 'white', fontWeight: '600' }}>{t('tabsA.crypto.title')}</h3>
                  <input type="checkbox" checked={settings.crypto?.enabled || false} onChange={() => updateSettings('crypto.enabled', !settings.crypto?.enabled)} style={{ accentColor: '#14707A', width: '20px', height: '20px' }} />
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsA.crypto.trackedTitle')}</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsA.crypto.coins')}</label>
                    <input type="text" value={(settings.crypto?.watchlist || []).join(', ')} onChange={(e) => updateSettings('crypto.watchlist', e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(s => s))} style={inputStyle} placeholder="BTC, ETH, SOL" />
                  </div>
                  <div><label style={labelStyle}>{t('tabsA.crypto.currency')}</label>
                    <select value={settings.crypto?.currency || 'USD'} onChange={(e) => updateSettings('crypto.currency', e.target.value)} style={inputStyle}>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="CZK">CZK (Kč)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsA.crypto.nftTitle')}</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={settings.crypto?.nft?.enabled || false} onChange={() => updateSettings('crypto.nft.enabled', !settings.crypto?.nft?.enabled)} style={{ accentColor: '#14707A' }} />
                  <span style={{ color: '#EDE6D8' }}>{t('tabsA.crypto.nftEnable')}</span>
                </label>
                <div><label style={labelStyle}>{t('tabsA.crypto.collections')}</label>
                  <input type="text" value={(settings.crypto?.nft?.collections || []).join(', ')} onChange={(e) => updateSettings('crypto.nft.collections', e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(s => s))} style={inputStyle} placeholder="boredapeyachtclub, cryptopunks" />
                </div>
              </div>
            </div>
    </>
  );
}
