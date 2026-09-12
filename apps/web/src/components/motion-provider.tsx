"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";

/** Every motion/react animation honours the operating system's reduced-motion setting. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
