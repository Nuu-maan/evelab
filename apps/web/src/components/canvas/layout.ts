import { z } from "zod";
import type { CanvasEdge, CanvasGraph, CanvasNodeKind } from "@evelab/eve-project";

export type Positions = Record<string, { x: number; y: number }>;

export const LAYOUT_MODES = ["hierarchical", "horizontal", "vertical", "freeform"] as const;

/** How wires are drawn, as Excalidraw offers arrows: straight, curved or elbow. */
export const WIRE_STYLES = ["curved", "elbow", "straight"] as const;
export type WireStyle = (typeof WIRE_STYLES)[number];

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
  agent: { width: 300, height: 132 },
  subagent: { width: 280, height: 132 },
  tool: { width: 240, height: 100 },
  skill: { width: 240, height: 100 },
  connection: { width: 240, height: 100 },
  channel: { width: 240, height: 100 },
};

export type NodeSizes = Map<string, { width: number; height: number }>;

/** The ports along an agent card, left to right: one endpoint for each kind of thing it can have. */
export const PORT_ORDER = ["subagent", "tool", "skill", "connection", "channel"] as const;
export type PortKind = (typeof PORT_ORDER)[number];

/** The ports along an agent card's bottom edge. Channels have their own port on the root's top edge. */
export function portsFor(_kind: CanvasNodeKind): readonly PortKind[] {
  return PORT_ORDER.slice(0, 4);
}

/** Every port an agent has, for panels that list them: the root adds channels. */
export function allPortsFor(kind: CanvasNodeKind): readonly PortKind[] {
  return kind === "agent" ? PORT_ORDER : PORT_ORDER.slice(0, 4);
}

/** Where a port sits along its card's edge, as a fraction of the edge. Cards and layout share this. */
export function portFraction(owner: CanvasNodeKind, port: CanvasNodeKind): number {
  const ports = portsFor(owner);
  const index = ports.indexOf(port as PortKind);
  return index < 0 ? 0.5 : (index + 0.5) / ports.length;
}

export function nodeWidth(kind: CanvasNodeKind): number {
  return NODE_SIZE[kind].width;
}

const ROW_GAP = { hierarchical: 132, horizontal: 180 };
const SIBLING_GAP = { hierarchical: 40, horizontal: 28 };

/**
 * A layered layout that knows about ports. Each card sits in the row after
 * its deepest user, and within a row cards are ordered by where the ports that
 * point at them sit, so a subagent lands under the subagent port and a skill
 * under the skill port. Wires then run straight down from their port instead of
 * across other cards. Horizontal is the same picture turned on its side.
 */
export function autoLayout(
  graph: CanvasGraph,
  mode: Exclude<LayoutMode, "freeform"> = "hierarchical",
  skip?: Set<string>,
  /** Rendered sizes, when the cards have been measured. Estimates overlap real cards. */
  sizes?: NodeSizes,
): Positions {
  const nodes = graph.nodes.filter((node) => !skip?.has(node.id));
  const ids = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const sizeOf = (node: CanvasGraph["nodes"][number]) => sizes?.get(node.id) ?? NODE_SIZE[node.kind];
  const horizontal = mode === "horizontal";
  const along = (size: { width: number; height: number }) => (horizontal ? size.height : size.width);
  const across = (size: { width: number; height: number }) => (horizontal ? size.width : size.height);
  const key = horizontal ? "horizontal" : "hierarchical";

  // Depth: one row below the deepest agent that points at a card.
  const depth = new Map<string, number>();
  const root = nodes.find((node) => node.kind === "agent");
  if (root) depth.set(root.id, 0);
  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false;
    for (const edge of edges) {
      const from = depth.get(edge.source);
      if (from === undefined) continue;
      if ((depth.get(edge.target) ?? -1) < from + 1) {
        depth.set(edge.target, from + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const deepest = Math.max(0, ...depth.values());
  for (const node of nodes) if (!depth.has(node.id)) depth.set(node.id, node.kind === "agent" ? 0 : deepest + 1);

  // Channels are entry points: they sit in a row above the root, fed from its top port.
  const channels = nodes.filter((node) => node.kind === "channel");
  const rows: CanvasGraph["nodes"][] = [];
  for (const node of nodes) if (node.kind !== "channel") (rows[depth.get(node.id)!] ??= []).push(node);

  const incoming = new Map<string, CanvasEdge[]>();
  for (const edge of edges) incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge]);

  const positions: Positions = {};
  let rowStart = 0;
  for (const row of rows) {
    if (!row || row.length === 0) continue;
    // Where each card would like to sit: the average position of the ports aiming at it.
    const wanted = new Map<string, number>();
    for (const node of row) {
      const anchors = (incoming.get(node.id) ?? [])
        .map((edge) => {
          const owner = byId.get(edge.source);
          const at = positions[edge.source];
          if (!owner || !at) return undefined;
          const ownerAlong = along(sizeOf(owner));
          return (horizontal ? at.y : at.x) + ownerAlong * portFraction(owner.kind, node.kind);
        })
        .filter((value): value is number => value !== undefined);
      wanted.set(node.id, anchors.length > 0 ? anchors.reduce((a, b) => a + b, 0) / anchors.length : 0);
    }
    const ordered = [...row].sort(
      (a, b) =>
        wanted.get(a.id)! - wanted.get(b.id)! ||
        PORT_ORDER.indexOf(a.kind as PortKind) - PORT_ORDER.indexOf(b.kind as PortKind) ||
        a.name.localeCompare(b.name),
    );

    // Pack in order without overlap, then slide the row so cards sit, on average, where they wanted.
    let cursor = Number.NEGATIVE_INFINITY;
    const placed = ordered.map((node) => {
      const size = along(sizeOf(node));
      const start = Math.max(wanted.get(node.id)! - size / 2, cursor);
      cursor = start + size + SIBLING_GAP[key];
      return { node, start, drift: start - (wanted.get(node.id)! - size / 2) };
    });
    const shift = placed.reduce((total, entry) => total + entry.drift, 0) / placed.length;
    for (const { node, start } of placed) {
      const offset = Math.round(start - shift);
      positions[node.id] = horizontal ? { x: rowStart, y: offset } : { x: offset, y: rowStart };
    }
    rowStart += Math.max(...row.map((node) => across(sizeOf(node)))) + ROW_GAP[key];
  }

  if (channels.length > 0) {
    const rootAt = root ? positions[root.id] : undefined;
    const rootSize = root ? sizeOf(root) : { width: 0, height: 0 };
    const center = rootAt ? (horizontal ? rootAt.y + rootSize.height / 2 : rootAt.x + rootSize.width / 2) : 0;
    const ordered = [...channels].sort((a, b) => a.name.localeCompare(b.name));
    const span = ordered.reduce((total, node) => total + along(sizeOf(node)), 0) + SIBLING_GAP[key] * (ordered.length - 1);
    const depthAt = -(Math.max(...ordered.map((node) => across(sizeOf(node)))) + ROW_GAP[key]);
    let cursor = center - span / 2;
    for (const node of ordered) {
      positions[node.id] = horizontal ? { x: depthAt, y: Math.round(cursor) } : { x: Math.round(cursor), y: depthAt };
      cursor += along(sizeOf(node)) + SIBLING_GAP[key];
    }
  }
  return positions;
}

/** The picture before anyone drags anything. */
export function fallbackPositions(graph: CanvasGraph): Positions {
  return autoLayout(graph);
}
