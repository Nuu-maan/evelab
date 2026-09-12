export const dynamic = "force-dynamic";

export default function ConnectionsPage() {
  return (
    <div className="page">
      <header>
        <h1 className="page-title">Connections</h1>
        <p className="page-description">
          Vercel Connect will own external service auth so EveLab never stores provider credentials
          itself.
        </p>
      </header>
      <div className="empty">
        <p className="empty-title">Not connected to Vercel Connect yet.</p>
        <p className="empty-body">
          This page stays empty until the connection flow is wired up. Nothing here is stored in
          EveLab today, so there is no credential to lose.
        </p>
      </div>
    </div>
  );
}
