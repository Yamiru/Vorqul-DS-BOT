'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { useEffect, useRef, useState } from 'react';

type Mode = 'comma' | 'lines';

interface Props {
  value: string[];
  onChange: (value: string[]) => void;

  mode?: Mode;
  rows?: number;
  placeholder?: string;
  style?: React.CSSProperties;
}

function parse(text: string, mode: Mode): string[] {
  const parts = mode === 'comma' ? text.split(/[,\n]/) : text.split('\n');
  return parts.map((p) => p.trim()).filter(Boolean);
}

function render(value: string[], mode: Mode): string {
  const list = Array.isArray(value) ? value : [];
  return mode === 'comma' ? list.join(', ') : list.join('\n');
}

const same = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

export default function ListInput({
  value,
  onChange,
  mode = 'comma',
  rows = 4,
  placeholder,
  style,
}: Props) {
  const [text, setText] = useState(() => render(value, mode));
  const typing = useRef(false);

  useEffect(() => {
    const incoming = Array.isArray(value) ? value : [];
    if (typing.current && same(parse(text, mode), incoming)) return;
    typing.current = false;
    setText(render(incoming, mode));
  }, [value, mode]);

  const handle = (raw: string) => {
    typing.current = true;
    setText(raw);
    onChange(parse(raw, mode));
  };

  return (
    <textarea
      value={text}
      onChange={(e) => handle(e.target.value)}
      onBlur={() => {
        typing.current = false;
        setText(render(parse(text, mode), mode));
      }}
      rows={rows}
      placeholder={placeholder}
      style={style}
    />
  );
}
