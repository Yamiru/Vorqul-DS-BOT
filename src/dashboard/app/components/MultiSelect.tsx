'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useMemo, useState } from 'react';
import { useT } from './LanguageProvider';

export interface MultiSelectItem {
  id: string;
  name: string;
  color?: number;
}

interface Props {
  items: MultiSelectItem[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  prefix?: string;
  maxHeight?: number;
}

function roleColor(color?: number): string | undefined {
  if (!color) return undefined;
  return `#${color.toString(16).padStart(6, '0')}`;
}

export default function MultiSelect({
  items,
  value,
  onChange,
  placeholder,
  emptyLabel,
  prefix = '',
  maxHeight = 180,
}: Props) {
  const t = useT();
  const searchLabel = placeholder ?? t('common.searching');
  const noneLabel = emptyLabel ?? t('common.nothingSelected');
  const [query, setQuery] = useState('');
  const selected = Array.isArray(value) ? value : [];

  const selectedItems = useMemo(
    () => selected.map((id) => items.find((i) => i.id === id) || { id, name: id }),
    [selected, items]
  );

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => !selected.includes(i.id))
      .filter((i) => !q || i.name.toLowerCase().includes(q));
  }, [items, selected, query]);

  const add = (id: string) => onChange([...selected, id]);
  const remove = (id: string) => onChange(selected.filter((x) => x !== id));

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          marginBottom: selectedItems.length ? '8px' : 0,
        }}
      >
        {selectedItems.length === 0 && (
          <span style={{ color: '#948C7C', fontSize: '12px' }}>{noneLabel}</span>
        )}
        {selectedItems.map((item) => (
          <span
            key={item.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1B1815',
              border: '1px solid #3A332A',
              borderRadius: '999px',
              padding: '4px 10px',
              fontSize: '12px',
              color: roleColor((item as MultiSelectItem).color) || '#EDE6D8',
            }}
          >
            {prefix}
            {item.name}
            <button
              type="button"
              onClick={() => remove(item.id)}
              aria-label={t('app.multi.remove', { name: item.name })}
              style={{
                background: 'none',
                border: 'none',
                color: '#948C7C',
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchLabel}
        style={{
          backgroundColor: '#1B1815',
          border: '1px solid #3A332A',
          borderRadius: '6px',
          padding: '8px 10px',
          color: '#EDE6D8',
          fontSize: '13px',
          width: '100%',
          marginBottom: '6px',
        }}
      />

      <div
        style={{
          maxHeight: `${maxHeight}px`,
          overflowY: 'auto',
          border: '1px solid #3A332A',
          borderRadius: '6px',
          backgroundColor: '#1B1815',
        }}
      >
        {available.length === 0 && (
          <div style={{ padding: '10px', color: '#948C7C', fontSize: '12px' }}>
            {t('app.multi.nothingMore')}
          </div>
        )}
        {available.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => add(item.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              borderBottom: '1px solid #2A251F',
              padding: '8px 10px',
              color: roleColor(item.color) || '#EDE6D8',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {prefix}
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
}
