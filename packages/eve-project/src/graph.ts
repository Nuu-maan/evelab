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
