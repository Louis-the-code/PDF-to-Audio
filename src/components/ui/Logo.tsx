/** WavyPDF mark: a page whose lines have turned into a sound wave. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        {/* userSpaceOnUse: a perfectly vertical line has a zero-width bounding box, which
            would make a bounding-box gradient (the default) render nothing at all. */}
        <linearGradient id="logo-wave" gradientUnits="userSpaceOnUse" x1="0" y1="32" x2="32" y2="0">
          <stop offset="0" stopColor="#ff8a5c" />
          <stop offset="1" stopColor="#ffc170" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#1e1a2c" stroke="rgb(255 255 255 / 0.08)" />
      {[
        [8, 12, 20],
        [12, 9, 23],
        [16, 6, 26],
        [20, 10, 22],
        [24, 13, 19],
      ].map(([x, y1, y2]) => (
        <line key={x} x1={x} y1={y1} x2={x} y2={y2} stroke="url(#logo-wave)" strokeWidth="2.4" strokeLinecap="round" />
      ))}
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className={`font-display text-lg font-semibold tracking-tight text-mist ${compact ? "hidden sm:inline" : ""}`}>WavyPDF</span>
    </span>
  );
}
