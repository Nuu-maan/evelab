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
        <header className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Agent</h1>
            <p className="page-description">
              How your agent behaves. Everything here writes to{" "}
              <code className="mono">agent/agent.ts</code> and{" "}
              <code className="mono">agent/instructions.md</code>; nothing is stored only in EveLab.
            </p>
          </div>
        </header>
      </Reveal>
      <AgentTabs projectId={id} />
      <Reveal delay={0.05}>{children}</Reveal>
    </div>
  );
}
