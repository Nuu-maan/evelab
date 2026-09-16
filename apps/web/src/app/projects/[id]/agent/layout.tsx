import Link from "next/link";
import { agentPath } from "@evelab/eve-project";
import { AgentTabs } from "@/components/agent-tabs";
import { Reveal } from "@/components/motion";
import { Avatar } from "@/components/project-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getProject } from "@/lib/workspace";

export default async function AgentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  const configPath = agentPath(project.root, "agent.ts");
  const { model, reasoning } = project.agent;
  const modelLabel = model?.id || (model?.expression ? "Model set in code" : "Default model");

  return (
    <div className="page">
      <Reveal>
        <header className="page-header">
          <div className="row" style={{ gap: "var(--space-4)", minWidth: 0 }}>
            <Avatar name={project.agent.name} size="large" />
            <div className="page-heading">
              <h1 className="page-title">{project.agent.name}</h1>
              <div className="agent-meta">
                <Badge variant="outline" className="font-mono">
                  {modelLabel}
                </Badge>
                {reasoning && reasoning !== "provider-default" && <Badge variant="outline">{reasoning} reasoning</Badge>}
                <span className="hint mono">{configPath}</span>
              </div>
            </div>
          </div>
          <div className="page-actions">
            <Button asChild variant="outline">
              <Link href={`/projects/${id}/files?path=${encodeURIComponent(configPath)}`}>View agent.ts</Link>
            </Button>
            <Button asChild>
              <Link href={`/projects/${id}/canvas`}>Open canvas</Link>
            </Button>
          </div>
        </header>
      </Reveal>
      <AgentTabs projectId={id} />
      <Reveal delay={0.05}>{children}</Reveal>
    </div>
  );
}
