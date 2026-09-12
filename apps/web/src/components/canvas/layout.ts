import type { CanvasGraph, CanvasNodeKind } from "@evelab/eve-project";

export type Positions = Record<string, { x: number; y: number }>;

export const COLUMN = 264;
export const ROW = 196;

export function nodeWidth(kind: CanvasNodeKind): number {
  return kind === "agent" ? 240 : 220;
}

/**
 * Tidy tree layout, used until the user drags something.
 *
 * Children sit under the node that owns them and siblings share the width of
 * their subtree, so the default picture has no crossing edges.
 */
export function fallbackPositions(graph: CanvasGraph): Positions {
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const edge of graph.edges) {
    if (hasParent.has(edge.target)) continue;
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
    hasParent.add(edge.target);
  }

  const width = (id: string): number => {
    const kids = children.get(id) ?? [];
    if (kids.length === 0) return 1;
    return kids.reduce((total, kid) => total + width(kid), 0);
  };

  const positions: Positions = {};

  const place = (id: string, left: number, depth: number): void => {
    const span = width(id);
    positions[id] = { x: (left + span / 2 - 0.5) * COLUMN, y: depth * ROW };
    let cursor = left;
    for (const kid of children.get(id) ?? []) {
      place(kid, cursor, depth + 1);
      cursor += width(kid);
    }
  };

  const roots = graph.nodes.filter((node) => !hasParent.has(node.id));
  let cursor = 0;
  for (const root of roots) {
    place(root.id, cursor, 0);
    cursor += width(root.id);
  }

  // Anything unreachable from a root still needs somewhere to sit.
  let orphan = 0;
  for (const node of graph.nodes) {
    if (!positions[node.id]) {
      positions[node.id] = { x: orphan++ * COLUMN, y: (roots.length + 2) * ROW };
    }
  }

  return positions;
}
