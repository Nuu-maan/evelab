import type { Transition } from "motion/react";

/**
 * Shared timing for interaction motion: panels opening, dialogs, indicators
 * moving between items. Nothing decorative, nothing that gates reading.
 */
export const EASE_OUT: Transition = { duration: 0.22, ease: [0.16, 1, 0.3, 1] };
export const SPRING: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 };
