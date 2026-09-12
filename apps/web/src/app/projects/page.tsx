import Link from "next/link";
import { Plus } from "lucide-react";
import { KindCount } from "@/components/kinds";
import { PlainShell } from "@/components/plain-shell";
import { Avatar } from "@/components/project-switcher";
import { Reveal, Stagger } from "@/components/motion";
import { listProjects } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <PlainShell>
      <main className="main" id="main">
        <div className="page">
          <Reveal>
            <header className="page-header">
              <div className="page-heading">
                <h1 className="page-title">Projects</h1>
                <p className="page-description">
                  Every project is a real Eve project on disk that runs with or without EveLab.
                </p>
              </div>
              <div className="page-actions">
                <Link className="button" href="/projects/import">
                  Import from GitHub
                </Link>
                <Link className="button" data-variant="primary" href="/projects/new">
                  <Plus aria-hidden="true" strokeWidth={1.5} />
                  New project
                </Link>
              </div>
            </header>
          </Reveal>

          {projects.length === 0 ? (
            <Reveal delay={0.08}>
              <div className="empty">
                <p className="empty-title">No projects yet.</p>
                <p className="empty-body">
                  Creating one writes agent.ts and instructions.md, then gets out of your way.
                </p>
                <Link className="button" href="/projects/new">
                  Create your first project
                </Link>
              </div>
            </Reveal>
          ) : (
            <Stagger className="grid-fluid">
              {projects.map((project) => (
                <Link className="card" href={`/projects/${project.id}`} key={project.id}>
                  <div className="row" style={{ gap: "var(--space-3)" }}>
                    <Avatar name={project.name} size="large" />
                    <div className="page-heading">
                      <span className="card-title">{project.name}</span>
                      <span className="card-detail mono">{project.model || "No model set"}</span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: "var(--space-4)", marginTop: "var(--space-3)" }}>
                    <KindCount kind="tool" count={project.toolCount} />
                    <KindCount kind="skill" count={project.skillCount} />
                    <KindCount kind="subagent" count={project.subagentCount} />
                    <span className="palette-hint mono" style={{ marginLeft: "auto" }}>
                      {project.id}
                    </span>
                  </div>
                </Link>
              ))}
            </Stagger>
          )}
        </div>
      </main>
    </PlainShell>
  );
}
