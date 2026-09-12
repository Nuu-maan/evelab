export const dynamic = "force-dynamic";

export default function RunsPage() {
  return (
    <div className="page">
      <header>
        <h1 className="page-title">Runs</h1>
        <p className="page-description">Execution history and timelines.</p>
      </header>
      <div className="empty">
        <p className="empty-title">No runs yet.</p>
        <p className="empty-body">
          Running an agent needs one decision first: where the Eve runtime executes during
          development. EveLab will drive Eve rather than re-implement it, so this page stays empty
          until that runtime target is picked. See docs/decisions.md.
        </p>
      </div>
    </div>
  );
}
