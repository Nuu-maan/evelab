import * as dagre from "@dagrejs/dagre";
import { z } from "zod";
import type { CanvasEdge, CanvasGraph, CanvasNodeKind } from "@evelab/eve-project";

export type Positions = Record<string, { x: number; y: number }>;

export const LAYOUT_MODES = ["hierarchical", "horizontal", "vertical", "freeform"] as const;

export const ANNOTATION_COLORS = [
  "default",
  "gray",
  "blue",
  "cyan",
  "teal",
  "green",
  "lime",
  "yellow",
  "amber",
  "orange",
  "red",
  "pink",
  "purple",
  "violet",
  "indigo",
] as const;

/** A note or section drawn on the canvas. Presentation only: it never touches the project. */
export const annotationSchema = z.object({
  id: z.string().regex(/^(note|section):[A-Za-z0-9-]{1,40}$/),
  type: z.enum(["note", "section"]),
  x: z.number().finite(),
  y: z.number().finite(),
  // Sizes are clamped rather than rejected, so one odd note never stops the whole layout from saving.
  width: z.number().finite().transform((value) => Math.min(10000, Math.max(24, value))),
  height: z.number().finite().transform((value) => Math.min(10000, Math.max(16, value))),
  text: z.string().max(20000).default(""),
  size: z.enum(["s", "m", "l"]).default("m"),
  bold: z.boolean().default(false),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  font: z.enum(["hand", "sans", "mono", "serif"]).default("hand"),
  color: z.enum(ANNOTATION_COLORS).default("default"),
});

export type Annotation = z.infer<typeof annotationSchema>;
export type LayoutMode = (typeof LAYOUT_MODES)[number];

/** Card sizes by tier, so the root reads largest and resources smallest. Heights are what layout reserves. */
export const NODE_SIZE: Record<CanvasNodeKind, { width: number; height: number }> = {
  agent: { width: 300, height: 136 },
  subagent: { width: 264, height: 132 },
  tool: { width: 232, height: 132 },
  skill: { width: 232, height: 132 },
  connection: { width: 232, height: 132 },
  channel: { width: 232, height: 132 },
};

export type NodeSizes = Map<string, { width: number; height: number }>;

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
  /** Rendered sizes, when the cards have been measured. Estimates overlap real cards. */
  sizes?: NodeSizes,
): Positions {
  const nodes = graph.nodes.filter((node) => !skip?.has(node.id));
  const edges = graph.edges.filter((edge) => !skip?.has(edge.source) && !skip?.has(edge.target));
  const sizeOf = (node: CanvasGraph["nodes"][number]) => sizes?.get(node.id) ?? NODE_SIZE[node.kind];
  if (mode === "vertical") return outline(nodes, edges, sizeOf);

  const layered = new dagre.graphlib.Graph();
  // Wide gaps leave room for the wires to turn and for their labels.
  layered.setGraph({
    rankdir: mode === "horizontal" ? "LR" : "TB",
    nodesep: mode === "horizontal" ? 40 : 56,
    ranksep: mode === "horizontal" ? 150 : 110,
  });
  layered.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) layered.setNode(node.id, { ...sizeOf(node) });
  for (const edge of edges) layered.setEdge(edge.source, edge.target);
  dagre.layout(layered);

  const positions: Positions = {};
  for (const node of nodes) {
    const placed = layered.node(node.id);
    const { width, height } = sizeOf(node);
    positions[node.id] = { x: Math.round(placed.x - width / 2), y: Math.round(placed.y - height / 2) };
  }
  return positions;
}

const COLUMN_GAP = 72;
const STACK_GAP = 24;
const INDENT = 48;
const ROW_GAP = 120;

/**
 * Columns by agent: the root on top, each subagent heading its own column
 * with the resources only it uses indented beneath, like a tree. Resources
 * several agents share sit in a column of their own to the right and below
 * every stack, so no wire has to cross a card to reach them.
 */
function outline(
  nodes: CanvasGraph["nodes"],
  edges: CanvasEdge[],
  sizeOf: (node: CanvasGraph["nodes"][number]) => { width: number; height: number },
): Positions {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const positions: Positions = {};
  const root = nodes.find((node) => node.kind === "agent");
  if (!root) return positions;

  const users = new Map<string, number>();
  const contains = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.relation === "contains") contains.set(edge.source, [...(contains.get(edge.source) ?? []), edge.target]);
    else users.set(edge.target, (users.get(edge.target) ?? 0) + 1);
  }
  const ownItems = (agentId: string) =>
    edges
      .filter((edge) => edge.source === agentId && edge.relation !== "contains" && (users.get(edge.target) ?? 0) <= 1)
      .map((edge) => edge.target);

  let bottom = 0;
  const stack = (left: number, top: number, items: string[]): number => {
    let y = top;
    let width = 0;
    for (const id of items) {
      const node = byId.get(id);
      if (!node || positions[id]) continue;
      positions[id] = { x: left + INDENT, y };
      const size = sizeOf(node);
      y += size.height + STACK_GAP;
      width = Math.max(width, INDENT + size.width);
    }
    bottom = Math.max(bottom, y);
    return width;
  };

  const rootSize = sizeOf(root);
  positions[root.id] = { x: 0, y: 0 };
  const rowY = rootSize.height + ROW_GAP;
  bottom = rowY;
  let x = Math.max(rootSize.width, stack(0, rowY, ownItems(root.id))) + COLUMN_GAP;

  const visitAgent = (id: string) => {
    const node = byId.get(id);
    if (!node || positions[id]) return;
    const size = sizeOf(node);
    positions[id] = { x, y: rowY };
    bottom = Math.max(bottom, rowY + size.height);
    const width = Math.max(size.width, stack(x, rowY + size.height + STACK_GAP + 16, ownItems(id)));
    x += width + COLUMN_GAP;
    for (const child of contains.get(id) ?? []) visitAgent(child);
  };
  for (const child of contains.get(root.id) ?? []) visitAgent(child);

  let y = bottom + 48;
  for (const node of nodes) {
    if (positions[node.id]) continue;
    positions[node.id] = { x, y };
    y += sizeOf(node).height + STACK_GAP;
  }
  return positions;
}

/** The picture before anyone drags anything. */
export function fallbackPositions(graph: CanvasGraph): Positions {
  return autoLayout(graph);
}
