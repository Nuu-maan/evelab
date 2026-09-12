export const dynamic = "force-dynamic";

export default function DeploymentsPage() {
  return (
    <div className="page">
      <header className="page-header page-header-centered">
        <h1 className="page-title">Deployments</h1>
        <p className="page-description">Production and preview state.</p>
      </header>
      <div className="empty">
        <p className="empty-title">Nothing deployed.</p>
        <p className="empty-body">
          Deployment follows the same path as any Eve project: commit the source, then deploy it.
          The GitHub and deploy integrations are not built yet.
        </p>
      </div>
    </div>
  );
}
