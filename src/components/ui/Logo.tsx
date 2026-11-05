/**
 * WavyPDF mark: a page with a folded corner (the PDF) whose lines have become a
 * sound wave. Same blue → purple gradient as the rest of the app.
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        {/* userSpaceOnUse so the gradient renders on every shape, including straight lines. */}
        <linearGradient id="wavypdf-logo" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <path d="M17 3h23l16 16v36a6 6 0 0 1-6 6H17a6 6 0 0 1-6-6V9a6 6 0 0 1 6-6z" fill="url(#wavypdf-logo)" />
      <path d="M40 3l16 16H46a6 6 0 0 1-6-6z" fill="#fff" fillOpacity=".35" />
      <g stroke="#fff" strokeWidth="4" strokeLinecap="round">
        <path d="M22 38v4" />
        <path d="M28 32v16" />
        <path d="M34 27v26" />
        <path d="M40 33v14" />
        <path d="M46 37v6" />
      </g>
    </svg>
  );
}
