import type { CanvasGraph } from "@evelab/eve-project";
import { fallbackPositions, nodeWidth, type Positions } from "@/components/canvas/layout";
import { KINDS } from "@/components/kinds";

const NODE_HEIGHT = 84;
const PADDING = 64;

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

/**
 * A static drawing of the canvas, rendered on the server. It uses the same
 * saved positions as the canvas, so the overview shows the picture the user
 * arranged rather than a generic one.
 */
export function GraphPreview({ graph, positions }: { graph: CanvasGraph; positions: Positions }) {
  const layout = { ...fallbackPositions(graph), ...positions };
  const placed = new Map(
    graph.nodes.map((node) => [node.id, { node, ...(layout[node.id] ?? { x: 0, y: 0 }) }]),
  );

  const boxes = [...placed.values()];
  const minX = Math.min(...boxes.map((box) => box.x)) - PADDING;
  const minY = Math.min(...boxes.map((box) => box.y)) - PADDING;
  const maxX = Math.max(...boxes.map((box) => box.x + nodeWidth(box.node.kind))) + PADDING;
  const maxY = Math.max(...boxes.map((box) => box.y + NODE_HEIGHT)) + PADDING;

  return (
    <svg
      className="graph-preview"
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Canvas with ${graph.nodes.length} ${graph.nodes.length === 1 ? "node" : "nodes"}`}
    >
      {graph.edges.map((edge) => {
        const source = placed.get(edge.source);
        const target = placed.get(edge.target);
        if (!source || !target) return null;
        const sx = source.x + nodeWidth(source.node.kind) / 2;
        const sy = source.y + NODE_HEIGHT;
        const tx = target.x + nodeWidth(target.node.kind) / 2;
        const ty = target.y;
        const mid = (sy + ty) / 2;
        return (
          <path
            key={`${edge.source}->${edge.target}`}
            className="graph-preview-edge"
            data-kind={target.node.kind}
            d={`M ${sx} ${sy} C ${sx} ${mid}, ${tx} ${mid}, ${tx} ${ty}`}
          />
        );
      })}

      {boxes.map(({ node, x, y }) => (
        <g key={node.id} className="graph-preview-node" data-kind={node.kind}>
          <rect className="graph-preview-card" x={x} y={y} width={nodeWidth(node.kind)} height={NODE_HEIGHT} rx={12} />
          <rect className="graph-preview-tile" x={x + 14} y={y + 14} width={22} height={22} rx={6} />
          <text className="graph-preview-kind" x={x + 46} y={y + 30}>
            {KINDS[node.kind].label}
          </text>
          <text className="graph-preview-name" x={x + 14} y={y + 64}>
            {truncate(node.name, 20)}
          </text>
        </g>
      ))}
    </svg>
  );
}
