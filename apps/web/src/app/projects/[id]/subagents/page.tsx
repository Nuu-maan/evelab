import Link from "next/link";
import { getProjectGraph } from "@evelab/eve-project";
import { SubagentGraph } from "@/components/subagent-graph";
import { createSubagentAction, deleteSubagentAction } from "@/lib/actions";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SubagentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);
  const graph = getProjectGraph(project);

  return (
    <div className="page page-wide">
      <header className="page-header">
        <div>
          <h1 className="page-title">Subagents</h1>
          <p className="page-description">
            One markdown file per subagent under <code className="mono">subagents/</code>. The graph
            shows which of them the main agent can invoke.
          </p>
        </div>
      </header>

      {project.subagents.length === 0 ? (
        <div className="empty">
          <p className="empty-title">No subagents.</p>
          <p className="empty-body">Create one when your agent needs specialised work.</p>
        </div>
      ) : (
        <SubagentGraph graph={graph} />
      )}

      <div className="grid-2">
        <section className="section">
          <h2 className="section-title">Create subagent</h2>
          <form action={createSubagentAction} className="section">
            <input type="hidden" name="projectId" value={id} />
            <div className="field">
              <label className="label" htmlFor="subagentId">
                Id
              </label>
              <input
                className="input mono"
                id="subagentId"
                name="subagentId"
                placeholder="researcher"
                pattern="[a-z0-9][a-z0-9-]*"
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="name">
                Name
              </label>
              <input className="input" id="name" name="name" placeholder="Researcher" required />
            </div>
            <div className="field">
              <label className="label" htmlFor="description">
                Description
              </label>
              <input className="input" id="description" name="description" maxLength={280} />
              <p className="helper">The parent agent reads this to decide when to delegate.</p>
            </div>
            <div className="field">
              <label className="label" htmlFor="modelId">
                Model
              </label>
              <input
                className="input mono"
                id="modelId"
                name="modelId"
                placeholder={project.agent.model.id}
              />
              <p className="helper">Leave empty to inherit the main agent's model.</p>
            </div>
            <div className="row">
              <button className="button" data-variant="primary" type="submit">
                Create subagent
              </button>
            </div>
          </form>
        </section>

        {project.subagents.length > 0 && (
          <section className="section">
            <h2 className="section-title">Installed</h2>
            <ul className="list">
              {project.subagents.map((subagent) => (
                <li className="list-item" key={subagent.id}>
                  <div>
                    <p className="list-item-title">{subagent.name}</p>
                    <p className="list-item-detail">
                      {subagent.model?.id ?? "Inherits model"} · {subagent.tools.length} tools ·{" "}
                      {subagent.skills.length} skills
                    </p>
                  </div>
                  <div className="row">
                    <Link
                      className="button"
                      data-variant="ghost"
                      href={`/projects/${id}/files?path=subagents/${subagent.id}.md`}
                    >
                      Open source
                    </Link>
                    <form action={deleteSubagentAction}>
                      <input type="hidden" name="projectId" value={id} />
                      <input type="hidden" name="subagentId" value={subagent.id} />
                      <button className="button" data-variant="danger" type="submit">
                        Delete
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
