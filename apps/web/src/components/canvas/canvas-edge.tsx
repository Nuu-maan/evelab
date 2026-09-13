"use client";

import { memo, useContext } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type ConnectionLineComponentProps,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import type { CanvasRelation } from "@evelab/eve-project";
import { CanvasContext } from "@/components/canvas/canvas-node";

export type RelationEdgeData = {
  relation?: CanvasRelation;
  /** An agent using a resource, which can be undone from the edge. */
  detachable: boolean;
  showLabel?: boolean;
};

export type RelationEdge = Edge<RelationEdgeData, "relation">;

const CURVATURE = 0.36;

/**
 * A relationship: "has tool", "contains", "routes to". A quiet hairline at
 * rest; hovering either end or the edge itself colours it and names it, and a
 * selected resource edge offers to detach.
 */
function RelationEdgeBase({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<RelationEdge>) {
  const { detachEdge } = useContext(CanvasContext);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: CURVATURE,
  });

  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={20} />
      <path className="edge-flow" d={path} aria-hidden="true" />
      {data?.showLabel && data.relation && (
        <EdgeLabelRenderer>
          <div
            className="edge-label nodrag nopan"
            data-actionable={(selected && data.detachable) || undefined}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <span>{data.relation}</span>
            {selected && data.detachable && (
              <button type="button" className="edge-label-action" onClick={() => detachEdge(source, target)}>
                Detach
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const RelationEdgePath = memo(RelationEdgeBase);

/** The line drawn while attaching: dashed until it can land, then solid. */
export function CanvasConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionStatus,
}: ConnectionLineComponentProps) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
    curvature: CURVATURE,
  });

  return (
    <g className="connection-line" data-status={connectionStatus ?? undefined}>
      <path d={path} />
      <circle cx={toX} cy={toY} r={4} />
    </g>
  );
}
