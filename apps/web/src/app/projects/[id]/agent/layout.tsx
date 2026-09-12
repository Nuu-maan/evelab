import { AgentTabs } from "@/components/agent-tabs";

export default async function AgentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="page page-wide">
      <header>
        <h1 className="page-title">Agent</h1>
        <p className="page-description">
          Everything here writes to <code className="mono">agent.ts</code> and{" "}
          <code className="mono">instructions.md</code>. Nothing is stored only in EveLab.
        </p>
      </header>
      <AgentTabs projectId={id} />
      {children}
    </div>
  );
}
