import { skillFilePath } from "./generate.js";
import type { Channel, ChannelKind, Connection, EveProject, Skill, Subagent, Tool, ToolKind } from "./types.js";

export type CanvasNodeKind = "agent" | "subagent" | "tool" | "skill" | "connection" | "channel";

/** How two nodes relate, as a person would say it. */
export type CanvasRelation = "contains" | "has tool" | "has skill" | "connects to" | "routes to";

export interface CapabilityCounts {
  tools: number;
  skills: number;
  subagents: number;
  connections: number;
  channels?: number;
}

export interface CanvasNode {
  /**
   * Stable id, unique across the project: "agent", "subagent:researcher",
   * "tool:search_docs" or "tool:researcher/browse" for a resource defined in
   * place, "connection:#github" for a shared definition in `lib/`, and
   * "channel:slack".
   */
  id: string;
  kind: CanvasNodeKind;
  name: string;
  /** One short line: the model, the tool's kind, the MCP host. */
  detail: string;
  /** The entity's own description, when it has one. */
  description?: string;
  /** What an agent or subagent uses directly. */
  counts?: CapabilityCounts;
  /** The file this node edits. Every node on the canvas maps to real source. */
  filePath: string;
  /** A canonical definition under `lib/` that agents re-export. */
  shared?: boolean;
  /** Agent node ids that use this resource, in canvas order. */
  usedBy?: string[];
}

