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

export default function EconomyTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { cardStyle, inputStyle, labelStyle, settings, updateSettings } = ctx;

  return (
    <>
            <div>
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ color: 'white', fontWeight: '600' }}>{t('tabsA.economy.title')}</h3>
                  <input type="checkbox" checked={settings.economy?.enabled || false} onChange={() => updateSettings('economy.enabled', !settings.economy?.enabled)} style={{ accentColor: '#14707A', width: '20px', height: '20px' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsA.economy.currencyName')}</label><input type="text" value={settings.economy?.currencyName || 'coins'} onChange={(e) => updateSettings('economy.currencyName', e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsA.economy.emoji')}</label><input type="text" value={settings.economy?.currencyEmoji || '💰'} onChange={(e) => updateSettings('economy.currencyEmoji', e.target.value)} style={{ ...inputStyle, width: '60px' }} /></div>
                  <div><label style={labelStyle}>{t('tabsA.economy.startingBalance')}</label><input type="number" value={settings.economy?.startingBalance || 0} onChange={(e) => updateSettings('economy.startingBalance', parseInt(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsA.economy.daily')}</label><input type="number" value={settings.economy?.dailyAmount || 100} onChange={(e) => updateSettings('economy.dailyAmount', parseInt(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsA.economy.streakBonus')}</label><input type="number" value={settings.economy?.dailyStreakBonus || 10} onChange={(e) => updateSettings('economy.dailyStreakBonus', parseInt(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsA.economy.maxStreakBonus')}</label><input type="number" value={settings.economy?.maxStreakBonus || 7} onChange={(e) => updateSettings('economy.maxStreakBonus', parseInt(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsA.economy.workMin')}</label><input type="number" value={settings.economy?.workMinReward || 50} onChange={(e) => updateSettings('economy.workMinReward', parseInt(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsA.economy.workMax')}</label><input type="number" value={settings.economy?.workMaxReward || 200} onChange={(e) => updateSettings('economy.workMaxReward', parseInt(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsA.economy.workCooldown')}</label><input type="number" value={settings.economy?.workCooldown || 3600} onChange={(e) => updateSettings('economy.workCooldown', parseInt(e.target.value))} style={inputStyle} /></div>
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsA.economy.gamblingTitle')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
                  {['coinflip', 'slots', 'roulette', 'blackjack', 'dice', 'crash', 'rps'].map(g => (
                    <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', backgroundColor: '#1B1815', borderRadius: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={settings.economy?.gambling?.[g] !== false} onChange={() => updateSettings(`economy.gambling.${g}`, !(settings.economy?.gambling?.[g] !== false))} style={{ accentColor: '#14707A' }} />
                      <span style={{ color: '#EDE6D8', fontSize: '12px', textTransform: 'capitalize' }}>{t(`tabsA.economy.game.${g}`)}</span>
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={labelStyle}>{t('tabsA.economy.minBet')}</label><input type="number" value={settings.economy?.minBet || 10} onChange={(e) => updateSettings('economy.minBet', parseInt(e.target.value))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>{t('tabsA.economy.maxBet')}</label><input type="number" value={settings.economy?.maxBet || 10000} onChange={(e) => updateSettings('economy.maxBet', parseInt(e.target.value))} style={inputStyle} /></div>
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={{ color: 'white', marginBottom: '12px', fontWeight: '600' }}>{t('tabsA.economy.bankTitle')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={settings.economy?.bankEnabled || false} onChange={() => updateSettings('economy.bankEnabled', !settings.economy?.bankEnabled)} style={{ accentColor: '#14707A' }} />
                    <span style={{ color: '#EDE6D8', fontSize: '13px' }}>{t('tabsA.economy.enableBank')}</span>
                  </label>
                  <div><label style={labelStyle}>{t('tabsA.economy.dailyInterest')}</label><input type="number" step="0.1" value={settings.economy?.bankInterest || 1} onChange={(e) => updateSettings('economy.bankInterest', parseFloat(e.target.value))} style={inputStyle} /></div>
                </div>
              </div>
            </div>
    </>
  );
}
