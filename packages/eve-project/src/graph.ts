import { skillFilePath } from "./generate.js";
import type { Connection, EveProject, Skill, Subagent, Tool, ToolKind } from "./types.js";

export type CanvasNodeKind = "agent" | "subagent" | "tool" | "skill" | "connection";

export interface CanvasNode {
  /**
   * Stable id, unique across the project: "agent", "subagent:researcher",
   * "tool:search_docs", or owner-qualified for a subagent's own capability,
   * "tool:researcher/browse".
   */
  id: string;
  kind: CanvasNodeKind;
  name: string;
  /** One short line: the model, the tool's kind, the MCP host. */
  detail: string;
  /** The entity's own description, when it has one. */
  description?: string;
  /** What an agent or subagent owns directly. */
  counts?: CapabilityCounts;
  /** The file this node edits. Every node on the canvas maps to real source. */
  filePath: string;
}

export interface CapabilityCounts {
  tools: number;
  skills: number;
  subagents: number;
  connections: number;
}

export interface CanvasEdge {
  source: string;
  target: string;
}

export interface CanvasGraph {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const TOOL_LABELS: Record<ToolKind, string> = {
  tool: "Tool",
  workflow: "Workflow tool",
  provided: "Built-in tool",
  disabled: "Disabled built-in",
  dynamic: "Dynamic tool",
  other: "Tool module",
};

interface CapabilityOwner {
  tools: Tool[];
  skills: Skill[];
  connections: Connection[];
  subagents: Subagent[];
}

function countsOf(owner: CapabilityOwner): CapabilityCounts {
  return {
    tools: owner.tools.length,
    skills: owner.skills.length,
    subagents: owner.subagents.length,
    connections: owner.connections.length,
  };
}

function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

/**
 * The canvas view: the agent, its subagents, and what each of them can use. In
 * Eve a subagent inherits nothing from its parent, so an edge means the file
 * lives in that agent's own directory.
 */
export function getCanvasGraph(project: EveProject): CanvasGraph {
  const base = project.root ? `${project.root}/` : "";
  const { agent } = project;
  const nodes: CanvasNode[] = [
    {
      id: "agent",
      kind: "agent",
      name: agent.name,
      detail: agent.model?.id || (agent.model?.expression ? "Model set in code" : "Default model"),
      description: agent.description || undefined,
      counts: countsOf(project),
      filePath: project.files.some((file) => file.path === `${base}instructions.md`) || !agent.hasConfig
        ? `${base}instructions.md`
        : `${base}agent.ts`,
    },
  ];
  const edges: CanvasEdge[] = [];
  addOwner(nodes, edges, "agent", "", base, project);
  return { nodes, edges };
}

function addOwner(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  ownerId: string,
  ownerKey: string,
  base: string,
  owner: CapabilityOwner,
): void {
  const prefix = ownerKey ? `${ownerKey}/` : "";

  for (const subagent of owner.subagents) {
    const key = `${prefix}${subagent.id}`;
    const id = `subagent:${key}`;
    nodes.push({
      id,
      kind: "subagent",
      name: subagent.id,
      detail:
        subagent.kind === "remote"
          ? "Remote agent"
          : subagent.model?.id || (subagent.model?.expression ? "Model set in code" : "Default model"),
      description: subagent.description || undefined,
      counts: subagent.kind === "local" ? countsOf(subagent) : undefined,
      filePath: subagent.kind === "remote" ? `${base}subagents/${subagent.id}.ts` : `${base}subagents/${subagent.id}/agent.ts`,
    });
    edges.push({ source: ownerId, target: id });
    if (subagent.kind === "local") addOwner(nodes, edges, id, key, `${base}subagents/${subagent.id}/`, subagent);
  }

  for (const tool of owner.tools) {
    const id = `tool:${prefix}${tool.id}`;
    nodes.push({
      id,
      kind: "tool",
      name: tool.id,
      detail: TOOL_LABELS[tool.kind],
      description: tool.description || undefined,
      filePath: `${base}tools/${tool.file}`,
    });
    edges.push({ source: ownerId, target: id });
  }

  for (const skill of owner.skills) {
    const id = `skill:${prefix}${skill.id}`;
    const files = skill.files.length + 1;
    nodes.push({
      id,
      kind: "skill",
      name: skill.id,
      detail: skill.format === "package" ? `Skill package, ${files} files` : skill.format === "module" ? "defineSkill" : "Markdown skill",
      description: skill.description || undefined,
      filePath: skillFilePath(base, skill),
    });
    edges.push({ source: ownerId, target: id });
  }

  for (const connection of owner.connections) {
    const id = `connection:${prefix}${connection.id}`;
    const label = connection.kind === "mcp" ? "MCP" : connection.kind === "openapi" ? "OpenAPI" : "Connection";
    const host = hostOf(connection.url ?? connection.spec);
    nodes.push({
      id,
      kind: "connection",
      name: connection.id,
      detail: host ? `${label} · ${host}` : label,
      description: connection.description || undefined,
      filePath: `${base}connections/${connection.file}`,
    });
    edges.push({ source: ownerId, target: id });
  }
}
