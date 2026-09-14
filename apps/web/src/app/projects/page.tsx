import type { Metadata } from "next";
import Link from "next/link";
import type { CanvasNodeKind } from "@evelab/eve-project";
import { IconArrowUpRight, IconGridSquare, IconLogoGithub, IconPlus, IconTrash } from "@/components/icons";
import { ConfirmSubmit } from "@/components/confirm";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { GraphPreview } from "@/components/graph-preview";
import { KINDS } from "@/components/kinds";
import { PlainShell } from "@/components/plain-shell";
import { ProjectsBrowser } from "@/components/projects-browser";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { deleteProjectAction } from "@/lib/actions";
import { requireAccount, visibleProjectIds } from "@/lib/session";
import { readLayout } from "@/lib/layout";
import { listProjects, type ProjectSummary } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Projects" };

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
  const parts: [CanvasNodeKind, number][] = (
    [
      ["subagent", project.subagentCount],
      ["tool", project.toolCount],
      ["skill", project.skillCount],
      ["connection", project.connectionCount],
      ["channel", project.channelCount],
    ] as [CanvasNodeKind, number][]
  ).filter(([, count]) => count > 0);

  return (
    // The delete form sits beside the link, not in it: a button inside a link is not a button anyone can rely on.
    <div className="project-card-wrap">
    <Link className="project-card" href={`/projects/${project.id}`}>
      <div className="project-card-preview" aria-hidden="true">
        <svg className="project-card-dots">
          <pattern id={`dots-${project.id}`} width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="8" cy="8" r="1" fill="currentColor" />
          </pattern>
          <rect width="100%" height="100%" fill={`url(#dots-${project.id})`} />
        </svg>
        <GraphPreview graph={project.graph} positions={positions} />
        <span className="project-card-open">
          <Icon icon={IconArrowUpRight} size={14} />
        </span>
      </div>

      <div className="project-card-body">
        <div className="project-card-heading">
          <h2 className="project-card-name">{project.name}</h2>
          <time className="project-card-time" dateTime={new Date(project.updatedAt).toISOString()}>
            {ago(project.updatedAt)}
          </time>
        </div>
        <p className="project-card-model">{project.model || "No model set"}</p>

        {parts.length > 0 ? (
          <ul className="project-card-parts" aria-label="What it is made of">
            {parts.map(([kind, count]) => (
              <li key={kind} className="project-card-part" data-kind={kind}>
                <span className="project-card-dot" aria-hidden="true" />
                {count} {(count === 1 ? KINDS[kind].label : KINDS[kind].plural).toLowerCase()}
              </li>
            ))}
          </ul>
        ) : (
          <p className="project-card-parts project-card-parts-empty">Just the root agent so far</p>
        )}
      </div>

      <div className="project-card-footer">
        <span className="project-card-id">{project.id}</span>
        <span>
          {project.fileCount} {project.fileCount === 1 ? "file" : "files"}
        </span>
      </div>
    </Link>
    <form action={deleteProjectAction} className="project-card-delete">
      <input type="hidden" name="id" value={project.id} />
      <ConfirmSubmit
        size="icon-sm"
        className="size-[26px] rounded-[7px] border border-border bg-background"
        title={`Delete ${project.name}?`}
        description={`This deletes ${project.name} and its ${project.fileCount} ${project.fileCount === 1 ? "file" : "files"}. It cannot be undone.`}
        confirmLabel="Delete project"
      >
        <Icon icon={IconTrash} size={14} />
        <span className="visually-hidden">Delete {project.name}</span>
      </ConfirmSubmit>
    </form>
    </div>
  );
}

export default async function ProjectsPage() {
  await requireAccount();
  const visible = await visibleProjectIds();
  const all = await listProjects(visible);
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
