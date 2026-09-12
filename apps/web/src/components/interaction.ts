import type { Transition } from "motion/react";

/**
 * Shared timing for interaction motion: panels opening, dialogs, indicators
 * moving between items. Nothing decorative, nothing that gates reading.
 *
 * Exits are shorter than entrances: the system responding should feel faster
 * than the thing the user asked for arriving.
 */
export const EASE_OUT: Transition = { duration: 0.2, ease: [0.23, 1, 0.32, 1] };
export const EXIT: Transition = { duration: 0.15, ease: [0.23, 1, 0.32, 1] };
export const DRAWER: Transition = { duration: 0.24, ease: [0.32, 0.72, 0, 1] };
export const SPRING: Transition = { type: "spring", duration: 0.3, bounce: 0 };
