import { IconChartActivity } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default function RunsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Runs</h1>
          <p className="page-description">Execution history and timelines.</p>
        </div>
      </header>
      <EmptyState icon={IconChartActivity} title="No runs yet.">
          Running an agent needs one decision first: where the Eve runtime executes during
          development. EveLab will drive Eve rather than re-implement it, so this page stays empty
          until that runtime target is picked. See docs/decisions.md.
      </EmptyState>
    </div>
  );
}
