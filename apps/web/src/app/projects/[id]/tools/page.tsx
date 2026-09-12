import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { createToolAction, deleteToolAction } from "@/lib/actions";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ToolsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);

  return (
    <div className="page">
      <Reveal>
        <header className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Tools</h1>
            <p className="page-description">
              What your agent can do. One file per tool under <code className="mono">tools/</code>:
              EveLab scaffolds it, then the source is yours.
            </p>
          </div>
          <div className="page-actions">
            <Link className="button" href={`/projects/${id}/canvas`}>
              Add on the canvas
            </Link>
          </div>
        </header>
      </Reveal>

      {project.tools.length === 0 ? (
        <Reveal delay={0.06}>
          <div className="empty">
            <p className="empty-title">Your agent has no tools.</p>
            <p className="empty-body">
              Create a TypeScript tool below, or drag one onto the canvas. MCP server import is not
              built yet.
            </p>
          </div>
        </Reveal>
      ) : (
        <Stagger className="section">
          {project.tools.map((tool) => (
            <StaggerItem key={tool.id}>
              <div className="card" data-interactive="true">
                <div className="row-between">
                  <div>
                    <p className="card-title mono">{tool.name}</p>
                    <p className="card-detail">{tool.description || "No description"}</p>
                  </div>
                  <div className="row">
                    <span className="badge">{tool.origin}</span>
                    <Link
                      className="button"
                      data-variant="ghost"
                      href={`/projects/${id}/files?path=tools/${tool.id}.ts`}
                    >
                      Edit
                    </Link>
                    <form action={deleteToolAction}>
                      <input type="hidden" name="projectId" value={id} />
                      <input type="hidden" name="toolId" value={tool.id} />
                      <button className="button" data-variant="danger" type="submit">
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <Reveal delay={0.1}>
        <section className="section">
          <h2 className="section-title">Create TypeScript tool</h2>
          <form action={createToolAction} className="panel">
            <div className="modal-body">
              <input type="hidden" name="projectId" value={id} />
              <input type="hidden" name="openSource" value="true" />

              <div className="grid-2">
                <div className="field">
                  <label className="label" htmlFor="toolId">
                    Tool name
                  </label>
                  <input
                    className="input mono"
                    id="toolId"
                    name="toolId"
                    placeholder="search-docs"
                    pattern="[a-z0-9][a-z0-9-]*"
                    required
                  />
                  <p className="helper">Lowercase and dashes. Becomes tools/&lt;name&gt;.ts.</p>
                </div>

                <div className="field">
                  <label className="label" htmlFor="description">
                    Description
                  </label>
                  <input className="input" id="description" name="description" maxLength={280} />
                  <p className="helper">The model reads this to decide when to call it.</p>
                </div>
              </div>
            </div>

            <div className="modal-foot">
              <button className="button" data-variant="primary" type="submit">
                Create and open source
              </button>
            </div>
          </form>
        </section>
      </Reveal>
    </div>
  );
}
