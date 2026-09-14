"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconArrowDown, IconCloudUpload, IconPlay } from "@/components/icons";
import { Icon } from "@/components/icon";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import type { SidebarState } from "@/lib/sidebar-state";

const PAGES: Record<string, string> = {
  "": "Overview",
  canvas: "Canvas",
  agent: "Agent",
  files: "Files",
  source: "Source control",
  tools: "Tools",
  observability: "Observability",
  schedules: "Schedules",
  skills: "Skills",
  subagents: "Subagents",
  connections: "Connections",
  channels: "Channels",
  runs: "Runs",
  deployments: "Deployments",
  settings: "Settings",
};

export interface HeaderGit {
  changes: number;
  /** Undefined when EveLab has no recent answer from GitHub. */
  remoteMoved?: boolean;
}

export function ProjectHeader({
  projectId,
  projectName,
  sidebar,
  errors,
  git,
}: {
  projectId: string;
  projectName: string;
  sidebar: SidebarState;
  errors: number;
  git?: HeaderGit;
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const segment = pathname.slice(base.length).split("/")[1] ?? "";

  return (
    <header className="header">
      <SidebarToggle initial={sidebar} />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/projects">Projects</Link>
        <span className="crumb-separator" aria-hidden="true">
          /
        </span>
        <Link href={base}>{projectName}</Link>
        <span className="crumb-separator" aria-hidden="true">
          /
        </span>
        <span className="crumb-current" aria-current="page">
          {PAGES[segment] ?? "Overview"}
        </span>
      </nav>

      {errors > 0 && (
        <Link className="status" data-tone="error" href={`${base}#issues`}>
          {`${errors} config ${errors === 1 ? "error" : "errors"}`}
        </Link>
      )}

      {git && (
        <>
          <Link
            className="status"
            data-tone={git.changes > 0 ? "modified" : "ready"}
            href={`${base}/source`}
          >
            {git.changes > 0 ? `${git.changes} ${git.changes === 1 ? "change" : "changes"}` : "Synced"}
          </Link>
          {git.remoteMoved && (
            <Link className="header-remote" href={`${base}/source`}>
              <Icon icon={IconArrowDown} size={14} />
              Remote changes
            </Link>
          )}
        </>
      )}

      <div className="header-actions">
        <ThemeToggle />
        <Button asChild variant="outline" size="sm">
          <Link href={`${base}/runs`} aria-label="Run">
            <Icon icon={IconPlay} size={14} />
            <span className="header-action-label">Run</span>
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href={`${base}/deployments`} aria-label="Deploy">
            <Icon icon={IconCloudUpload} size={14} />
            <span className="header-action-label">Deploy</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
