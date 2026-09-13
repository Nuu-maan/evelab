import Link from "next/link";
import { IconGridSquare, IconLogoGithub, IconPlus } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { KindCount } from "@/components/kinds";
import { PlainShell } from "@/components/plain-shell";
import { Avatar } from "@/components/project-switcher";
import { Reveal, Stagger } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAccount, visibleProjectIds } from "@/lib/session";
import { listProjects } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await requireAccount();
  const [all, visible] = await Promise.all([listProjects(), visibleProjectIds()]);
  const projects = visible ? all.filter((project) => visible.has(project.id)) : all;

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
            <Stagger className="grid-fluid">
              {projects.map((project) => (
                <Link className="group block rounded-xl" href={`/projects/${project.id}`} key={project.id}>
                  <Card className="h-full transition-colors duration-150 group-hover:border-(--border-strong)">
                    <CardContent className="flex flex-col gap-4">
                      <div className="row" style={{ gap: "var(--space-3)" }}>
                        <Avatar name={project.name} size="large" />
                        <div className="page-heading">
                          <span className="card-title">{project.name}</span>
                          <span className="card-detail mono">{project.model || "No model set"}</span>
                        </div>
                      </div>
                      <div className="row" style={{ gap: "var(--space-4)" }}>
                        <KindCount kind="tool" count={project.toolCount} />
                        <KindCount kind="skill" count={project.skillCount} />
                        <KindCount kind="subagent" count={project.subagentCount} />
                        <span className="hint mono" style={{ marginLeft: "auto" }}>
                          {project.id}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </Stagger>
          )}
        </div>
      </main>
    </PlainShell>
  );
}
