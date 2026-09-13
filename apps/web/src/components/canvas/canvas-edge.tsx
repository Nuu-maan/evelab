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
import type { CanvasNodeKind, CanvasRelation } from "@evelab/eve-project";
import { CanvasContext } from "@/components/canvas/canvas-node";
import { PORT_ORDER, type PortKind } from "@/components/canvas/layout";

/** Wires into a resource several agents share merge just above it; everything else turns near its port. */
export type EdgeBend = "source" | "target" | "middle";

export type RelationEdgeData = {
  relation?: CanvasRelation;
  /** The kind at the far end, which is also the port the wire leaves from. */
  kind?: CanvasNodeKind;
  bend?: EdgeBend;
  /** An agent using a resource, which can be undone from the edge. */
  detachable: boolean;
  showLabel?: boolean;
};

export type RelationEdge = Edge<RelationEdgeData, "relation">;

const RADIUS = 10;
/** First turn below a port, and how much further each port to the right turns, so buses never overlap. */
const TURN = 22;
const PORT_STEP = 8;

/**
 * A wire from an agent's port to what it uses: right angles in the port's
 * colour, no arrowhead, since the port already says which way it runs. The
 * label is a small tag beside the far end that fades in only while the wire is
 * hovered or selected.
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
  const { mode, detachEdge } = useContext(CanvasContext);
  const horizontal = mode === "horizontal";
  const port = Math.max(0, PORT_ORDER.indexOf(data?.kind as PortKind));

  const channel = data?.kind === "channel";
  let centerX: number | undefined;
  let centerY: number | undefined;
  if (channel) {
    // Channels fan out above the root from its top port.
    if (horizontal) centerX = sourceX - TURN;
    else centerY = sourceY - TURN;
  } else if (data?.bend === "target") {
    if (horizontal) centerX = targetX - TURN;
    else centerY = targetY - TURN;
  } else if (horizontal) {
    centerX = sourceX + TURN + port * PORT_STEP;
  } else {
    centerY = sourceY + TURN + port * PORT_STEP;
  }

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: RADIUS,
    offset: 16,
    centerX,
    centerY,
  });

  const labelTransform = channel
    ? horizontal
      ? `translate(0, -50%) translate(${targetX + 12}px, ${targetY}px)`
      : `translate(-50%, 0) translate(${targetX}px, ${targetY + 10}px)`
    : horizontal
      ? `translate(-100%, -50%) translate(${targetX - 12}px, ${targetY}px)`
      : `translate(-50%, -100%) translate(${targetX}px, ${targetY - 10}px)`;

  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={18} />
      {data?.showLabel && data.relation && (
        <EdgeLabelRenderer>
          <div className="edge-label-anchor nodrag nopan" style={{ transform: labelTransform }}>
            <div className="edge-label" data-kind={data.kind} data-actionable={(selected && data.detachable) || undefined}>
              <span>{data.relation}</span>
              {selected && data.detachable && (
                <button type="button" className="edge-label-action" onClick={() => detachEdge(source, target)}>
                  Detach
                </button>
              )}
            </div>
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
