import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { createSubagentAction, deleteSubagentAction } from "@/lib/actions";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default async function SubagentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);

  return (
    <div className="page">
      <Reveal>
        <header className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Subagents</h1>
            <p className="page-description">
              Who your agent can delegate to. One markdown file per subagent under{" "}
              <code className="mono">subagents/</code>; the canvas shows the same thing as a graph.
            </p>
          </div>
          <div className="page-actions">
            <Link className="button" href={`/projects/${id}/canvas`}>
              Open canvas
            </Link>
          </div>
        </header>
      </Reveal>

      {project.subagents.length === 0 ? (
        <Reveal delay={0.06}>
          <div className="empty">
            <p className="empty-title">No subagents.</p>
            <p className="empty-body">Create one when your agent needs specialised work.</p>
          </div>
        </Reveal>
      ) : (
        <Stagger className="section">
          {project.subagents.map((subagent) => (
            <StaggerItem key={subagent.id}>
              <div className="card" data-interactive="true">
                <div className="row-between">
                  <div>
                    <p className="card-title">{subagent.name}</p>
                    <p className="card-detail">{subagent.description || "No description"}</p>
                  </div>
                  <div className="row">
                    <Link
                      className="button"
                      data-variant="ghost"
                      href={`/projects/${id}/files?path=subagents/${subagent.id}.md`}
                    >
                      Edit
                    </Link>
                    <form action={deleteSubagentAction}>
                      <input type="hidden" name="projectId" value={id} />
                      <input type="hidden" name="subagentId" value={subagent.id} />
                      <button className="button" data-variant="danger" type="submit">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
                <div className="row">
                  <span className="badge mono">{subagent.model?.id ?? "inherits model"}</span>
                  <span className="badge">{plural(subagent.tools.length, "tool")}</span>
                  <span className="badge">{plural(subagent.skills.length, "skill")}</span>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <Reveal delay={0.1}>
        <section className="section">
          <h2 className="section-title">Create subagent</h2>
          <form action={createSubagentAction} className="panel">
            <div className="modal-body">
              <input type="hidden" name="projectId" value={id} />
              <div className="grid-2">
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
                  <p className="helper">Leave empty to inherit the main agent&apos;s model.</p>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="button" data-variant="primary" type="submit">
                Create subagent
              </button>
            </div>
          </form>
        </section>
      </Reveal>
    </div>
  );
}
