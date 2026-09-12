import Link from "next/link";
import { deleteProjectAction, disconnectRepositoryAction } from "@/lib/actions";
import { readGitState } from "@/lib/git";
import { readProject, workspaceRoot } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, git] = await Promise.all([readProject(id), readGitState(id)]);

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Settings</h1>
          <p className="page-description">Where this project lives, and how to remove it.</p>
        </div>
      </header>

      <section className="panel">
        <div className="modal-body">
          <div className="section">
            <h2 className="section-title">On disk</h2>
            <p className="page-description">
              The project is a normal directory. Open it in your editor, run Eve against it, or put
              it under version control without EveLab.
            </p>
          </div>
          <pre className="code mono">{`${workspaceRoot()}/${id}`}</pre>
        </div>
        <div className="modal-foot" style={{ justifyContent: "flex-start" }}>
          <p className="helper">
            {project.files.length} files. Set EVELAB_WORKSPACE to store projects elsewhere.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="modal-body">
          <div className="section">
            <h2 className="section-title">Repository</h2>
            {git ? (
              <p className="page-description">
                Connected to{" "}
                <a className="mono" href={git.url} target="_blank" rel="noreferrer noopener">
                  {git.repository}
                </a>{" "}
                on <span className="mono">{git.branch}</span>. Disconnecting only forgets the link:
                nothing changes on GitHub or in the project files.
              </p>
            ) : (
              <p className="page-description">
                Not connected. Connect an existing repository or create one from Source control.
              </p>
            )}
          </div>
        </div>
        <div className="modal-foot">
          {git ? (
            <form action={disconnectRepositoryAction}>
              <input type="hidden" name="projectId" value={id} />
              <button className="button" data-variant="danger" type="submit">
                Disconnect repository
              </button>
            </form>
          ) : (
            <Link className="button" href={`/projects/${id}/source`}>
              Open source control
            </Link>
          )}
        </div>
      </section>

      <section
        className="panel"
        style={{ borderColor: "color-mix(in srgb, var(--danger) 30%, var(--border))" }}
      >
        <div className="modal-body">
          <div className="section">
            <h2 className="section-title">Delete project</h2>
            <p className="page-description">
              Deletes the directory and everything in it. There is no undo and no copy elsewhere.
            </p>
          </div>
        </div>
        <div className="modal-foot">
          <form action={deleteProjectAction}>
            <input type="hidden" name="id" value={id} />
            <button className="button" data-variant="danger" type="submit">
              Delete {project.agent.name}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
