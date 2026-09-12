import { deleteProjectAction } from "@/lib/actions";
import { readProject, workspaceRoot } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);

  return (
    <div className="page">
      <header className="page-header page-header-centered">
        <p className="page-eyebrow">Settings</p>
        <h1 className="page-title">Where this project lives</h1>
      </header>

      <section className="section" style={{ maxWidth: 620, marginInline: "auto", width: "100%" }}>
        <h2 className="section-title">On disk</h2>
        <p className="page-description">
          The project is a normal directory. Open it in your editor, run Eve against it, or put it
          under version control without EveLab.
        </p>
        <pre className="code mono">{`${workspaceRoot()}/${id}`}</pre>
        <p className="helper">
          {project.files.length} files · set EVELAB_WORKSPACE to store projects elsewhere.
        </p>
      </section>

      <section className="section" style={{ maxWidth: 620, marginInline: "auto", width: "100%" }}>
        <h2 className="section-title">Delete project</h2>
        <p className="page-description">
          Deletes the directory and everything in it. There is no undo and no copy elsewhere.
        </p>
        <form action={deleteProjectAction}>
          <input type="hidden" name="id" value={id} />
          <button className="button" data-variant="danger" type="submit">
            Delete {project.agent.name}
          </button>
        </form>
      </section>
    </div>
  );
}
