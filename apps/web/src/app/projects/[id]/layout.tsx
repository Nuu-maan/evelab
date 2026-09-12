import { notFound } from "next/navigation";
import { CommandPalette } from "@/components/command-palette";
import { ProjectHeader } from "@/components/project-header";
import { Sidebar } from "@/components/sidebar";
import { paneStyle } from "@/lib/panes";
import { listProjects, projectExists, readProject, validateProject } from "@/lib/workspace";

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

  const [project, projects, style] = await Promise.all([
    readProject(id),
    listProjects(),
    paneStyle(),
  ]);
  const errors = validateProject(project).filter((issue) => issue.level === "error");

  return (
    <div className="shell" data-panes="" style={style}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Sidebar
        project={{ id, name: project.agent.name }}
        projects={projects.map((summary) => ({ id: summary.id, name: summary.name }))}
        counts={{
          tools: project.tools.length,
          skills: project.skills.length,
          subagents: project.subagents.length,
        }}
      />

      <div className="workspace">
        <ProjectHeader projectId={id} projectName={project.agent.name} errors={errors.length} />
        <main className="main" id="main">
          {children}
        </main>
      </div>

      <CommandPalette projectId={id} />
    </div>
  );
}
