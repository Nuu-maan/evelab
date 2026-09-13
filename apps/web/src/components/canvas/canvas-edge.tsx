"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  type ConnectionLineComponentProps,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";

export type OwnershipEdge = Edge<{ movable: boolean }, "ownership">;

const RADIUS = 16;
/** How far along the edge the grab dots sit, so a node's handle never covers them. */
const GRIP_OFFSET = 10;

function along(x: number, y: number, position: Position, distance: number) {
  switch (position) {
    case Position.Top:
      return { x, y: y - distance };
    case Position.Bottom:
      return { x, y: y + distance };
    case Position.Left:
      return { x: x - distance, y };
    default:
      return { x: x + distance, y };
  }
}

/**
 * An ownership edge: a rounded orthogonal path in the colour of the capability
 * it points at. Movable edges show a dot at each end on hover, which is where
 * React Flow's reconnect anchors sit, so the thing to grab is visible.
 */
function OwnershipEdgeBase({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  interactionWidth,
  data,
}: EdgeProps<OwnershipEdge>) {
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
  const movable = data?.movable ?? false;
  const start = along(sourceX, sourceY, sourcePosition, GRIP_OFFSET);
  const end = along(targetX, targetY, targetPosition, GRIP_OFFSET);

  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={interactionWidth ?? 24} />
      {movable && (
        <>
          <circle className="edge-grip" cx={start.x} cy={start.y} r={4} />
          <circle className="edge-grip" cx={end.x} cy={end.y} r={4} />
        </>
      )}
      {selected && movable && (
        <EdgeLabelRenderer>
          <div
            className="edge-label"
            // Above the path, not on it: a selected edge is raised over the label layer.
            style={{ transform: `translate(${labelX}px, ${labelY}px) translate(-50%, calc(-100% - 8px))` }}
          >
            Drag an end to reassign
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const OwnershipEdgePath = memo(OwnershipEdgeBase);

/** The line drawn while a connection is dragged: dashed until it can land, then solid. */
export function OwnershipConnectionLine({
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
      <circle cx={toX} cy={toY} r={5} />
    </g>
  );
}
