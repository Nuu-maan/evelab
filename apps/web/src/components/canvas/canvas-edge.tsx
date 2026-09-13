"use client";

import { memo, useContext } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
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

const RADIUS = 14;

/**
 * A relationship drawn the way a systems diagram draws a wire: right angles
 * with rounded corners, a dashed line, and what it means written beside it.
 * Hovering either end runs the dashes from agent to what it uses.
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
  markerEnd,
  data,
}: EdgeProps<RelationEdge>) {
  const { detachEdge } = useContext(CanvasContext);
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: RADIUS,
    offset: 24,
  });

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={20} />
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
  const [path] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
    borderRadius: RADIUS,
  });

  return (
    <g className="connection-line" data-status={connectionStatus ?? undefined}>
      <path d={path} />
      <circle cx={toX} cy={toY} r={4} />
    </g>
  );
}
