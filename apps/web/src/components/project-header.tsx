"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play, Rocket } from "lucide-react";

const PAGES: Record<string, string> = {
  "": "Overview",
  canvas: "Canvas",
  agent: "Agent",
  files: "Files",
  tools: "Tools",
  skills: "Skills",
  subagents: "Subagents",
  connections: "Connections",
  channels: "Channels",
  runs: "Runs",
  deployments: "Deployments",
  settings: "Settings",
};

export function ProjectHeader({
  projectId,
  projectName,
  errors,
}: {
  projectId: string;
  projectName: string;
  errors: number;
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const segment = pathname.slice(base.length).split("/")[1] ?? "";

  return (
    <header className="header">
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

      <Link className="status" data-tone={errors > 0 ? "error" : "ready"} href={`${base}#issues`}>
        {errors > 0 ? `${errors} config ${errors === 1 ? "error" : "errors"}` : "Valid"}
      </Link>

      <div className="header-actions">
        <Link className="button" data-size="small" href={`${base}/runs`}>
          <Play aria-hidden="true" strokeWidth={1.5} />
          Run
        </Link>
        <Link className="button" data-variant="primary" data-size="small" href={`${base}/deployments`}>
          <Rocket aria-hidden="true" strokeWidth={1.5} />
          Deploy
        </Link>
      </div>
    </header>
  );
}
