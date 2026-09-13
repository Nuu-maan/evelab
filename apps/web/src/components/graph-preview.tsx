import type { CanvasGraph, CanvasNode } from "@evelab/eve-project";
import { fallbackPositions, NODE_SIZE, type Positions } from "@/components/canvas/layout";
import { KINDS } from "@/components/kinds";
import "@/app/graph-preview.css";

const PADDING = 48;
const HEIGHT = 112;
/** Distance from a card to the bus its wires share, as on the canvas. */
const BUS = 32;

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function reading(node: CanvasNode): string {
  const counts = node.counts;
  const resources = counts ? counts.tools + counts.skills + counts.connections : 0;
  if (node.kind === "agent") return `${counts?.subagents ?? 0} SUBAGENTS · ${resources} RESOURCES`;
  if (node.kind === "subagent") return `${resources} ${resources === 1 ? "RESOURCE" : "RESOURCES"}`;
  if (node.kind === "channel") return `/${node.name.toUpperCase()} ROUTE`;
  const users = node.usedBy?.length ?? 0;
  return `${users} ${users === 1 ? "AGENT" : "AGENTS"}${node.shared ? " · SHARED" : ""}`;
}

/**
 * A static drawing of the canvas, rendered on the server: the same tinted
 * cards and right-angled wires, at the positions the user arranged. Used on
 * the project overview and as the picture on each project card.
 */
export function GraphPreview({
  graph,
  positions,
  className,
}: {
  graph: CanvasGraph;
  positions: Positions;
  className?: string;
}) {
  const layout = { ...fallbackPositions(graph), ...positions };
  const placed = new Map(graph.nodes.map((node) => [node.id, { node, ...(layout[node.id] ?? { x: 0, y: 0 }) }]));
  const width = (node: CanvasNode) => NODE_SIZE[node.kind].width;

  const boxes = [...placed.values()];
  const minX = Math.min(...boxes.map((box) => box.x)) - PADDING;
  const minY = Math.min(...boxes.map((box) => box.y)) - PADDING;
  const maxX = Math.max(...boxes.map((box) => box.x + width(box.node))) + PADDING;
  const maxY = Math.max(...boxes.map((box) => box.y + HEIGHT)) + PADDING;

  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const edge of graph.edges) {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
  }

  return (
    <svg
      className={["graph-preview", className].filter(Boolean).join(" ")}
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Architecture with ${graph.nodes.length} ${graph.nodes.length === 1 ? "card" : "cards"}`}
    >
      {graph.edges.map((edge) => {
        const source = placed.get(edge.source);
        const target = placed.get(edge.target);
        if (!source || !target) return null;
        const sx = source.x + width(source.node) / 2;
        const sy = source.y + HEIGHT;
        const tx = target.x + width(target.node) / 2;
        const ty = target.y;
        const bus =
          (incoming.get(edge.target) ?? 0) > 1
            ? ty - BUS
            : (outgoing.get(edge.source) ?? 0) > 1
              ? sy + BUS
              : (sy + ty) / 2;
        const structure = edge.relation === "contains" || edge.relation === "routes to";
        return (
          <path
            key={`${edge.source}->${edge.target}`}
            className="graph-preview-edge"
            data-kind={target.node.kind}
            data-structure={structure || undefined}
            d={ty > sy ? `M ${sx} ${sy} V ${bus} H ${tx} V ${ty}` : `M ${sx} ${sy} L ${tx} ${ty}`}
          />
        );
      })}

      {boxes.map(({ node, x, y }) => {
        const w = width(node);
        return (
          <g key={node.id} className="graph-preview-node" data-kind={node.kind} data-tier={node.kind === "agent" ? "root" : undefined}>
            <rect className="graph-preview-card" x={x} y={y} width={w} height={HEIGHT} rx={10} />
            <rect className="graph-preview-mark" x={x + 14} y={y + 16} width={10} height={10} rx={2.5} />
            <text className="graph-preview-name" x={x + 32} y={y + 26}>
              {truncate(node.name, Math.floor(w / 11))}
            </text>
            {node.shared && (
              <text className="graph-preview-badge" x={x + w - 14} y={y + 25} textAnchor="end">
                SHARED
              </text>
            )}
            <line className="graph-preview-rule" x1={x + 14} x2={x + w - 14} y1={y + 42} y2={y + 42} />
            <text className="graph-preview-reading" x={x + 14} y={y + 68}>
              {reading(node)}
            </text>
            <text className="graph-preview-detail" x={x + 14} y={y + 92}>
              {truncate(node.kind === "agent" || node.kind === "subagent" ? node.detail : KINDS[node.kind].label, Math.floor(w / 8))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
