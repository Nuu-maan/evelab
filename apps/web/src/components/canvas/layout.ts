import * as dagre from "@dagrejs/dagre";
import type { CanvasEdge, CanvasGraph, CanvasNodeKind } from "@evelab/eve-project";

export type Positions = Record<string, { x: number; y: number }>;

export const LAYOUT_MODES = ["hierarchical", "horizontal", "vertical", "freeform"] as const;
export type LayoutMode = (typeof LAYOUT_MODES)[number];

/** Card sizes by tier, so the root reads largest and resources smallest. Heights are what layout reserves. */
export const NODE_SIZE: Record<CanvasNodeKind, { width: number; height: number }> = {
  agent: { width: 300, height: 150 },
  subagent: { width: 260, height: 132 },
  tool: { width: 220, height: 96 },
  skill: { width: 220, height: 96 },
  connection: { width: 220, height: 96 },
  channel: { width: 220, height: 96 },
};

export function nodeWidth(kind: CanvasNodeKind): number {
  return NODE_SIZE[kind].width;
}

/**
 * Places every node from the graph's structure. Hierarchical and horizontal
 * are layered layouts from dagre, which keeps a shared resource between the
 * agents that use it; vertical is an indented outline, one agent after another.
 */
export function autoLayout(
  graph: CanvasGraph,
  mode: Exclude<LayoutMode, "freeform"> = "hierarchical",
  skip?: Set<string>,
): Positions {
  const nodes = graph.nodes.filter((node) => !skip?.has(node.id));
  const edges = graph.edges.filter((edge) => !skip?.has(edge.source) && !skip?.has(edge.target));
  if (mode === "vertical") return outline(nodes, edges);

  const layered = new dagre.graphlib.Graph();
  layered.setGraph({
    rankdir: mode === "horizontal" ? "LR" : "TB",
    nodesep: mode === "horizontal" ? 24 : 36,
    ranksep: mode === "horizontal" ? 120 : 96,
  });
  layered.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) layered.setNode(node.id, { ...NODE_SIZE[node.kind] });
  for (const edge of edges) layered.setEdge(edge.source, edge.target);
  dagre.layout(layered);

  const positions: Positions = {};
  for (const node of nodes) {
    const placed = layered.node(node.id);
    const { width, height } = NODE_SIZE[node.kind];
    positions[node.id] = { x: Math.round(placed.x - width / 2), y: Math.round(placed.y - height / 2) };
  }
  return positions;
}

const INDENT = 64;
const GAP = 16;

function outline(nodes: CanvasGraph["nodes"], edges: CanvasEdge[]): Positions {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const out = new Map<string, CanvasEdge[]>();
  for (const edge of edges) out.set(edge.source, [...(out.get(edge.source) ?? []), edge]);

  const positions: Positions = {};
  let y = 0;
  const visit = (id: string, depth: number) => {
    const node = byId.get(id);
    if (!node || positions[id]) return;
    positions[id] = { x: depth * INDENT, y };
    y += NODE_SIZE[node.kind].height + GAP;
    const children = out.get(id) ?? [];
    // An agent's own resources sit right under it, then its subagents with theirs.
    for (const edge of children) if (edge.relation !== "contains") visit(edge.target, depth + 1);
    for (const edge of children) if (edge.relation === "contains") visit(edge.target, depth + 1);
  };
  visit("agent", 0);
  for (const node of nodes) visit(node.id, 0);
  return positions;
}

/** The picture before anyone drags anything. */
export function fallbackPositions(graph: CanvasGraph): Positions {
  return autoLayout(graph);
}
