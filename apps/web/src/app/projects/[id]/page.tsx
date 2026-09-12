import Link from "next/link";
import { readProject, validateProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);
  const issues = validateProject(project);

  const stats = [
    { label: "Model", value: project.agent.model.id || "Not set" },
    { label: "Tools", value: String(project.tools.length) },
    { label: "Skills", value: String(project.skills.length) },
    { label: "Subagents", value: String(project.subagents.length) },
    { label: "Files", value: String(project.files.length) },
    { label: "Latest run", value: "None yet" },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{project.agent.name}</h1>
          <p className="page-description">
            {project.agent.description ?? "No description yet. Add one on the Agent tab."}
          </p>
        </div>
        <div className="row">
          <Link className="button" href={`/projects/${id}/agent`}>
            Edit agent
          </Link>
          <Link className="button" href={`/projects/${id}/files?path=agent.ts`}>
            Open agent.ts
          </Link>
        </div>
      </header>

      <section className="section">
        <div className="grid-3">
          {stats.map((stat) => (
            <div className="stat" key={stat.label}>
              <span className="stat-label">{stat.label}</span>
              <span className="stat-value">{stat.value}</span>
            </div>
          ))}
        </div>
      </section>

      {issues.length > 0 && (
        <section className="section">
          <h2 className="section-title">Needs attention</h2>
          <ul className="list">
            {issues.map((issue, index) => (
              <li className="list-item" key={`${issue.at}-${index}`}>
                <span className="list-item-detail">{issue.message}</span>
                <code className="mono palette-hint">{issue.at}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <h2 className="section-title">Next steps</h2>
        <ul className="list">
          <li className="list-item">
            <span>Write what the agent should do</span>
            <Link className="button" data-variant="ghost" href={`/projects/${id}/agent/instructions`}>
              Open instructions.md
            </Link>
          </li>
          <li className="list-item">
            <span>Give it a capability</span>
            <Link className="button" data-variant="ghost" href={`/projects/${id}/tools`}>
              Add tool
            </Link>
          </li>
          <li className="list-item">
            <span>Split specialised work out</span>
            <Link className="button" data-variant="ghost" href={`/projects/${id}/subagents`}>
              Create subagent
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
