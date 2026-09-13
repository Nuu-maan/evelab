"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChartActivity,
  IconCloudUpload,
  IconDatabase,
  IconFileText,
  IconGitBranch,
  IconGridSquare,
  IconLink,
  IconMagnifyingGlass,
  IconMessage,
  IconRoute,
  IconSettingsGear,
} from "@/components/icons";
import { openCommandPalette } from "@/components/command-palette";
import { Icon, type IconData } from "@/components/icon";
import { KINDS } from "@/components/kinds";
import { ProjectSwitcher, type SwitcherProject } from "@/components/project-switcher";
import { ResizeHandle } from "@/components/resize-handle";
import { Shortcut } from "@/components/shortcut";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import "@/app/shell.css";

interface Item {
  label: string;
  segment: string;
  icon: IconData;
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
      { label: "Overview", segment: "", icon: IconGridSquare },
      { label: "Canvas", segment: "canvas", icon: IconRoute },
      { label: "Agent", segment: "agent", icon: KINDS.agent.icon },
      { label: "Files", segment: "files", icon: IconFileText },
      { label: "Source control", segment: "source", icon: IconGitBranch },
    ],
    [
      { label: "Tools", segment: "tools", icon: KINDS.tool.icon, count: counts.tools },
      { label: "Skills", segment: "skills", icon: KINDS.skill.icon, count: counts.skills },
      { label: "Subagents", segment: "subagents", icon: KINDS.subagent.icon, count: counts.subagents },
      { label: "Connections", segment: "connections", icon: IconLink },
      { label: "Channels", segment: "channels", icon: IconMessage },
    ],
    [
      { label: "Runs", segment: "runs", icon: IconChartActivity },
      { label: "Deployments", segment: "deployments", icon: IconCloudUpload },
    ],
    [{ label: "Settings", segment: "settings", icon: IconSettingsGear }],
  ];

  return (
    <aside className="sidebar" aria-label="Project">
      <div className="sidebar-panel">
        <div className="sidebar-top">
          <ProjectSwitcher current={project} projects={projects} />
          <Button
            variant="outline"
            className="h-9 w-full justify-start gap-2 px-2.5 font-normal text-muted-foreground shadow-none hover:text-foreground"
            type="button"
            onClick={openCommandPalette}
          >
            <Icon icon={IconMagnifyingGlass} />
            <span className="flex-1 text-left">Find</span>
            <Shortcut keys="K" />
          </Button>
        </div>

        <nav className="sidebar-nav" aria-label="Project sections">
          {groups.map((items, index) => (
            <div key={items[0]!.label} style={{ display: "contents" }}>
              {index > 0 && <hr className="sidebar-separator" />}
              {items.map(({ label, segment, icon, count }) => {
                const href = segment ? `${base}/${segment}` : base;
                const current = segment ? pathname.startsWith(href) : pathname === base;
                return (
                  <Link
                    className="sidebar-link"
                    key={label}
                    href={href}
                    aria-current={current ? "page" : undefined}
                  >
                    <Icon icon={icon} />
                    <span className="sidebar-link-label">{label}</span>
                    {count !== undefined && count > 0 && (
                      <Badge variant="secondary" className="tabular-nums">
                        {count}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <Icon icon={IconDatabase} />
          <span>Local workspace</span>
        </div>
      </div>

      <ResizeHandle pane="sidebar" label="Resize sidebar" />
    </aside>
  );
}
