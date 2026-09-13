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

/**
 * Where a wire turns. Wires that fan out from one agent share a bus near the
 * agent; wires that fan in to a shared resource share a bus near the resource.
 * Everything else turns halfway.
 */
export type EdgeBend = "source" | "target" | "middle";

export type RelationEdgeData = {
  relation?: CanvasRelation;
  /** The kind at the arrow end, which colours the wire and its label. */
  kind?: CanvasNodeKind;
  bend?: EdgeBend;
  /** An agent using a resource, which can be undone from the edge. */
  detachable: boolean;
  showLabel?: boolean;
};

export type RelationEdge = Edge<RelationEdgeData, "relation">;

const RADIUS = 12;
/** Distance from a card to the bus its wires share. */
const BUS = 32;

/**
 * A relationship drawn as a right-angled wire in its kind's colour. Labels
 * appear only where someone is looking, and sit on the part of the wire that
 * belongs to this edge alone, never on a bus other wires share.
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
  const { mode, detachEdge } = useContext(CanvasContext);
  const horizontal = mode === "horizontal";
  // In columns, wires to a subagent share a bus under the root; everything else is a tree branch.
  const bend: EdgeBend = mode === "vertical" ? (data?.kind === "subagent" ? "source" : "middle") : (data?.bend ?? "middle");

  let centerX: number | undefined;
  let centerY: number | undefined;
  if (bend === "source") {
    if (horizontal) centerX = sourceX + BUS;
    else centerY = sourceY + BUS;
  } else if (bend === "target") {
    if (horizontal) centerX = targetX - BUS;
    else centerY = targetY - BUS;
  }

  const [path, midX, midY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: RADIUS,
    offset: 20,
    centerX,
    centerY,
  });

  // The label goes on the stub only this edge uses.
  let labelX = midX;
  let labelY = midY;
  if (bend === "source") {
    if (horizontal) labelX = (sourceX + BUS + targetX) / 2;
    else [labelX, labelY] = [targetX, (sourceY + BUS + targetY) / 2];
  } else if (bend === "target") {
    if (horizontal) labelX = (sourceX + targetX - BUS) / 2;
    else [labelX, labelY] = [sourceX, (sourceY + targetY - BUS) / 2];
  }
  if (horizontal && bend !== "middle") labelY = bend === "source" ? targetY : sourceY;

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={22} />
      {data?.showLabel && data.relation && (
        <EdgeLabelRenderer>
          <div
            className="edge-label nodrag nopan"
            data-kind={data.kind}
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
