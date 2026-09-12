import Link from "next/link";
import { notFound } from "next/navigation";
import { CommandPalette } from "@/components/command-palette";
import { Sidebar } from "@/components/sidebar";
import { projectExists, readProject, validateProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await projectExists(id))) notFound();

  const project = await readProject(id);
  const errors = validateProject(project).filter((issue) => issue.level === "error");

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="topbar">
        <Link className="topbar-brand" href="/projects">
          EveLab
        </Link>
        <span className="topbar-separator">/</span>
        <Link href={`/projects/${id}`}>{project.agent.name}</Link>
        <span className="status" data-tone={errors.length > 0 ? "error" : "ready"}>
          {errors.length > 0 ? `${errors.length} config errors` : "Valid"}
        </span>
        <div className="topbar-actions">
          <span className="palette-hint">⌘K</span>
          <Link className="button" href={`/projects/${id}/runs`}>
            Run
          </Link>
          <Link className="button" data-variant="primary" href={`/projects/${id}/deployments`}>
            Deploy
          </Link>
        </div>
      </header>

      <Sidebar
        projectId={id}
        groups={[
          {
            label: "Build",
            items: [
              { label: "Overview", segment: "" },
              { label: "Agent", segment: "agent" },
              { label: "Tools", segment: "tools", count: project.tools.length },
              { label: "Skills", segment: "skills", count: project.skills.length },
              { label: "Subagents", segment: "subagents", count: project.subagents.length },
              { label: "Connections", segment: "connections" },
              { label: "Channels", segment: "channels" },
            ],
          },
          { label: "Develop", items: [{ label: "Files", segment: "files" }] },
          { label: "Observe", items: [{ label: "Runs", segment: "runs" }] },
          { label: "Deploy", items: [{ label: "Deployments", segment: "deployments" }] },
          { label: "", items: [{ label: "Settings", segment: "settings" }] },
        ]}
      />

      <main className="main" id="main">
        {children}
      </main>

      <CommandPalette projectId={id} />
    </div>
  );
}
