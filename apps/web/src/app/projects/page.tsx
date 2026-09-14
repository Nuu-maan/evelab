import Link from "next/link";
import { IconGridSquare, IconLogoGithub, IconPlus } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { GraphPreview } from "@/components/graph-preview";
import { KindCount } from "@/components/kinds";
import { PlainShell } from "@/components/plain-shell";
import { Avatar } from "@/components/project-switcher";
import { ProjectsBrowser } from "@/components/projects-browser";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { requireAccount, visibleProjectIds } from "@/lib/session";
import { readLayout } from "@/lib/layout";
import { listProjects, type ProjectSummary } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

function ago(time: number): string {
  const elapsed = Date.now() - time;
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
  for (const [unit, size] of UNITS) {
    if (elapsed >= size) return format.format(-Math.floor(elapsed / size), unit);
  }
  return "just now";
}

function ProjectCard({ project, positions }: { project: ProjectSummary; positions: Parameters<typeof GraphPreview>[0]["positions"] }) {
  return (
    <Link className="project-card" href={`/projects/${project.id}`}>
      <div className="project-card-preview" aria-hidden="true">
        <svg className="project-card-dots">
          <pattern id={`dots-${project.id}`} width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="8" cy="8" r="1" fill="currentColor" />
          </pattern>
          <rect width="100%" height="100%" fill={`url(#dots-${project.id})`} />
        </svg>
        <GraphPreview graph={project.graph} positions={positions} />
        <span className="project-card-id">{project.id}</span>
      </div>
      <div className="project-card-body">
        <div className="row min-w-0" style={{ gap: "var(--space-3)" }}>
          <Avatar name={project.name} size="large" />
          <div className="page-heading min-w-0">
            <span className="card-title truncate">{project.name}</span>
            <span className="project-card-model truncate">{project.model || "No model set"}</span>
          </div>
        </div>
        <div className="project-card-counts">
          <KindCount kind="subagent" count={project.subagentCount} />
          <KindCount kind="tool" count={project.toolCount} />
          <KindCount kind="skill" count={project.skillCount} />
          <KindCount kind="connection" count={project.connectionCount} />
          <KindCount kind="channel" count={project.channelCount} />
        </div>
      </div>
      <div className="project-card-footer">
        <span>
          {project.fileCount} {project.fileCount === 1 ? "file" : "files"}
        </span>
        <time dateTime={new Date(project.updatedAt).toISOString()}>{ago(project.updatedAt)}</time>
      </div>
    </Link>
  );
}

export default async function ProjectsPage() {
  await requireAccount();
  const [all, visible] = await Promise.all([listProjects(), visibleProjectIds()]);
  const projects = visible ? all.filter((project) => visible.has(project.id)) : all;
  const layouts = new Map(
    await Promise.all(projects.map(async (project) => [project.id, (await readLayout(project.id)).positions] as const)),
  );

  return (
    <PlainShell>
      <main className="main" id="main">
        <div className="page">
          <Reveal>
            <header className="page-header">
              <div className="page-heading">
                <span className="page-kicker">Workspace</span>
                <h1 className="page-title">Projects</h1>
                <p className="page-description">
                  Every project is a real Eve project on disk that runs with or without EveLab.
                </p>
              </div>
              <div className="page-actions">
                <Button asChild variant="outline">
                  <Link href="/projects/import">
                    <Icon icon={IconLogoGithub} />
                    Import from GitHub
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/projects/new">
                    <Icon icon={IconPlus} />
                    New project
                  </Link>
                </Button>
              </div>
            </header>
          </Reveal>

          {projects.length === 0 ? (
            <Reveal delay={0.08}>
              <EmptyState
                icon={IconGridSquare}
                title="No projects yet."
                action={
                  <Button asChild variant="outline">
                    <Link href="/projects/new">Create your first project</Link>
                  </Button>
                }
              >
                Creating one writes agent.ts and instructions.md, then gets out of your way.
              </EmptyState>
            </Reveal>
          ) : (
            <Reveal delay={0.06}>
              <ProjectsBrowser
                projects={projects.map((project) => ({
                  id: project.id,
                  name: project.name,
                  model: project.model,
                  updatedAt: project.updatedAt,
                  card: <ProjectCard project={project} positions={layouts.get(project.id) ?? {}} />,
                }))}
              />
            </Reveal>
          )}
        </div>
      </main>
    </PlainShell>
  );
}
