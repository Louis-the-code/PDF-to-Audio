import { useEffect, type RefObject } from "react";

/**
 * Random colours kept inside the app's blue → violet → pink range, so clicking
 * still re-tints the tubes but the light always blends with the scene (fully
 * random hues produced neon greens and oranges that clashed with it).
 */
const randomColors = (count: number) =>
  Array.from({ length: count }, () => {
    const hue = 200 + Math.random() * 130; // 200 (blue) .. 330 (pink)
    return `hsl(${hue.toFixed(0)}, ${(80 + Math.random() * 15).toFixed(0)}%, ${(55 + Math.random() * 12).toFixed(0)}%)`;
  });

/** Never render the effect above this device-pixel ratio: the bloom pass costs per pixel. */
const MAX_PIXEL_RATIO = 1.5;

/** Decorative WebGL cursor effect. Skipped for visitors who prefer reduced motion. */
export function useTubesCursor(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let dispose: (() => void) | undefined;
    let removeClick: (() => void) | undefined;

    import("threejs-components/build/cursors/tubes1.min.js")
      .then(({ default: createTubesCursor }) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;

        const app = createTubesCursor(canvas, {
          tubes: {
            colors: ["#f967fb", "#3b82f6", "#6958d5"],
            lights: { intensity: 200, colors: ["#8b5cf6", "#ec4899", "#ff008a", "#60aed5"] },
          },
        });
        // The library forces a pixel ratio of at least 2, i.e. 4x the pixels on a
        // normal screen, each run through a bloom glow. Match the real screen
        // instead (capped), which looks the same and costs a fraction as much.
        if (app.three) {
          app.three.minPixelRatio = 1;
          app.three.maxPixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
          app.three.resize?.();
        }
        dispose = () => app.dispose?.();

        const onClick = () => {
          app.tubes.setColors(randomColors(3));
          app.tubes.setLightsColors(randomColors(4));
        };
        document.body.addEventListener("click", onClick);
        removeClick = () => document.body.removeEventListener("click", onClick);
      })
      .catch((err) => console.warn("Cursor effect failed to load", err));

    return () => {
      cancelled = true;
      removeClick?.();
      try {
        dispose?.();
      } catch {
        // WebGL teardown errors are not actionable.
      }
    };
  }, [canvasRef]);
}
