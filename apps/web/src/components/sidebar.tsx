"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { SPRING } from "@/components/interaction";

interface Item {
  label: string;
  segment: string;
  count?: number;
}

interface Group {
  label: string;
  items: Item[];
}

export function Sidebar({ projectId, groups }: { projectId: string; groups: Group[] }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <nav className="sidebar" aria-label="Project">
      {groups.map((group) => (
        <div key={group.label}>
          {group.label && <p className="sidebar-group-label">{group.label}</p>}
          {group.items.map((item) => {
            const href = item.segment ? `${base}/${item.segment}` : base;
            const current = item.segment ? pathname.startsWith(href) : pathname === base;
            return (
              <Link
                className="sidebar-link"
                key={item.label}
                href={href}
                aria-current={current ? "page" : undefined}
              >
                {/* One indicator that travels between items, rather than four that blink. */}
                {current && (
                  <motion.span
                    className="sidebar-active"
                    layoutId="sidebar-active"
                    transition={SPRING}
                  />
                )}
                <span>{item.label}</span>
                {item.count !== undefined && <span className="sidebar-count">{item.count}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
