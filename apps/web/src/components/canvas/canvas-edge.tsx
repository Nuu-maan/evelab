"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  type ConnectionLineComponentProps,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";

export type OwnershipEdge = Edge<{ movable: boolean }, "ownership">;

const CURVATURE = 0.32;
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
 * An ownership edge: a soft curve from owner to capability. At rest it is a
 * quiet hairline; hover or selection colours it with the capability's kind and
 * runs a slow flow along it from owner to capability, which is the direction
 * ownership reads in. Movable edges show a dot at each end where React Flow's
 * reconnect anchors sit, so the thing to grab is visible.
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
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: CURVATURE,
  });
  const movable = data?.movable ?? false;
  const start = along(sourceX, sourceY, sourcePosition, GRIP_OFFSET);
  const end = along(targetX, targetY, targetPosition, GRIP_OFFSET);

  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={interactionWidth ?? 24} />
      <path className="edge-flow" d={path} aria-hidden="true" />
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
            style={{ transform: `translate(${labelX}px, ${labelY}px) translate(-50%, calc(-100% - 10px))` }}
          >
            Drag an end onto another agent
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
      <circle cx={toX} cy={toY} r={5} />
    </g>
  );
}
