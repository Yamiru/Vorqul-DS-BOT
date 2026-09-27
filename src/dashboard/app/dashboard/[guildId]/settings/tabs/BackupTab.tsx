'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useEffect, useState } from 'react';
import { useT } from '../../../../components/LanguageProvider';
import { TabToolbar } from '../../../../components/TabToolbar';
import type { SettingsTabProps } from './types';

interface BackupInfo {
  filename: string;
  createdAt: string;
  size: number;
  statistics?: { totalRoles: number; totalChannels: number; totalMessages: number; totalEmojis: number };
}

type RestoreMode = 'full' | 'server' | 'bot';
const RESTORE_MODES: RestoreMode[] = ['full', 'server', 'bot'];

export default function BackupTab({ ctx }: SettingsTabProps) {
  const t = useT();
  const { backupStatus, btnDanger, btnPrimary, cardStyle, createBackup, guildId } = ctx;
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [dirPath, setDirPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restoring, setRestoring] = useState<{ filename: string; mode: RestoreMode } | null>(null);
  const [restoreMsg, setRestoreMsg] = useState<{ filename: string; kind: 'ok' | 'error'; text: string } | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/backup`);
      if (res.ok) {
        const data = await res.json();
        setBackups(Array.isArray(data.backups) ? data.backups : []);
        setDirPath(data.path || '');
      }
    } catch (error) {
      console.debug('BackupTab: suppressed error', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const doCreate = async () => {
    await createBackup();
    await load();
  };

  const restore = async (filename: string, mode: RestoreMode) => {
    if (!window.confirm(t(`tabsA.backup.restoreConfirm.${mode}`))) return;
    setRestoring({ filename, mode });
    setRestoreMsg(null);
    try {
      const res = await fetch(`/api/guilds/${guildId}/backup/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, mode })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRestoreMsg({ filename, kind: 'error', text: data.error || t('tabsA.backup.restoreError') });
        return;
      }
      const s = data.summary;
      const errors = s.errors.length ? t('tabsA.backup.restoreErrorsSuffix', { n: s.errors.length }) : '';
      const text = mode === 'bot'
        ? t('tabsA.backup.restoreDoneBot', { errors })
        : t('tabsA.backup.restoreDone', { roles: s.rolesCreated + s.rolesUpdated, channels: s.channelsCreated + s.channelsUpdated, errors: mode === 'full' && s.botSettingsRestored ? t('tabsA.backup.restoreDoneBotSuffix') + errors : errors });
      setRestoreMsg({ filename, kind: 'ok', text });
    } catch {
      setRestoreMsg({ filename, kind: 'error', text: t('tabsA.backup.restoreError') });
    } finally {
      setRestoring(null);
    }
  };

  return (
    <>
            <div style={cardStyle}>
              <h3 style={{ color: 'white', marginBottom: '16px', fontWeight: '600' }}>{t('tabsA.backup.title')}</h3>
              <p style={{ color: '#948C7C', marginBottom: '16px', fontSize: '13px' }}>{t('tabsA.backup.intro')}</p>
              <button onClick={doCreate} style={btnPrimary}>{t('tabsA.backup.create')}</button>
              {backupStatus && <p style={{ marginTop: '12px', color: backupStatus.includes('✅') ? '#7FA05B' : '#D06450' }}>{backupStatus}</p>}
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '12px' }}>
                <h3 style={{ color: 'white', fontWeight: '600' }}>{t('tabsA.backup.savedTitle')}</h3>
                <TabToolbar onRefresh={() => load(true)} refreshing={refreshing} />
              </div>
              {dirPath && (
                <p style={{ color: '#948C7C', fontSize: '11px', marginBottom: '16px' }}>
                  {t('tabsA.backup.pathHint')} <code style={{ color: '#EDE6D8', backgroundColor: '#1B1815', padding: '2px 6px', borderRadius: '4px' }}>{dirPath}</code>
                </p>
              )}
              {loading && <p style={{ color: '#948C7C', fontSize: '13px' }}>{t('common.loading')}</p>}
              {!loading && backups.length === 0 && <p style={{ color: '#948C7C', fontSize: '13px' }}>{t('tabsA.backup.empty')}</p>}
              {!loading && backups.map((b) => (
                <div key={b.filename} style={{ borderTop: '1px solid #3A332A', padding: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: '#EDE6D8', fontSize: '13px', fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{b.filename}</div>
                      <div style={{ color: '#948C7C', fontSize: '11px', marginTop: '2px' }}>
                        {new Date(b.createdAt).toLocaleString()}
                        {b.statistics && ` · ${t('tabsA.backup.stats', { roles: b.statistics.totalRoles, channels: b.statistics.totalChannels })}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
                      {RESTORE_MODES.map((mode) => {
                        const busy = restoring?.filename === b.filename && restoring.mode === mode;
                        return (
                          <button
                            key={mode}
                            onClick={() => restore(b.filename, mode)}
                            disabled={!!restoring}
                            style={{ ...btnDanger, opacity: restoring ? (busy ? 0.6 : 0.4) : 1, fontSize: '11px' }}
                          >
                            {busy ? t('tabsA.backup.restoring') : t(`tabsA.backup.restoreMode.${mode}`)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {restoreMsg?.filename === b.filename && (
                    <p style={{ fontSize: '11px', marginTop: '6px', color: restoreMsg.kind === 'ok' ? '#6E8F4E' : '#D06450' }}>{restoreMsg.text}</p>
                  )}
                </div>
              ))}
            </div>
    </>
  );
}
