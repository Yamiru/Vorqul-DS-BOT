'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useT } from './LanguageProvider';

const iconBtn: React.CSSProperties = {
  width: '36px',
  height: '36px',
  minWidth: '36px',
  minHeight: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#1B1815',
  border: '1px solid #3A332A',
  borderRadius: '6px',
  color: '#EDE6D8',
  fontSize: '14px',
  cursor: 'pointer',
  flexShrink: 0,
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation'
};

function clearDashboardCache() {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // storage may be unavailable (private mode) - reload still helps
  }
  window.location.reload();
}

export function TabToolbar({ onRefresh, refreshing }: { onRefresh: () => void; refreshing?: boolean }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
      <button type="button" onClick={onRefresh} disabled={refreshing} title={t('common.refreshHint')} style={{ ...iconBtn, opacity: refreshing ? 0.6 : 1 }}>
        {refreshing ? '⏳' : '🔄'}
      </button>
      <button type="button" onClick={clearDashboardCache} title={t('common.clearCacheHint')} style={iconBtn}>
        🧹
      </button>
    </div>
  );
}
