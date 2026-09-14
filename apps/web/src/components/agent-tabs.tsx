"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MotionConfig, motion } from "motion/react";
import { SPRING } from "@/components/interaction";

const TABS = [
  { label: "General", segment: "" },
  { label: "Instructions", segment: "instructions" },
  { label: "Model", segment: "model" },
  { label: "Runtime", segment: "runtime" },
];

export function AgentTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}/agent`;

  // The underline follows the operating system's reduced-motion setting, now that no root provider sets it.
  return (
    <MotionConfig reducedMotion="user">
    <nav className="tabs" aria-label="Agent">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const current = pathname === href;
        return (
          <Link
            className="tab"
            key={tab.label}
            href={href}
            aria-current={current ? "page" : undefined}
          >
            {tab.label}
            {current && (
              <motion.span
                className="tab-underline"
                layoutId="tab-underline"
                transition={SPRING}
              />
            )}
          </Link>
        );
      })}
    </nav>
    </MotionConfig>
  );
}
