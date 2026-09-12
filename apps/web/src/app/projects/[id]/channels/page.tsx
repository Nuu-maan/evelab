export const dynamic = "force-dynamic";

export default function ChannelsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Channels</h1>
          <p className="page-description">How people reach the agent.</p>
        </div>
      </header>
      <div className="empty">
        <p className="empty-title">No channels configured.</p>
        <p className="empty-body">
          Channel setup writes to <code className="mono">channels/</code>. It is not implemented yet:
          the file layout needs confirming against Eve first so an EveLab-written channel matches a
          hand-written one exactly.
        </p>
      </div>
    </div>
  );
}
