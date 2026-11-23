import React, { useState } from 'react';

export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 select-none whitespace-nowrap shrink-0 ${className}`}>
      <span className="inline-flex items-center justify-center rounded-lg bg-[#0a58ca] px-2.5 py-1 text-xs font-extrabold tracking-wide text-white shadow-xs">
        SZ
      </span>
      <span className="font-heading text-base sm:text-lg font-extrabold tracking-tight text-slate-900 leading-none">
        SPORTZONE
      </span>
    </div>
  );
}

const KIT_PALETTES = [
  { primary: '#ffffff', secondary: '#0ea5e9', striped: true },
  { primary: '#eab308', secondary: '#b91c1c', striped: true },
  { primary: '#dc2626', secondary: '#ffffff', striped: false },
  { primary: '#2563eb', secondary: '#1e3a8a', striped: true },
  { primary: '#16a34a', secondary: '#ffffff', striped: false },
  { primary: '#0f172a', secondary: '#0a58ca', striped: true },
  { primary: '#db2777', secondary: '#be185d', striped: true },
];

function kitFromSeed(seed: string, fallbackHex: string) {
  if (/^#[0-9A-Fa-f]{3,6}$/.test(fallbackHex)) {
    return { primary: fallbackHex, secondary: '#0f172a', striped: false };
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return KIT_PALETTES[hash % KIT_PALETTES.length];
}

export function TeamBadge({
  shortName,
  color = '#0a58ca',
  size = 'md',
  variant = 'crest',
  striped,
}: {
  shortName: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'crest' | 'jersey';
  striped?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const isUrl = color.startsWith('http://') || color.startsWith('https://');
  const safeColor = /^#[0-9A-Fa-f]{3,6}$/.test(color) ? color : '#0a58ca';
  const dim =
    size === 'sm'
      ? 'w-8 h-8 text-[10px]'
      : size === 'lg'
      ? 'w-13 h-13 text-xs'
      : 'w-10 h-10 text-xs';

  if (variant === 'jersey') {
    const kit = kitFromSeed(shortName, color);
    const useStripes = striped ?? kit.striped;
    const clipId = `kit_${shortName.replace(/[^a-zA-Z0-9]/g, '')}_${useStripes ? 's' : 'p'}`;

    return (
      <div
        className={`${dim} rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0`}
        title={shortName}
      >
        <svg viewBox="0 0 36 36" className="w-[74%] h-[74%]" aria-hidden="true">
          <defs>
            <clipPath id={clipId}>
              <path d="M12 6 L15 8 C16.8 9.2 19.2 9.2 21 8 L24 6 L31 10.5 L28 16 L24.5 14.5 L24.5 30 L11.5 30 L11.5 14.5 L8 16 L5 10.5 Z" />
            </clipPath>
          </defs>
          <path
            d="M12 6 L15 8 C16.8 9.2 19.2 9.2 21 8 L24 6 L31 10.5 L28 16 L24.5 14.5 L24.5 30 L11.5 30 L11.5 14.5 L8 16 L5 10.5 Z"
            fill={kit.primary}
            stroke="#334155"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {useStripes && (
            <g clipPath={`url(#${clipId})`}>
              <rect x="13.5" y="5" width="3" height="26" fill={kit.secondary} opacity="0.88" />
              <rect x="19.5" y="5" width="3" height="26" fill={kit.secondary} opacity="0.88" />
            </g>
          )}
          <path
            d="M15 8 C16.5 10.2 19.5 10.2 21 8"
            fill="none"
            stroke="#334155"
            strokeWidth="1.3"
          />
        </svg>
      </div>
    );
  }

  if (isUrl && !imgFailed) {
    return (
      <div
        className={`${dim} rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1.5 shrink-0 overflow-hidden`}
      >
        <img
          src={color}
          alt={shortName}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dim} rounded-xl border border-slate-200 flex items-center justify-center font-mono-tabular font-bold tracking-tight shrink-0`}
      style={{
        backgroundColor: `${safeColor}14`,
        color: '#0f172a',
        boxShadow: `inset 0 0 0 1px ${safeColor}35`,
      }}
    >
      {shortName.slice(0, 3).toUpperCase()}
    </div>
  );
}
