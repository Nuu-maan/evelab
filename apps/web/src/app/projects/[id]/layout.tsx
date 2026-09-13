import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { CommandPalette } from "@/components/command-palette";
import { ASSISTANT_MODEL, assistantAvailable } from "@/lib/assistant";
import { ProjectHeader } from "@/components/project-header";
import { QuickOpen } from "@/components/quick-open";
import { Sidebar } from "@/components/sidebar";
import { getSourceSummary } from "@/lib/git";
import { paneStyle } from "@/lib/panes";
import { getAccount, requireProjectPage, visibleProjectIds } from "@/lib/session";
import { SIDEBAR_COOKIE, parseSidebarState } from "@/lib/sidebar-state";
import { listProjects, projectExists, readProject, syncProjectDocs, validateProject } from "@/lib/workspace";

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
  // With sign-in on, a project someone else owns is indistinguishable from one that does not exist.
  await requireProjectPage(id);
  // Projects made before EveLab wrote docs get a README and .env.example the first time they are opened.
  await syncProjectDocs(id, { onlyMissing: true });

  const [project, all, visible, account, style, source, jar] = await Promise.all([
    readProject(id),
    listProjects(),
    visibleProjectIds(),
    getAccount(),
    paneStyle(),
    // Local status only, plus GitHub's answer if one is cached: navigation never waits on GitHub.
    getSourceSummary(id),
    cookies(),
  ]);
  const projects = visible ? all.filter((summary) => visible.has(summary.id)) : all;
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
          connections: project.connections.length,
          channels: project.channels.length,
        }}
        account={account && { name: account.name }}
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

      <CommandPalette projectId={id} root={project.root} />
      <QuickOpen projectId={id} paths={project.files.map((file) => file.path)} />
      <AssistantPanel projectId={id} available={assistantAvailable()} model={ASSISTANT_MODEL} />
    </div>
  );
}
