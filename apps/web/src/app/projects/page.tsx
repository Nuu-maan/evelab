import Link from "next/link";
import { Mark } from "@/components/mark";
import { PlainShell } from "@/components/plain-shell";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { listProjects } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <PlainShell>
      <main className="main" id="main">
        <div className="page">
          <Reveal>
            <header className="page-header page-header-centered">
              <p className="page-eyebrow row">
                <Mark />
                EveLab
              </p>
              <h1 className="page-display">The visual IDE for Eve agents</h1>
              <p className="page-description">
                Build visually, own the code. Every project here is a real Eve project on disk that
                runs with or without EveLab.
              </p>
              <Link className="button" data-variant="primary" data-size="large" href="/projects/new">
                New project
              </Link>
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
            <section className="section">
              <div className="section-header">
                <h2 className="section-title">Projects</h2>
                <span className="palette-hint">{plural(projects.length, "project")} on disk</span>
              </div>
              <Stagger className="grid-fluid">
                {projects.map((project) => (
                  <StaggerItem key={project.id}>
                    <Link className="card" href={`/projects/${project.id}`}>
                      <span className="card-title">{project.name}</span>
                      <span className="card-detail mono">{project.model || "No model set"}</span>
                      <span className="row" style={{ marginTop: "var(--space-2)" }}>
                        <span className="badge">{plural(project.toolCount, "tool")}</span>
                        <span className="badge">{plural(project.skillCount, "skill")}</span>
                        <span className="badge">{plural(project.subagentCount, "subagent")}</span>
                      </span>
                    </Link>
                  </StaggerItem>
                ))}
              </Stagger>
            </section>
          )}
        </div>
      </main>
    </PlainShell>
  );
}
