/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
export default function Logo({ size = 40, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="logo-mark"
      style={glow ? { filter: 'drop-shadow(0 12px 32px rgba(88,101,242,.45))' } : undefined}
      aria-label="Vorqul logo"
      role="img"
    >
      <defs>
        <linearGradient id="vorqulGrad" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14707A" />
          <stop offset="0.55" stopColor="#a855f7" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="vorqulSheen" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="3" y="3" width="58" height="58" rx="18" fill="url(#vorqulGrad)" />
      <rect x="3" y="3" width="58" height="58" rx="18" fill="url(#vorqulSheen)" />

      <path
        d="M17 19 L32 45 L47 19"
        stroke="#ffffff"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      <circle cx="32" cy="51.5" r="2.6" fill="#ffffff" fillOpacity="0.95" />
    </svg>
  );
}
