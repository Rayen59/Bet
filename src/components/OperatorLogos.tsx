import React from 'react';

export function OoredooLogo({ className = 'h-10 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 184 56"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Ooredoo"
    >
      <rect width="184" height="56" rx="10" fill="#ED1C24" />
      <g stroke="#FFFFFF" strokeWidth="4.4" fill="none">
        <circle cx="28" cy="28" r="9.5" />
        <circle cx="51" cy="28" r="9.5" />
        <path d="M68 18.5v19M68 25c2-4 6-6.5 10.5-6" strokeLinecap="round" />
        <circle cx="89" cy="28" r="8.8" />
        <path d="M81 28h16" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="112" cy="28" r="8.8" />
        <path d="M120.8 11.5v25.5" strokeLinecap="round" />
        <circle cx="138" cy="28" r="8.8" />
        <circle cx="160" cy="28" r="8.8" />
      </g>
    </svg>
  );
}

export function OrangeLogo({ className = 'h-10 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 164 56"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Orange"
    >
      <rect width="164" height="56" rx="10" fill="#111111" />
      <rect x="6" y="6" width="44" height="44" rx="6" fill="#FF7900" />
      <rect x="13" y="39" width="30" height="5" rx="1" fill="#FFFFFF" />
      <text
        x="60"
        y="36"
        fill="#FF7900"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="24"
        letterSpacing="-0.5"
      >
        orange
      </text>
    </svg>
  );
}

export function TunisieTelecomLogo({ className = 'h-10 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 212 56"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Tunisie Telecom"
    >
      <rect
        x="1"
        y="1"
        width="210"
        height="54"
        rx="10"
        fill="#FFFFFF"
        stroke="#CBD5E1"
        strokeWidth="1.5"
      />
      {/* Authentic Tunisie Telecom 3-arc interlocking orbital emblem */}
      <g transform="translate(10, 6)">
        {/* Outer deep navy orbital sweep */}
        <path
          d="M23 5C12.5 5 5 13 5 22.5c0 4.8 1.9 9.1 5 12.2-1.1-2.5-1.6-5.2-1.2-8 1.2-8.2 8.7-14.2 17.5-13.8 3.2.1 6.1 1 8.6 2.6C32.4 9.1 28.2 5 23 5z"
          fill="#003B8E"
        />
        {/* Cyan bright orbital sweep */}
        <path
          d="M36.5 14.5C39.2 18.8 39.8 24.4 37.6 29.7c-3 7.2-10.7 11.1-18.3 9.7-2.8-.5-5.3-1.7-7.4-3.4 2.5 3.8 6.8 6.4 11.9 6.6 10.1.5 18.7-7.3 19.2-17.2.2-4.2-1.2-8.1-3.5-11.2-.8-.1-1.9.1-3 .3z"
          fill="#00AEEF"
        />
        {/* Magenta/crimson dynamic inner sweep */}
        <path
          d="M11.5 22.5c0-6.2 5-11.2 11.2-11.2 3.1 0 5.9 1.2 8 3.2-2.7-1-5.8-.9-8.5.6-5 2.7-7.1 8.8-4.7 14 1 2.2 2.8 4 5 5-6.2-.5-11-5.6-11-11.6z"
          fill="#E40046"
        />
        {/* Central hub dots */}
        <circle cx="24" cy="23.5" r="3.4" fill="#003B8E" />
        <circle cx="31.5" cy="18.2" r="2.2" fill="#00AEEF" />
      </g>
      <text
        x="62"
        y="25"
        fill="#003B8E"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="16"
        letterSpacing="-0.2"
      >
        Tunisie
      </text>
      <text
        x="62"
        y="43"
        fill="#00AEEF"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="16.5"
        letterSpacing="-0.2"
      >
        Telecom
      </text>
    </svg>
  );
}

export function D17Logo({ className = 'h-10 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 186 56"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="D17 La Poste Tunisienne"
    >
      <rect width="186" height="56" rx="10" fill="#00338D" />
      {/* Official La Poste Tunisienne Yellow Emblem Block */}
      <rect x="4" y="4" width="52" height="48" rx="8" fill="#FFCC00" />
      {/* Authentic Poste Tunisienne stylized winged arrow/bird speed bars */}
      <path d="M12 20h33l-6 5.5H16l-4-5.5z" fill="#00338D" />
      <path d="M15 27.5h28l-5.5 5H19l-4-5z" fill="#00338D" />
      <path d="M19 35h20l-4.5 4.5H22.5L19 35z" fill="#00338D" />
      <path d="M35 13l9 5.5-5.5 2.5L35 13z" fill="#00338D" />

      {/* Bold D17 Typography */}
      <text
        x="66"
        y="36"
        fill="#FFCC00"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="29"
        letterSpacing="-0.5"
      >
        D17
      </text>
      <rect x="128" y="13" width="2" height="30" rx="1" fill="#FFFFFF" opacity="0.25" />
      <text
        x="136"
        y="25"
        fill="#FFFFFF"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="10"
        letterSpacing="0.4"
      >
        LA POSTE
      </text>
      <text
        x="136"
        y="38"
        fill="#FFCC00"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="9"
        letterSpacing="0.3"
      >
        TUNISIENNE
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
