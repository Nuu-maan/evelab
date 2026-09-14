import type { CanvasGraph } from "@evelab/eve-project";

/**
 * A made-up support agent for the landing page: enough of every kind of node to
 * show what the canvas draws, drawn by the same preview the projects page uses.
 */
export const SAMPLE_GRAPH: CanvasGraph = {
  nodes: [
    { id: "channel:slack", kind: "channel", name: "slack", detail: "Slack", filePath: "agent/channels/slack.ts" },
    { id: "channel:eve", kind: "channel", name: "eve", detail: "HTTP session API", filePath: "agent/channels/eve.ts" },
    {
      id: "agent",
      kind: "agent",
      name: "support-desk",
      detail: "anthropic/claude-sonnet-5",
      filePath: "agent/agent.ts",
      counts: { subagents: 2, tools: 1, skills: 1, connections: 1, channels: 2 },
    },
    {
      id: "subagent:billing",
      kind: "subagent",
      name: "billing",
      detail: "openai/gpt-5.6-terra",
      filePath: "agent/subagents/billing/agent.ts",
      counts: { subagents: 0, tools: 1, skills: 0, connections: 1, channels: 0 },
    },
    {
      id: "subagent:researcher",
      kind: "subagent",
      name: "researcher",
      detail: "openai/gpt-5.6-terra",
      filePath: "agent/subagents/researcher/agent.ts",
      counts: { subagents: 0, tools: 1, skills: 1, connections: 1, channels: 0 },
    },
    { id: "tool:search_docs", kind: "tool", name: "search_docs", detail: "Tool", filePath: "agent/lib/tools/search_docs.ts", shared: true, usedBy: ["agent", "subagent:researcher"] },
    { id: "tool:refund", kind: "tool", name: "refund", detail: "Tool", filePath: "agent/subagents/billing/tools/refund.ts", usedBy: ["subagent:billing"] },
    { id: "skill:triage", kind: "skill", name: "triage", detail: "Skill", filePath: "agent/lib/skills/triage/SKILL.md", shared: true, usedBy: ["agent", "subagent:researcher"] },
    { id: "connection:#github", kind: "connection", name: "github", detail: "MCP", filePath: "agent/lib/connections/github.ts", shared: true, usedBy: ["agent", "subagent:billing", "subagent:researcher"] },
  ],
  edges: [
    { source: "agent", target: "channel:slack", relation: "routes to" },
    { source: "agent", target: "channel:eve", relation: "routes to" },
    { source: "agent", target: "subagent:billing", relation: "contains" },
    { source: "agent", target: "subagent:researcher", relation: "contains" },
    { source: "agent", target: "tool:search_docs", relation: "has tool" },
    { source: "agent", target: "skill:triage", relation: "has skill" },
    { source: "agent", target: "connection:#github", relation: "connects to" },
    { source: "subagent:billing", target: "tool:refund", relation: "has tool" },
    { source: "subagent:billing", target: "connection:#github", relation: "connects to" },
    { source: "subagent:researcher", target: "tool:search_docs", relation: "has tool" },
    { source: "subagent:researcher", target: "skill:triage", relation: "has skill" },
    { source: "subagent:researcher", target: "connection:#github", relation: "connects to" },
  ],
};
