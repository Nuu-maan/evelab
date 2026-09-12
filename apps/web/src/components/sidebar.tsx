"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  Bot,
  Files,
  HardDrive,
  LayoutGrid,
  MessagesSquare,
  Plug,
  Rocket,
  Search,
  Settings,
  Users,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { openCommandPalette } from "@/components/command-palette";
import { ProjectSwitcher, type SwitcherProject } from "@/components/project-switcher";
import { ResizeHandle } from "@/components/resize-handle";
import { Shortcut } from "@/components/shortcut";
import "@/app/shell.css";

interface Item {
  label: string;
  segment: string;
  icon: LucideIcon;
  count?: number;
}

export function Sidebar({
  project,
  projects,
  counts,
}: {
  project: SwitcherProject;
  projects: SwitcherProject[];
  counts: { tools: number; skills: number; subagents: number };
}) {
  const pathname = usePathname();
  const base = `/projects/${project.id}`;

  const groups: Item[][] = [
    [
      { label: "Overview", segment: "", icon: LayoutGrid },
      { label: "Canvas", segment: "canvas", icon: Workflow },
      { label: "Agent", segment: "agent", icon: Bot },
      { label: "Files", segment: "files", icon: Files },
    ],
    [
      { label: "Tools", segment: "tools", icon: Wrench, count: counts.tools },
      { label: "Skills", segment: "skills", icon: BookOpen, count: counts.skills },
      { label: "Subagents", segment: "subagents", icon: Users, count: counts.subagents },
      { label: "Connections", segment: "connections", icon: Plug },
      { label: "Channels", segment: "channels", icon: MessagesSquare },
    ],
    [
      { label: "Runs", segment: "runs", icon: Activity },
      { label: "Deployments", segment: "deployments", icon: Rocket },
    ],
    [{ label: "Settings", segment: "settings", icon: Settings }],
  ];

  return (
    <aside className="sidebar" aria-label="Project">
      <div className="sidebar-top">
        <ProjectSwitcher current={project} projects={projects} />
        <button className="sidebar-find" type="button" onClick={openCommandPalette}>
          <Search aria-hidden="true" strokeWidth={1.5} />
          <span className="sidebar-find-label">Find</span>
          <Shortcut keys="K" />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Project sections">
        {groups.map((items, index) => (
          <div key={items[0]!.label} style={{ display: "contents" }}>
            {index > 0 && <hr className="sidebar-separator" />}
            {items.map(({ label, segment, icon: Icon, count }) => {
              const href = segment ? `${base}/${segment}` : base;
              const current = segment ? pathname.startsWith(href) : pathname === base;
              return (
                <Link
                  className="sidebar-link"
                  key={label}
                  href={href}
                  aria-current={current ? "page" : undefined}
                >
                  <Icon aria-hidden="true" strokeWidth={1.5} />
                  <span className="sidebar-link-label">{label}</span>
                  {count !== undefined && count > 0 && <span className="badge">{count}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <HardDrive aria-hidden="true" strokeWidth={1.5} />
        <span>Local workspace</span>
      </div>

      <ResizeHandle pane="sidebar" label="Resize sidebar" />
    </aside>
  );
}
