import type { Transition } from "motion/react";

/**
 * Press/hover feedback: a light spring that overshoots a little, so buttons
 * squish on press and bounce back. Used with whileHover / whileTap.
 */
export const bouncy: Transition = { type: "spring", stiffness: 520, damping: 17, mass: 0.8 };
