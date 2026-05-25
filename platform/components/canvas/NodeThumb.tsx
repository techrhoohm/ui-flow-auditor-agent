'use client';

export function NodeThumb() {
  return (
    <svg viewBox="0 0 220 110" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="ng1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#A5B4FC"/><stop offset="1" stopColor="#6366F1"/></linearGradient>
        <linearGradient id="ng2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FCA5A5"/><stop offset="1" stopColor="#F472B6"/></linearGradient>
        <linearGradient id="ng3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#86EFAC"/><stop offset="1" stopColor="#22D3EE"/></linearGradient>
      </defs>
      <rect x="0" y="0" width="220" height="14" fill="currentColor" opacity="0.04"/>
      <circle cx="8"  cy="7" r="1.6" fill="currentColor" opacity="0.2"/>
      <circle cx="15" cy="7" r="1.6" fill="currentColor" opacity="0.2"/>
      <circle cx="22" cy="7" r="1.6" fill="currentColor" opacity="0.2"/>
      <rect x="10" y="22" width="40" height="4" rx="1.5" fill="currentColor" opacity="0.55"/>
      <rect x="10" y="32" width="80" height="6" rx="2" fill="currentColor" opacity="0.7"/>
      <rect x="10" y="44" width="60" height="6" rx="2" fill="currentColor" opacity="0.7"/>
      <rect x="110" y="22" width="100" height="2.5" rx="1" fill="currentColor" opacity="0.15"/>
      <rect x="110" y="28" width="100" height="2.5" rx="1" fill="currentColor" opacity="0.15"/>
      <rect x="110" y="34" width="80"  height="2.5" rx="1" fill="currentColor" opacity="0.15"/>
      <circle cx="50"  cy="78" r="14" fill="url(#ng1)" opacity="0.85"/>
      <circle cx="110" cy="78" r="16" fill="url(#ng2)" opacity="0.9"/>
      <circle cx="170" cy="78" r="14" fill="url(#ng3)" opacity="0.85"/>
      <circle cx="110" cy="78" r="2" fill="#fff"/>
    </svg>
  );
}
