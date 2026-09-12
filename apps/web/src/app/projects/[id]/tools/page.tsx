import Link from "next/link";
import { createToolAction } from "@/lib/actions";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ToolsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Tools</h1>
          <p className="page-description">
            Each tool is one file under <code className="mono">tools/</code>. EveLab scaffolds it,
            then gets out of the way.
          </p>
        </div>
      </header>

      {project.tools.length === 0 ? (
        <div className="empty">
          <p className="empty-title">Your agent has no tools.</p>
          <p className="empty-body">
            Add a TypeScript tool below. MCP server import lands next; until then an MCP tool can be
            written as a normal tool file.
          </p>
        </div>
      ) : (
        <ul className="list">
          {project.tools.map((tool) => (
            <li className="list-item" key={tool.id}>
              <div>
                <p className="list-item-title">{tool.name}</p>
                <p className="list-item-detail">
                  {tool.description || "No description"} · {tool.origin}
                </p>
              </div>
              <Link
                className="button"
                data-variant="ghost"
                href={`/projects/${id}/files?path=tools/${tool.id}.ts`}
              >
                Open source
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="section" style={{ maxWidth: 560 }}>
        <h2 className="section-title">Create TypeScript tool</h2>
        <form action={createToolAction} className="section">
          <input type="hidden" name="projectId" value={id} />
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
            <p className="helper">The model reads this to decide when to call the tool.</p>
          </div>
          <div className="row">
            <button className="button" data-variant="primary" type="submit">
              Create tool
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
