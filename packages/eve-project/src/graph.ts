import type { EveProject } from "./types.js";

export interface ProjectGraphNode {
  id: string;
  kind: "agent" | "subagent";
  name: string;
  model?: string;
  toolCount: number;
  skillCount: number;
}

export interface ProjectGraphEdge {
  source: string;
  target: string;
}

export interface ProjectGraph {
  nodes: ProjectGraphNode[];
  edges: ProjectGraphEdge[];
}

/** Answers one question for the canvas: who can invoke whom? */
export function getProjectGraph(project: EveProject): ProjectGraph {
  const rootId = "agent";
  const nodes: ProjectGraphNode[] = [
    {
      id: rootId,
      kind: "agent",
      name: project.agent.name,
      model: project.agent.model.id || undefined,
      toolCount: project.tools.length,
      skillCount: project.skills.length,
    },
    ...project.subagents.map((subagent) => ({
      id: subagent.id,
      kind: "subagent" as const,
      name: subagent.name,
      model: subagent.model?.id,
      toolCount: subagent.tools.length,
      skillCount: subagent.skills.length,
    })),
  ];

  return {
    nodes,
    edges: project.subagents.map((subagent) => ({ source: rootId, target: subagent.id })),
  };
}

export type CanvasNodeKind = "agent" | "subagent" | "tool" | "skill";

export interface CanvasNode {
  /** Stable id, unique across kinds: "agent", "tool:browse", "skill:web-research". */
  id: string;
  kind: CanvasNodeKind;
  name: string;
  detail: string;
  /** The file this node edits. Every node on the canvas maps to real source. */
  filePath: string;
}

export interface CanvasGraph {
  nodes: CanvasNode[];
  edges: ProjectGraphEdge[];
}

/**
 * The canvas view: the agent, its subagents, and every capability, each pointing
 * at the file that defines it. Edges are ownership, so the picture answers "what
 * can this agent reach, and through whom?".
 */
export function getCanvasGraph(project: EveProject): CanvasGraph {
  const nodes: CanvasNode[] = [
    {
      id: "agent",
      kind: "agent",
      name: project.agent.name,
      detail: project.agent.model.id || "No model set",
      filePath: project.agent.instructionsPath,
    },
  ];
  const edges: ProjectGraphEdge[] = [];

  for (const subagent of project.subagents) {
    const id = `subagent:${subagent.id}`;
    nodes.push({
      id,
      kind: "subagent",
      name: subagent.name,
      detail: subagent.model?.id ?? "Inherits model",
      filePath: `subagents/${subagent.id}.md`,
    });
    edges.push({ source: "agent", target: id });
  }

  for (const tool of project.tools) {
    const id = `tool:${tool.id}`;
    nodes.push({
      id,
      kind: "tool",
      name: tool.name,
      detail: tool.origin,
      filePath: `tools/${tool.id}.ts`,
    });
    // A tool owned by a subagent hangs off that subagent, not off the root.
    const owners = project.subagents.filter((subagent) => subagent.tools.includes(tool.id));
    if (owners.length === 0) {
      edges.push({ source: "agent", target: id });
    } else {
      for (const owner of owners) edges.push({ source: `subagent:${owner.id}`, target: id });
    }
  }

  for (const skill of project.skills) {
    const id = `skill:${skill.id}`;
    nodes.push({
      id,
      kind: "skill",
      name: skill.name,
      detail: skill.files.length > 0 ? `${skill.files.length + 1} files` : "1 file",
      filePath: `skills/${skill.id}/SKILL.md`,
    });
    const owners = project.subagents.filter((subagent) => subagent.skills.includes(skill.id));
    if (owners.length === 0) {
      edges.push({ source: "agent", target: id });
    } else {
      for (const owner of owners) edges.push({ source: `subagent:${owner.id}`, target: id });
    }
  }

  return { nodes, edges };
}
