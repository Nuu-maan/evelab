import { createElement } from "react";
import type { CanvasGraph, CanvasNode } from "@evelab/eve-project";
import { fallbackPositions, NODE_SIZE, type Positions } from "@/components/canvas/layout";
import { KINDS } from "@/components/kinds";
import "@/app/graph-preview.css";

const PADDING = 40;
/** An agent card's height, and a resource or channel tile's size, as the canvas draws them. */
const CARD = 64;
const TILE = 64;

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function isAgent(node: CanvasNode): boolean {
  return node.kind === "agent" || node.kind === "subagent";
}

/** Where a node's wires can leave from and arrive at, in canvas coordinates. */
function anchors(node: CanvasNode, x: number, y: number) {
  const width = NODE_SIZE[node.kind].width;
  const centre = x + width / 2;
  const height = isAgent(node) ? CARD : TILE;
  // Resource and channel tiles are drawn centred in their slot, narrower than it.
  const half = isAgent(node) ? width / 2 : TILE / 2;
  const middle = y + height / 2;
  return {
    top: { x: centre, y },
    bottom: { x: centre, y: y + height },
    left: { x: centre - half, y: middle },
    right: { x: centre + half, y: middle },
  };
}

type Point = { x: number; y: number };

/**
 * One wire, drawn the way the canvas draws it in the current layout. A target
 * that sits mostly beside its source is joined side to side, as the horizontal
 * layout does; anything else runs top to bottom. Freeform layouts get whichever
 * reads better for each pair.
 */
function wire(from: ReturnType<typeof anchors>, to: ReturnType<typeof anchors>): string {
  const dx = to.left.x - from.right.x;
  const dy = to.top.y - from.bottom.y;
  const across = Math.abs(from.top.x - to.top.x) > Math.abs(from.left.y - to.left.y);
  let start: Point;
  let end: Point;
  if (across) {
    const forward = dx >= 0 || to.right.x > from.right.x;
    start = forward ? from.right : from.left;
    end = forward ? to.left : to.right;
    const bend = Math.max(24, Math.abs(end.x - start.x) / 2) * (forward ? 1 : -1);
    return `M ${start.x} ${start.y} C ${start.x + bend} ${start.y}, ${end.x - bend} ${end.y}, ${end.x} ${end.y}`;
  }
  const down = dy >= 0 || to.bottom.y > from.bottom.y;
  start = down ? from.bottom : from.top;
  end = down ? to.top : to.bottom;
  const bend = Math.max(24, Math.abs(end.y - start.y) / 2) * (down ? 1 : -1);
  return `M ${start.x} ${start.y} C ${start.x} ${start.y + bend}, ${end.x} ${end.y - bend}, ${end.x} ${end.y}`;
}

function KindGlyph({ node, x, y, size }: { node: CanvasNode; x: number; y: number; size: number }) {
  return (
    <svg
      className="graph-preview-glyph"
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {KINDS[node.kind].icon.nodes.map(([tag, attributes], index) => createElement(tag, { key: index, ...attributes }))}
    </svg>
  );
}

/**
 * A static drawing of the canvas, rendered on the server, in the canvas's own
 * shapes: agents as cards with an icon and a name, tools, skills and
 * connections as round tiles, channels as square ones, joined by curved wires
 * at the positions the user arranged. Used on the project overview.
 */
export function GraphPreview({ graph, positions, className }: { graph: CanvasGraph; positions: Positions; className?: string }) {
  const layout = { ...fallbackPositions(graph), ...positions };
  const placed = new Map(graph.nodes.map((node) => [node.id, { node, ...(layout[node.id] ?? { x: 0, y: 0 }) }]));
  const boxes = [...placed.values()];
  const minX = Math.min(...boxes.map((box) => box.x)) - PADDING;
  const minY = Math.min(...boxes.map((box) => box.y)) - PADDING;
  const maxX = Math.max(...boxes.map((box) => box.x + NODE_SIZE[box.node.kind].width)) + PADDING;
  const maxY = Math.max(...boxes.map((box) => box.y + (isAgent(box.node) ? CARD : TILE + 28))) + PADDING;

  return (
    <svg
      className={["graph-preview", className].filter(Boolean).join(" ")}
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Architecture with ${graph.nodes.length} ${graph.nodes.length === 1 ? "node" : "nodes"}`}
    >
      {graph.edges.map((edge) => {
        const source = placed.get(edge.source);
        const target = placed.get(edge.target);
        if (!source || !target) return null;
        const from = anchors(source.node, source.x, source.y);
        const to = anchors(target.node, target.x, target.y);
        const structure = edge.relation === "contains" || edge.relation === "routes to";
        return (
          <path
            key={`${edge.source}->${edge.target}`}
            className="graph-preview-edge"
            data-kind={target.node.kind}
            data-structure={structure || undefined}
            d={wire(from, to)}
          />
        );
      })}

      {boxes.map(({ node, x, y }) => {
        const width = NODE_SIZE[node.kind].width;
        const tier = node.kind === "agent" ? "root" : isAgent(node) ? "agent" : node.kind === "channel" ? "channel" : "resource";
        if (isAgent(node)) {
          return (
            <g key={node.id} className="graph-preview-node" data-kind={node.kind} data-tier={tier}>
              <rect className="graph-preview-card" x={x} y={y} width={width} height={CARD} rx={14} />
              <rect className="graph-preview-tile" x={x + 12} y={y + 12} width={40} height={40} rx={11} />
              <KindGlyph node={node} x={x + 22} y={y + 22} size={20} />
              <text className="graph-preview-name" x={x + 66} y={y + 38}>
                {truncate(node.name, Math.floor((width - 80) / 9))}
              </text>
            </g>
          );
        }
        const centre = x + width / 2;
        const left = centre - TILE / 2;
        return (
          <g key={node.id} className="graph-preview-node" data-kind={node.kind} data-tier={tier}>
            <rect
              className="graph-preview-card"
              x={left}
              y={y}
              width={TILE}
              height={TILE}
              rx={tier === "resource" ? TILE / 2 : 18}
            />
            <KindGlyph node={node} x={centre - 12} y={y + TILE / 2 - 12} size={24} />
            <text className="graph-preview-label" x={centre} y={y + TILE + 22} textAnchor="middle">
              {truncate(node.name, 14)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
