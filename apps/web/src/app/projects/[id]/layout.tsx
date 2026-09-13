import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CommandPalette } from "@/components/command-palette";
import { ProjectHeader } from "@/components/project-header";
import { Sidebar } from "@/components/sidebar";
import { getSourceSummary } from "@/lib/git";
import { paneStyle } from "@/lib/panes";
import { SIDEBAR_COOKIE, parseSidebarState } from "@/lib/sidebar-state";
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

  const [project, projects, style, source, jar] = await Promise.all([
    readProject(id),
    listProjects(),
    paneStyle(),
    // Local status only, plus GitHub's answer if one is cached: navigation never waits on GitHub.
    getSourceSummary(id),
    cookies(),
  ]);
  const errors = validateProject(project).filter((issue) => issue.level === "error");
  const sidebar = parseSidebarState(jar.get(SIDEBAR_COOKIE)?.value);

  return (
    <div className="shell" data-panes="" data-sidebar={sidebar} style={style}>
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
        <ProjectHeader
          projectId={id}
          projectName={project.agent.name}
          sidebar={sidebar}
          errors={errors.length}
          git={source && { changes: source.changes.length, remoteMoved: source.remoteMoved }}
        />
        <main className="main" id="main">
          {children}
        </main>
      </div>

      <CommandPalette projectId={id} />
    </div>
  );
}
