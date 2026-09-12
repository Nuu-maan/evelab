import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { readProject, validateProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);
  const issues = validateProject(project);

  const stats = [
    { label: "Model", value: project.agent.model.id || "Not set", mono: true },
    { label: "Tools", value: String(project.tools.length) },
    { label: "Skills", value: String(project.skills.length) },
    { label: "Subagents", value: String(project.subagents.length) },
    { label: "Files", value: String(project.files.length) },
    { label: "Latest run", value: "None yet" },
  ];

  const actions = [
    { label: "Open canvas", href: `/projects/${id}/canvas`, detail: "Drag, connect, inspect" },
    {
      label: "Write instructions",
      href: `/projects/${id}/agent/instructions`,
      detail: "instructions.md",
    },
    { label: "Add a tool", href: `/projects/${id}/tools`, detail: "tools/" },
    { label: "Import a skill", href: `/projects/${id}/skills`, detail: "skills/" },
    { label: "Create a subagent", href: `/projects/${id}/subagents`, detail: "subagents/" },
    { label: "Open generated files", href: `/projects/${id}/files`, detail: "agent.ts and friends" },
  ];

  return (
    <div className="page">
      <Reveal>
        <header className="page-header page-header-centered">
          <p className="page-eyebrow">Project</p>
          <h1 className="page-display">{project.agent.name}</h1>
          <p className="page-description">
            {project.agent.description ?? "No description yet. Add one on the Agent tab."}
          </p>
          <div className="row row-center">
            <Link className="button" data-variant="primary" href={`/projects/${id}/canvas`}>
              Open canvas
            </Link>
            <Link className="button" href={`/projects/${id}/agent`}>
              Edit agent
            </Link>
            <Link className="button" data-variant="ghost" href={`/projects/${id}/files?path=agent.ts`}>
              View agent.ts
            </Link>
          </div>
        </header>
      </Reveal>

      <Reveal delay={0.06}>
        <section className="panel">
          <div className="stat-grid">
            {stats.map((stat) => (
              <div className="stat" key={stat.label}>
                <span className="stat-label">{stat.label}</span>
                <span className={stat.mono ? "stat-value mono" : "stat-value"}>{stat.value}</span>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {issues.length > 0 && (
        <Reveal delay={0.1}>
          <section className="section">
            <h2 className="section-title">Needs attention</h2>
            <ul className="panel list">
              {issues.map((issue, index) => (
                <li className="list-item" key={`${issue.at}-${index}`}>
                  <span className="list-item-detail">{issue.message}</span>
                  <code className="mono palette-hint">{issue.at}</code>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      <section className="section">
        <h2 className="section-title">Next steps</h2>
        <Stagger className="grid-3">
          {actions.map((action) => (
            <StaggerItem key={action.href}>
              <Link className="card" href={action.href}>
                <span className="card-title">{action.label}</span>
                <span className="card-detail">{action.detail}</span>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </div>
  );
}
