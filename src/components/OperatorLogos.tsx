import React from 'react';

export function OoredooLogo({ className = 'h-10 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 54"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Ooredoo"
    >
      <rect width="180" height="54" rx="10" fill="#ED1C24" />
      <g stroke="#FFFFFF" strokeWidth="4.2" fill="none">
        <circle cx="28" cy="27" r="9.5" />
        <circle cx="51" cy="27" r="9.5" />
        <path d="M68 18v18M68 24c2-4 6-6 10-5.5" strokeLinecap="round" />
        <circle cx="88" cy="27" r="8.5" />
        <path d="M81 27h14" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="111" cy="27" r="8.5" />
        <path d="M119.5 11v24.5" strokeLinecap="round" />
        <circle cx="136" cy="27" r="8.5" />
        <circle cx="158" cy="27" r="8.5" />
      </g>
    </svg>
  );
}

export function OrangeLogo({ className = 'h-10 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 156 54"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Orange"
    >
      <rect width="156" height="54" rx="10" fill="#FF7900" />
      <text
        x="16"
        y="34"
        fill="#FFFFFF"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="24"
        letterSpacing="-0.5"
      >
        orange
      </text>
      <rect x="16" y="40" width="124" height="5" rx="1.5" fill="#FFFFFF" />
    </svg>
  );
}

export function TunisieTelecomLogo({ className = 'h-10 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 196 54"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Tunisie Telecom"
    >
      <rect width="196" height="54" rx="10" fill="#0B1F3A" stroke="#1E4B85" strokeWidth="1.5" />
      {/* Dynamic blue & red wings/arc emblem */}
      <path d="M16 33 C21 15, 39 10, 50 18 C38 17, 27 23, 22 36 Z" fill="#0072CE" />
      <path d="M23 38 C28 22, 43 18, 53 24 C42 23, 33 29, 29 40 Z" fill="#E30613" />
      <circle cx="44" cy="14" r="3" fill="#00A3E0" />
      <text
        x="61"
        y="24"
        fill="#FFFFFF"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="13.5"
        letterSpacing="0.2"
      >
        TUNISIE
      </text>
      <text
        x="61"
        y="40"
        fill="#38BDF8"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="14.5"
        letterSpacing="0.3"
      >
        TELECOM
      </text>
    </svg>
  );
}

export function D17Logo({ className = 'h-10 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 166 54"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="D17 Poste Tunisienne"
    >
      <defs>
        <linearGradient id="d17grad" x1="0" y1="0" x2="166" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F2A5F" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
      <rect width="166" height="54" rx="10" fill="url(#d17grad)" stroke="#F5B800" strokeWidth="1.5" />
      {/* Stylized Poste wave + chip */}
      <rect x="13" y="13" width="32" height="28" rx="6" fill="#F5B800" />
      <path d="M19 25c5-4 13-4 19 0M21 31c4-3 10-3 15 0" stroke="#0F2A5F" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="29" cy="19" r="2.2" fill="#0F2A5F" />
      <text
        x="55"
        y="34"
        fill="#F5B800"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="24"
        letterSpacing="0.5"
      >
        D17
      </text>
      <text
        x="105"
        y="24"
        fill="#E2E8F0"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="9"
      >
        POSTE
      </text>
      <text
        x="105"
        y="35"
        fill="#93C5FD"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="8.5"
      >
        TN PAY
      </text>
    </svg>
  );
}

export function OperatorBadge({
  operator,
  size = 'md',
}: {
  operator: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const heightCls =
    size === 'sm' ? 'h-7 w-auto' : size === 'lg' ? 'h-12 w-auto' : 'h-9 w-auto';
  const norm = operator.toLowerCase();
  if (norm.includes('ooredoo')) return <OoredooLogo className={heightCls} />;
  if (norm.includes('orange')) return <OrangeLogo className={heightCls} />;
  if (norm.includes('telecom')) return <TunisieTelecomLogo className={heightCls} />;
  return <D17Logo className={heightCls} />;
}
