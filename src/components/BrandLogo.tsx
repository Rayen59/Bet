import React, { useState } from 'react';

export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 select-none whitespace-nowrap shrink-0 ${className}`}>
      <span className="font-display text-xl sm:text-2xl font-black tracking-tight uppercase text-[#f5b800] leading-none">
        SPORT
      </span>
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="14" fill="#18181b" stroke="#f5b800" strokeWidth="2" />
        <polygon points="16,7 21,11 19,17 13,17 11,11" fill="#f5b800" />
        <path
          d="M16 7V3M21 11L26 9M19 17L23 23M13 17L9 23M11 11L6 9"
          stroke="#f5b800"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-display text-xl sm:text-2xl font-black tracking-tight uppercase text-white leading-none">
        ZONE
      </span>
    </div>
  );
}

export function TeamBadge({
  shortName,
  color = '#f5b800',
  size = 'md',
  variant = 'crest',
}: {
  shortName: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'crest' | 'jersey';
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const isUrl = color.startsWith('http://') || color.startsWith('https://');
  const safeColor = /^#[0-9A-Fa-f]{3,6}$/.test(color) ? color : '#e4e4e7';
  const dim =
    size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-12 h-12 text-sm' : 'w-10 h-10 text-xs';

  if (isUrl && !imgFailed) {
    return (
      <div
        className={`${dim} rounded-full bg-[#242428] border border-zinc-600/80 flex items-center justify-center p-1.5 shrink-0 overflow-hidden`}
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

  if (variant === 'jersey') {
    return (
      <div
        className={`${dim} rounded-full bg-[#232327] border border-zinc-600 flex items-center justify-center shrink-0`}
        title={shortName}
      >
        <svg viewBox="0 0 36 36" className="w-[72%] h-[72%]" aria-hidden="true">
          <path
            d="M12 6 L15 8 C16.8 9.2 19.2 9.2 21 8 L24 6 L31 10.5 L28 16 L24.5 14.5 L24.5 30 L11.5 30 L11.5 14.5 L8 16 L5 10.5 Z"
            fill={safeColor}
            stroke="#111111"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M15 8 C16.5 10.2 19.5 10.2 21 8"
            fill="none"
            stroke="#111111"
            strokeWidth="1.2"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`${dim} rounded-full border border-zinc-600 flex items-center justify-center font-mono-tabular font-bold tracking-tight shrink-0`}
      style={{
        backgroundColor: `${safeColor}24`,
        color: '#f4f4f5',
        boxShadow: `inset 0 0 0 1px ${safeColor}60`,
      }}
    >
      {shortName.slice(0, 3).toUpperCase()}
    </div>
  );
}
