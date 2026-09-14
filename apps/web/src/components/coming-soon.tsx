import { IconClock } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";

/** A section that is planned but not wired up yet, so it says so instead of half working. */
export function ComingSoon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="page">
      <header className="page-header">
        <div className="page-heading">
          <span className="page-kicker">Coming soon</span>
          <h1 className="page-title">{title}</h1>
        </div>
      </header>
      <EmptyState icon={IconClock} title={`${title} is coming soon.`}>
        {children}
      </EmptyState>
    </div>
  );
}