export interface CanvasEdge {
  source: string;
  target: string;
  relation: CanvasRelation;
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

const CHANNEL_LABELS: Partial<Record<ChannelKind, string>> = {
  eve: "HTTP session API",
  slack: "Slack",
  discord: "Discord",
  teams: "Microsoft Teams",
  telegram: "Telegram",
  twilio: "Twilio",
  github: "GitHub",
  linear: "Linear",
  mcp: "MCP clients",
  "chat-sdk": "Chat SDK",
  custom: "Custom channel",
  disabled: "Disabled route",
};

const RELATION: Record<"tool" | "skill" | "connection", CanvasRelation> = {
  tool: "has tool",
  skill: "has skill",
  connection: "connects to",
};

interface CapabilityOwner {
  tools: Tool[];
  skills: Skill[];
  connections: Connection[];
  subagents: Subagent[];
}

function countsOf(owner: CapabilityOwner, channels?: Channel[]): CapabilityCounts {
  return {
    tools: owner.tools.length,
    skills: owner.skills.length,
    subagents: owner.subagents.length,
    connections: owner.connections.length,
    ...(channels ? { channels: channels.length } : {}),
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

function modelDetail(model: { id: string; expression?: string } | undefined): string {
  return model?.id || (model?.expression ? "Model set in code" : "Default model");
}

function connectionDetail(connection: Connection): string {
  const label = connection.kind === "mcp" ? "MCP" : connection.kind === "openapi" ? "OpenAPI" : "Connection";
  const host = hostOf(connection.url ?? connection.spec);
  return host ? `${label} · ${host}` : label;
}

function skillDetail(skill: Skill): string {
  if (skill.format === "package") return `Skill package, ${skill.files.length + 1} files`;
  return skill.format === "module" ? "defineSkill" : "Markdown skill";
}

/**
 * The canvas: the agent, its subagents, and what each uses. A shared resource
 * is one node with an edge from every agent that re-exports it, so the picture
 * shows a resource once no matter how many agents use it.
 */
export function getCanvasGraph(project: EveProject): CanvasGraph {
  const base = project.root ? `${project.root}/` : "";
  const { agent } = project;
  const nodes: CanvasNode[] = [
    {
      id: "agent",
      kind: "agent",
      name: agent.name,
      detail: modelDetail(agent.model),
      description: agent.description || undefined,
      counts: countsOf(project, project.channels),
      filePath:
        project.files.some((file) => file.path === `${base}instructions.md`) || !agent.hasConfig
          ? `${base}instructions.md`
          : `${base}agent.ts`,
    },
  ];
  const edges: CanvasEdge[] = [];
  const sharedNodes = new Map<string, CanvasNode>();

  const sharedNode = (kind: "tool" | "skill" | "connection", name: string): CanvasNode => {
    const id = `${kind}:#${name}`;
    const existing = sharedNodes.get(id);
    if (existing) return existing;
    let node: CanvasNode;
    if (kind === "tool") {
      const tool = project.library.tools.find((entry) => entry.id === name);
      node = {
        id,
        kind,
        name,
        detail: tool ? TOOL_LABELS[tool.kind] : "Missing definition",
        description: tool?.description || undefined,
        filePath: `${base}lib/tools/${tool?.file ?? `${name}.ts`}`,
      };
    } else if (kind === "skill") {
      const skill = project.library.skills.find((entry) => entry.id === name);
      node = {
        id,
        kind,
        name,
        detail: skill ? "defineSkill" : "Missing definition",
        description: skill?.description || undefined,
        filePath: `${base}lib/skills/${name}.ts`,
      };
    } else {
      const connection = project.library.connections.find((entry) => entry.id === name);
      node = {
        id,
        kind,
        name,
        detail: connection ? connectionDetail(connection) : "Missing definition",
        description: connection?.description || undefined,
        filePath: `${base}lib/connections/${connection?.file ?? `${name}.ts`}`,
      };
    }
    node.shared = true;
    node.usedBy = [];
    sharedNodes.set(id, node);
    nodes.push(node);
    return node;
  };

  const addOwner = (ownerId: string, ownerKey: string, ownerBase: string, owner: CapabilityOwner): void => {
    const prefix = ownerKey ? `${ownerKey}/` : "";

    for (const subagent of owner.subagents) {
      const key = `${prefix}${subagent.id}`;
      const id = `subagent:${key}`;
      nodes.push({
        id,
        kind: "subagent",
        name: subagent.id,
        detail: subagent.kind === "remote" ? "Remote agent" : modelDetail(subagent.model),
        description: subagent.description || undefined,
        counts: subagent.kind === "local" ? countsOf(subagent) : undefined,
        filePath:
          subagent.kind === "remote" ? `${ownerBase}subagents/${subagent.id}.ts` : `${ownerBase}subagents/${subagent.id}/agent.ts`,
      });
      edges.push({ source: ownerId, target: id, relation: "contains" });
      if (subagent.kind === "local") addOwner(id, key, `${ownerBase}subagents/${subagent.id}/`, subagent);
    }

    const link = (kind: "tool" | "skill" | "connection", entry: { shared?: string }, local: () => CanvasNode) => {
      let node: CanvasNode;
      if (entry.shared) {
        node = sharedNode(kind, entry.shared);
      } else {
        node = local();
        nodes.push(node);
      }
      node.usedBy = [...(node.usedBy ?? []), ownerId];
      edges.push({ source: ownerId, target: node.id, relation: RELATION[kind] });
    };

    for (const tool of owner.tools) {
      link("tool", tool, () => ({
        id: `tool:${prefix}${tool.id}`,
        kind: "tool",
        name: tool.id,
        detail: TOOL_LABELS[tool.kind],
        description: tool.description || undefined,
        filePath: `${ownerBase}tools/${tool.file}`,
      }));
    }

    for (const skill of owner.skills) {
      link("skill", skill, () => ({
        id: `skill:${prefix}${skill.id}`,
        kind: "skill",
        name: skill.id,
        detail: skillDetail(skill),
        description: skill.description || undefined,
        filePath: skillFilePath(ownerBase, skill),
      }));
    }

    for (const connection of owner.connections) {
      link("connection", connection, () => ({
        id: `connection:${prefix}${connection.id}`,
        kind: "connection",
        name: connection.id,
        detail: connectionDetail(connection),
        description: connection.description || undefined,
        filePath: `${ownerBase}connections/${connection.file}`,
      }));
    }
  };

  addOwner("agent", "", base, project);

  // Shared definitions nobody uses yet still belong on the canvas, ready to attach.
  for (const tool of project.library.tools) sharedNode("tool", tool.id);
  for (const skill of project.library.skills) sharedNode("skill", skill.id);
  for (const connection of project.library.connections) sharedNode("connection", connection.id);

  for (const channel of project.channels) {
    const id = `channel:${channel.id}`;
    nodes.push({
      id,
      kind: "channel",
      name: channel.id,
      detail: CHANNEL_LABELS[channel.kind] ?? "Channel",
      filePath: `${base}channels/${channel.file}`,
    });
    edges.push({ source: "agent", target: id, relation: "routes to" });
  }

  return { nodes, edges };
}
