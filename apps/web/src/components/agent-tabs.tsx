"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "General", segment: "" },
  { label: "Instructions", segment: "instructions" },
  { label: "Model", segment: "model" },
  { label: "Runtime", segment: "runtime" },
];

export function AgentTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}/agent`;

  return (
    <nav className="tabs" aria-label="Agent">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const current = pathname === href;
        return (
          <Link className="tab" key={tab.label} href={href} aria-current={current ? "page" : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
