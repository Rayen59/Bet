import React, { useState } from 'react';

export function BrandLogo({
  className = '',
  tone = 'dark',
}: {
  className?: string;
  tone?: 'dark' | 'light';
}) {
  const isDarkSurface = tone === 'dark';
  return (
    <div className={`flex items-center gap-2 select-none whitespace-nowrap shrink-0 group ${className}`}>
      <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#1472e5] via-[#0c56b8] to-[#08387c] shadow-md shadow-blue-950/40 ring-1 ring-white/20 overflow-hidden transition-transform duration-200 group-hover:scale-105">
        <svg viewBox="0 0 36 36" className="w-7 h-7" aria-hidden="true">
          <path
            d="M6 27V9h5.2l4.8 9.2L20.8 9H26v18h-4.4V16.6L17.1 25h-2.2l-4.5-8.4V27H6z"
            fill="#FFFFFF"
          />
          <path d="M26.5 9L31 9l-3.5 18H23l3.5-18z" fill="#FACC15" opacity="0.92" />
        </svg>
      </div>
      <div className="flex items-baseline leading-none">
        <span
          className={`font-display text-2xl sm:text-[26px] font-black tracking-tight uppercase ${
            isDarkSurface ? 'text-white' : 'text-[#091b35]'
          }`}
        >
          MY
        </span>
        <span className="font-display text-2xl sm:text-[26px] font-black tracking-tight uppercase text-[#38bdf8] drop-shadow-xs">
          BET
        </span>
        <span className="ml-1.5 rounded bg-[#facc15] px-1.5 py-0.5 font-mono-tabular text-[9px] font-black uppercase tracking-wider text-[#091b35] shadow-xs">
          PRO
        </span>
      </div>
    </div>
  );
}

export function CompetitionCountryBadge({
  country,
  className = '',
}: {
  country?: string;
  className?: string;
}) {
  const c = (country || 'International').toLowerCase();

  let bg = '#1e3a8a';
  let fg = '#ffffff';
  let code = 'INT';
  let stripeA = '#38bdf8';
  let stripeB = '#1472e5';

  if (c.includes('tunisi')) {
    bg = '#e70013';
    code = 'TUN';
    stripeA = '#ffffff';
    stripeB = '#e70013';
  } else if (c.includes('england') || c.includes('uk') || c.includes('angleterre')) {
    bg = '#012169';
    code = 'ENG';
    stripeA = '#c8102e';
    stripeB = '#ffffff';
  } else if (c.includes('german') || c.includes('allemagne')) {
    bg = '#111827';
    code = 'GER';
    stripeA = '#dd0000';
    stripeB = '#ffce00';
  } else if (c.includes('spain') || c.includes('espagne')) {
    bg = '#aa151b';
    code = 'ESP';
    stripeA = '#f1bf00';
    stripeB = '#aa151b';
  } else if (c.includes('italy') || c.includes('italie')) {
    bg = '#009246';
    code = 'ITA';
    stripeA = '#ffffff';
    stripeB = '#ce2b37';
  } else if (c.includes('franc')) {
    bg = '#0055a4';
    code = 'FRA';
    stripeA = '#ffffff';
    stripeB = '#ef4135';
  } else if (c.includes('europ')) {
    bg = '#003399';
    code = 'EUR';
    stripeA = '#ffcc00';
    stripeB = '#003399';
  } else if (c.includes('usa') || c.includes('united states')) {
    bg = '#1e3a8a';
    code = 'USA';
    stripeA = '#dc2626';
    stripeB = '#ffffff';
  } else if (c.includes('portugal')) {
    bg = '#006600';
    code = 'POR';
    stripeA = '#ff0000';
    stripeB = '#ffcc00';
  } else if (c.includes('netherland') || c.includes('pays-bas')) {
    bg = '#ae1c28';
    code = 'NED';
    stripeA = '#ffffff';
    stripeB = '#21468b';
  } else if (c.includes('turk')) {
    bg = '#e30a17';
    code = 'TUR';
    stripeA = '#ffffff';
    stripeB = '#e30a17';
  } else if (c.includes('poland')) {
    bg = '#ffffff';
    fg = '#0f172a';
    code = 'POL';
    stripeA = '#dc143c';
    stripeB = '#dc143c';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono-tabular text-[10px] font-black uppercase tracking-wider shrink-0 border border-white/15 shadow-xs ${className}`}
      style={{ backgroundColor: bg, color: fg }}
      title={country || 'International'}
    >
      <span className="inline-flex flex-col w-1.5 h-3 rounded-[1px] overflow-hidden shrink-0">
        <span className="flex-1 w-full" style={{ backgroundColor: stripeA }} />
        <span className="flex-1 w-full" style={{ backgroundColor: stripeB }} />
      </span>
      <span>{code}</span>
    </span>
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
      ? 'w-7 h-7 text-[10px]'
      : size === 'lg'
      ? 'w-13 h-13 text-xs'
      : 'w-9 h-9 text-[11px]';

  if (variant === 'jersey') {
    const kit = kitFromSeed(shortName, color);
    const useStripes = striped ?? kit.striped;
    const clipId = `kit_${shortName.replace(/[^a-zA-Z0-9]/g, '')}_${useStripes ? 's' : 'p'}`;

    return (
      <div
        className={`${dim} rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center shrink-0`}
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
            stroke="#1e293b"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          {useStripes && (
            <g clipPath={`url(#${clipId})`}>
              <rect x="13.5" y="5" width="3" height="26" fill={kit.secondary} opacity="0.9" />
              <rect x="19.5" y="5" width="3" height="26" fill={kit.secondary} opacity="0.9" />
            </g>
          )}
          <path
            d="M15 8 C16.5 10.2 19.5 10.2 21 8"
            fill="none"
            stroke="#1e293b"
            strokeWidth="1.3"
          />
        </svg>
      </div>
    );
  }

  if (isUrl && !imgFailed) {
    return (
      <div
        className={`${dim} rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-2xs`}
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
      className={`${dim} rounded-lg border border-slate-300 flex items-center justify-center font-mono-tabular font-black tracking-tight shrink-0`}
      style={{
        backgroundColor: `${safeColor}20`,
        color: '#091326',
        boxShadow: `inset 0 0 0 1px ${safeColor}45`,
      }}
    >
      {shortName.slice(0, 3).toUpperCase()}
    </div>
  );
}
