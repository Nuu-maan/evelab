import { IconCloudUpload } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default function DeploymentsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Deployments</h1>
          <p className="page-description">Production and preview state.</p>
        </div>
      </header>
      <EmptyState icon={IconCloudUpload} title="Nothing deployed.">
          Deployment follows the same path as any Eve project: commit the source, then deploy it.
          The GitHub and deploy integrations are not built yet.
      </EmptyState>
    </div>
  );
}
