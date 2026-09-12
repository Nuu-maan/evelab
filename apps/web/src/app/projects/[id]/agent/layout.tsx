import { AgentTabs } from "@/components/agent-tabs";
import { Reveal } from "@/components/motion";

export default async function AgentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="page">
      <Reveal>
        <header className="page-header page-header-centered">
          <p className="page-eyebrow">Agent</p>
          <h1 className="page-title">How your agent behaves</h1>
          <p className="page-description">
            Everything here writes to <code className="mono">agent.ts</code> and{" "}
            <code className="mono">instructions.md</code>. Nothing is stored only in EveLab.
          </p>
        </header>
      </Reveal>
      <AgentTabs projectId={id} />
      <Reveal delay={0.05}>{children}</Reveal>
    </div>
  );
}
