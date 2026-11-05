/**
 * The studio backdrop: two soft pools of light and a fine grain, all static.
 * Static on purpose: a moving full-screen background is what made the old UI
 * choppy, and every glass panel above it had to re-blur it on each frame.
 */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-ink-950">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 40rem at 12% -10%, rgb(255 138 92 / 0.14), transparent 60%)," +
            "radial-gradient(50rem 36rem at 95% 0%, rgb(185 166 255 / 0.12), transparent 60%)," +
            "radial-gradient(70rem 40rem at 50% 120%, rgb(185 166 255 / 0.06), transparent 60%)",
        }}
      />
      <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}
