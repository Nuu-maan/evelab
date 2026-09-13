import { IconLink } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default function ConnectionsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Connections</h1>
          <p className="page-description">
            Vercel Connect will own external service auth so EveLab never stores provider
            credentials itself.
          </p>
        </div>
      </header>
      <EmptyState icon={IconLink} title="Not connected to Vercel Connect yet.">
          This page stays empty until the connection flow is wired up. Nothing here is stored in
          EveLab today, so there is no credential to lose.
      </EmptyState>
    </div>
  );
}
