import type { Transition } from "motion/react";

/**
 * Motion vocabulary for the whole app.
 * - tactile: things you press or select (pills, chips, toggles). A touch of bounce.
 * - smooth: panels and state changes. Critically damped, no overshoot.
 * - fade: quick cross-fades, also what reduced-motion users get.
 */
export const spring = {
  tactile: { type: "spring", bounce: 0.28, duration: 0.45 } satisfies Transition,
  smooth: { type: "spring", bounce: 0, duration: 0.4 } satisfies Transition,
};

export const fade: Transition = { duration: 0.2, ease: [0.23, 1, 0.32, 1] };

/** Enter/exit for swapping panels: slight rise plus a blur that hides the cross-fade seam. */
export const panelSwap = {
  initial: { opacity: 0, transform: "translateY(8px)", filter: "blur(4px)" },
  animate: { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" },
  exit: { opacity: 0, transform: "translateY(-4px)", filter: "blur(4px)" },
};
