"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChartActivity,
  IconClock,
  IconCloudUpload,
  IconDatabase,
  IconFileText,
  IconGitBranch,
  IconGridSquare,
  IconMagnifyingGlass,
  IconPlay,
  IconRoute,
  IconSettingsGear,
} from "@/components/icons";
import { openCommandPalette } from "@/components/command-palette";
import { Icon, type IconData } from "@/components/icon";
import { KINDS } from "@/components/kinds";
import { Avatar, ProjectSwitcher, type SwitcherProject } from "@/components/project-switcher";
import { ResizeHandle } from "@/components/resize-handle";
import { Shortcut } from "@/components/shortcut";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions";
import "@/app/shell.css";

interface Item {
  label: string;
  segment: string;
  icon: IconData;
  count?: number;
}

interface Group {
  label?: string;
  items: Item[];
}

export function Sidebar({
  project,
  projects,
  counts,
  account,
}: {
  project: SwitcherProject;
  projects: SwitcherProject[];
  counts: { tools: number; skills: number; subagents: number; connections?: number; channels?: number };
  /** The signed-in user; absent in local mode. */
  account?: { name: string };
}) {
  const pathname = usePathname();
  const base = `/projects/${project.id}`;

  const groups: Group[] = [
    {
      label: "Project",
      items: [
        { label: "Overview", segment: "", icon: IconGridSquare },
        { label: "Canvas", segment: "canvas", icon: IconRoute },
        { label: "Agent", segment: "agent", icon: KINDS.agent.icon },
        { label: "Files", segment: "files", icon: IconFileText },
        { label: "Source control", segment: "source", icon: IconGitBranch },
      ],
    },
    {
      label: "Resources",
      items: [
        { label: "Tools", segment: "tools", icon: KINDS.tool.icon, count: counts.tools },
        { label: "Skills", segment: "skills", icon: KINDS.skill.icon, count: counts.skills },
        { label: "Subagents", segment: "subagents", icon: KINDS.subagent.icon, count: counts.subagents },
        { label: "Connections", segment: "connections", icon: KINDS.connection.icon, count: counts.connections },
        { label: "Channels", segment: "channels", icon: KINDS.channel.icon, count: counts.channels },
        { label: "Schedules", segment: "schedules", icon: IconClock },
      ],
    },
    {
      label: "Runtime",
      items: [
        { label: "Runs", segment: "runs", icon: IconPlay },
        { label: "Observability", segment: "observability", icon: IconChartActivity },
        { label: "Deployments", segment: "deployments", icon: IconCloudUpload },
      ],
    },
    { items: [{ label: "Settings", segment: "settings", icon: IconSettingsGear }] },
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
          {groups.map(({ label: groupLabel, items }, index) => (
            <div key={items[0]!.label} className="sidebar-group" role="group" aria-label={groupLabel}>
              {groupLabel ? (
                <p className="sidebar-group-label" aria-hidden="true">
                  {groupLabel}
                </p>
              ) : (
                index > 0 && <hr className="sidebar-separator" />
              )}
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
                      <Badge variant="secondary" className="font-mono tabular-nums">
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
          {account ? (
            <>
              <Avatar name={account.name} />
              <span className="min-w-0 flex-1 truncate">{account.name}</span>
              <form action={signOutAction}>
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Icon icon={IconDatabase} />
              <span>Local workspace</span>
            </>
          )}
        </div>
      </div>

      <ResizeHandle pane="sidebar" label="Resize sidebar" />
    </aside>
  );
}
