import { useEffect, type RefObject } from "react";

const randomColors = (count: number) =>
  Array.from({ length: count }, () => "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0"));

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
            colors: ["#f967fb", "#53bc28", "#6958d5"],
            lights: { intensity: 200, colors: ["#83f36e", "#fe8a2e", "#ff008a", "#60aed5"] },
          },
        });
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
