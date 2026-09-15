"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconArrowDown, IconCloudUpload, IconDownload, IconLogoGithub, IconPlay } from "@/components/icons";
import { Icon } from "@/components/icon";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  integrations: "Integrations",
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
        {/* Taking the code out: the files as a zip, or committed to GitHub through Source control. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Export code">
              <Icon icon={IconDownload} size={14} />
              <span className="header-action-label">Export</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-64">
            <DropdownMenuItem asChild>
              <a href={`/api/projects/${projectId}/export`} download={`${projectId}.zip`}>
                <Icon icon={IconDownload} />
                <span className="flex min-w-0 flex-col">
                  <span>Download ZIP</span>
                  <span className="text-xs text-muted-foreground">Every project file, ready for eve dev</span>
                </span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`${base}/source`}>
                <Icon icon={IconLogoGithub} />
                <span className="flex min-w-0 flex-col">
                  <span>Push to GitHub</span>
                  <span className="text-xs text-muted-foreground">Commit to a new or existing repository</span>
                </span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Running and deploying are not wired up yet, so the buttons say so instead of opening empty pages. */}
        <Button variant="outline" size="sm" disabled aria-label="Run, coming soon" title="Coming soon" className="header-soon max-sm:hidden">
          <Icon icon={IconPlay} size={14} />
          <span className="header-action-label">Run</span>
          <span className="soon-tag">Soon</span>
        </Button>
        <Button variant="outline" size="sm" disabled aria-label="Deploy, coming soon" title="Coming soon" className="header-soon max-sm:hidden">
          <Icon icon={IconCloudUpload} size={14} />
          <span className="header-action-label">Deploy</span>
          <span className="soon-tag">Soon</span>
        </Button>
      </div>
    </header>
  );
}
