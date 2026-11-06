/** Logo : deux arcs qui tournent — la rotation des comptes (violet = évals, champagne = payouts) */
export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="mk-t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b1f2b" /><stop offset="1" stopColor="#0c0e14" /></linearGradient>
        <linearGradient id="mk-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6e6bd" /><stop offset="1" stopColor="#c9a35b" /></linearGradient>
        <linearGradient id="mk-b" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#b8a6ff" /><stop offset="1" stopColor="#6e5cff" /></linearGradient>
      </defs>
      <rect x=".5" y=".5" width="31" height="31" rx="9.5" fill="url(#mk-t)" stroke="rgba(255,255,255,.14)" />
      <path d="M8.6 17.6A7.6 7.6 0 0 1 21.9 11" stroke="url(#mk-a)" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <path d="M23.4 14.4A7.6 7.6 0 0 1 10.1 21" stroke="url(#mk-b)" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <circle cx="21.9" cy="11" r="2" fill="#f6e6bd" />
      <circle cx="10.1" cy="21" r="2" fill="#b8a6ff" />
    </svg>
  );
}
