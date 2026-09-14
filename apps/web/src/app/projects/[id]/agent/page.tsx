import Link from "next/link";
import { agentPath, type Subagent } from "@evelab/eve-project";
import { SettingCard } from "@/components/setting-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateAgentAction } from "@/lib/actions";
import { getProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function countSubagents(subagents: Subagent[]): number {
  return subagents.reduce((total, subagent) => total + 1 + (subagent.kind === "local" ? countSubagents(subagent.subagents) : 0), 0);
}

export default async function AgentGeneralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  const base = `/projects/${id}`;
  const fileHref = (path: string) => `${base}/files?path=${encodeURIComponent(path)}`;
  const configPath = agentPath(project.root, "agent.ts");
  const instructionsPath = agentPath(project.root, "instructions.md");
  const instructions = project.agent.instructions ?? "";
  const lines = instructions.split("\n").filter((line) => line.trim()).length;
  const { model } = project.agent;
  const resources = project.tools.length + project.skills.length + project.connections.length;

  const stats = [
    { label: "Model", value: model?.id || (model?.expression ? "Set in code" : "Default"), href: `${base}/agent/model`, mono: true },
    { label: "Instructions", value: `${lines} ${lines === 1 ? "line" : "lines"}`, href: `${base}/agent/instructions` },
    { label: "Channels", value: project.channels.length, href: `${base}/channels` },
    { label: "Subagents", value: countSubagents(project.subagents), href: `${base}/subagents` },
    { label: "Resources", value: resources, href: `${base}/canvas` },
    { label: "Schedules", value: project.schedules.length, href: `${base}/schedules` },
  ];

  return (
    <div className="settings-stack">
      <nav className="agent-stats" aria-label="Agent at a glance">
        {stats.map((stat) => (
          <Link key={stat.label} className="agent-stat" href={stat.href}>
            <span className="agent-stat-label">{stat.label}</span>
            <span className={stat.mono ? "agent-stat-value mono" : "agent-stat-value tabular-nums"}>{stat.value}</span>
          </Link>
        ))}
      </nav>

      <form action={updateAgentAction}>
        <input type="hidden" name="id" value={id} />
        <SettingCard
          title="Description"
          description="One sentence on what this agent is for. A parent agent reads it to decide when to delegate, and it heads the README."
          footer={
            <>
              Written to <code className="mono">{configPath}</code>.
            </>
          }
          action={
            <Button type="submit" size="sm">
              Save
            </Button>
          }
        >
          <Input
            name="description"
            aria-label="Description"
            defaultValue={project.agent.description ?? ""}
            placeholder="Answers support tickets and escalates the hard ones."
            maxLength={280}
          />
        </SettingCard>
      </form>

      <SettingCard
        title="Name"
        description="eve names the agent after the name field in package.json, so the agent and its package always match."
        footer="Rename it in package.json, then redeploy."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={fileHref("package.json")}>Open package.json</Link>
          </Button>
        }
      >
        <Input value={project.agent.name} readOnly aria-label="Name" className="font-mono" />
      </SettingCard>

      <SettingCard
        title="Instructions"
        description="The system prompt every session starts from, whichever channel the message came in on."
        footer={<code className="mono">{instructionsPath}</code>}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={`${base}/agent/instructions`}>Edit instructions</Link>
          </Button>
        }
      >
        <pre className="setting-preview">{instructions.trim().slice(0, 700) || "No instructions yet."}</pre>
      </SettingCard>
    </div>
  );
}
