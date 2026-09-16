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

/** Where a node's wires leave from and arrive at, in canvas coordinates. */
function anchors(node: CanvasNode, x: number, y: number) {
  const width = NODE_SIZE[node.kind].width;
  const centre = x + width / 2;
  const height = isAgent(node) ? CARD : TILE;
  return { top: { x: centre, y }, bottom: { x: centre, y: y + height } };
}

type Placed = { node: CanvasNode; x: number; y: number };

/** Thumbnails share one shape and a scale range, so a big project is cropped around its root rather than shrunk to a line. */
const THUMB_ASPECT = 2;
const THUMB_MIN_WIDTH = 640;
const THUMB_MAX_WIDTH = 900;

function frame(boxes: Placed[], bounds: { minX: number; minY: number; maxX: number; maxY: number }): string {
  const { minX, minY, maxX, maxY } = bounds;
  let width = Math.min(Math.max(maxX - minX, THUMB_MIN_WIDTH), THUMB_MAX_WIDTH);
  if ((maxY - minY) * THUMB_ASPECT > width) width = Math.min((maxY - minY) * THUMB_ASPECT, THUMB_MAX_WIDTH);
  const height = width / THUMB_ASPECT;
  const root = boxes.find((box) => box.node.kind === "agent") ?? boxes[0];
  if (!root) return `${minX} ${minY} ${width} ${height}`;
  // Whatever fits is centred; whatever does not is centred on the root, without showing empty space past the edges.
  const centre = (low: number, high: number, size: number, focus: number) =>
    high - low <= size ? (low + high) / 2 : Math.min(Math.max(focus, low + size / 2), high - size / 2);
  const x = centre(minX, maxX, width, root.x + NODE_SIZE[root.node.kind].width / 2);
  const y = centre(minY, maxY, height, root.y + CARD / 2);
  return `${x - width / 2} ${y - height / 2} ${width} ${height}`;
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
 * at the positions the user arranged. Used on the project overview and as the
 * picture on each project card.
 */
export function GraphPreview({
  graph,
  positions,
  className,
  thumbnail = false,
}: {
  graph: CanvasGraph;
  positions: Positions;
  className?: string;
  /** Frames the root agent at a readable scale instead of fitting everything, and draws names as bars. */
  thumbnail?: boolean;
}) {
  const layout = { ...fallbackPositions(graph), ...positions };
  const placed = new Map(graph.nodes.map((node) => [node.id, { node, ...(layout[node.id] ?? { x: 0, y: 0 }) }]));
  const boxes = [...placed.values()];
  const minX = Math.min(...boxes.map((box) => box.x)) - PADDING;
  const minY = Math.min(...boxes.map((box) => box.y)) - PADDING;
  const maxX = Math.max(...boxes.map((box) => box.x + NODE_SIZE[box.node.kind].width)) + PADDING;
  const maxY = Math.max(...boxes.map((box) => box.y + (isAgent(box.node) ? CARD : TILE + 28))) + PADDING;
  const viewBox = thumbnail ? frame(boxes, { minX, minY, maxX, maxY }) : `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;

  return (
    <svg
      className={["graph-preview", thumbnail && "graph-preview-thumbnail", className].filter(Boolean).join(" ")}
      viewBox={viewBox}
      preserveAspectRatio={thumbnail ? "xMidYMid slice" : "xMidYMid meet"}
      role="img"
      aria-label={`Architecture with ${graph.nodes.length} ${graph.nodes.length === 1 ? "node" : "nodes"}`}
    >
      {graph.edges.map((edge) => {
        const source = placed.get(edge.source);
        const target = placed.get(edge.target);
        if (!source || !target) return null;
        const from = anchors(source.node, source.x, source.y);
        const to = anchors(target.node, target.x, target.y);
        // Channels sit above the root: their wires leave its top and arrive at their bottom.
        const channel = target.node.kind === "channel";
        const start = channel ? from.top : from.bottom;
        const end = channel ? to.bottom : to.top;
        const bend = Math.max(24, Math.abs(end.y - start.y) / 2) * (channel ? -1 : 1);
        const structure = edge.relation === "contains" || edge.relation === "routes to";
        return (
          <path
            key={`${edge.source}->${edge.target}`}
            className="graph-preview-edge"
            data-kind={target.node.kind}
            data-structure={structure || undefined}
            d={`M ${start.x} ${start.y} C ${start.x} ${start.y + bend}, ${end.x} ${end.y - bend}, ${end.x} ${end.y}`}
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
              {thumbnail ? (
                <rect
                  className="graph-preview-bar"
                  x={x + 66}
                  y={y + 25}
                  width={Math.min(width - 90, 40 + node.name.length * 6)}
                  height={14}
                  rx={7}
                />
              ) : (
                <text className="graph-preview-name" x={x + 66} y={y + 38}>
                  {truncate(node.name, Math.floor((width - 80) / 9))}
                </text>
              )}
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
            {!thumbnail && (
              <text className="graph-preview-label" x={centre} y={y + TILE + 22} textAnchor="middle">
                {truncate(node.name, 14)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
