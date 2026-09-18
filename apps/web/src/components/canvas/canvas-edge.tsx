"use client";

import { memo, useContext } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useStore,
  type ConnectionLineComponentProps,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import type { CanvasNodeKind, CanvasRelation } from "@evelab/eve-project";
import { CanvasContext } from "@/components/canvas/canvas-node";
import { Icon } from "@/components/icon";
import { IconCross } from "@/components/icons";
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
  /** The one wire into its target allowed to draw a label there; the rest would stack on top of it. */
  labelOwner?: boolean;
};

export type RelationEdge = Edge<RelationEdgeData, "relation">;

/** The zoom at which cards are big enough to read, so every wire names itself. */
export const READABLE_ZOOM = 0.7;

const RADIUS = 10;
/** First turn below a port, and how much further each port to the right turns, so buses never overlap. */
const TURN = 22;
const PORT_STEP = 8;

/**
 * A wire from an agent's port to what it uses, curved, elbowed or straight as
 * chosen, in the port's colour, no arrowhead, since the port already says which way it runs. The
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
  const { mode, wireStyle, detachEdge } = useContext(CanvasContext);
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

  const [path] =
    wireStyle === "straight"
      ? getStraightPath({ sourceX, sourceY, targetX, targetY })
      : wireStyle === "curved"
        ? getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, curvature: 0.35 })
        : getSmoothStepPath({
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

  // Far enough from the end that the label, and the Detach button it grows when selected, never reaches the card.
  // A channel's name and kind sit under its tile, right where the wire leaves, so its label waits halfway along instead.
  const labelTransform = channel
    ? `translate(-50%, -50%) translate(${(sourceX + targetX) / 2}px, ${(sourceY + targetY) / 2}px)`
    : horizontal
      ? `translate(-100%, -50%) translate(${targetX - 24}px, ${targetY}px)`
      : `translate(-50%, -100%) translate(${targetX}px, ${targetY - 22}px)`;
  const active = Boolean(data?.showLabel);
  // A wire being looked at keeps its label and Detach button at full size however far out the board is zoomed,
  // so the button stays something you can click. Other wires never subscribe to the zoom.
  const lift = useStore((state) => (selected || active ? Math.min(3, Math.max(1, 1 / state.transform[2])) : 1));

  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={18} />
      {/* Every channel says "routes to", so those labels only show on the wire being looked at. */}
      {data?.relation && data.labelOwner !== false && (active || selected || !channel) && (
        <EdgeLabelRenderer>
          <div
            className="edge-label-anchor nodrag nopan"
            // Once cards are big enough to read, every wire names itself; zoomed out, only the one being looked at does.
            // The rest stay mounted and hide from CSS, so crossing that zoom never mounts a label per wire mid-gesture.
            data-quiet={!(active || selected) || undefined}
            style={{
              transform: lift > 1 ? `${labelTransform} scale(${lift})` : labelTransform,
              // Grow away from the card the label points at, never into it.
              transformOrigin: channel ? "50% 50%" : horizontal ? "100% 50%" : "50% 100%",
            }}
            data-actionable={(selected && data.detachable) || undefined}
          >
            <div className="edge-label" data-kind={data.kind} data-active={active || undefined}>
              <span className="edge-label-text">{data.relation}</span>
            </div>
            {selected && data.detachable && (
              <button
                type="button"
                className="edge-label-action"
                aria-label={`Detach ${target}`}
                onClick={() => detachEdge(source, target)}
              >
                <Icon icon={IconCross} size={12} />
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
  const { wireStyle } = useContext(CanvasContext);
  const ends = { sourceX: fromX, sourceY: fromY, sourcePosition: fromPosition, targetX: toX, targetY: toY, targetPosition: toPosition };
  const [path] =
    wireStyle === "straight"
      ? getStraightPath(ends)
      : wireStyle === "curved"
        ? getBezierPath({ ...ends, curvature: 0.35 })
        : getSmoothStepPath({ ...ends, borderRadius: RADIUS });

  return (
    <g className="connection-line" data-status={connectionStatus ?? undefined}>
      <path d={path} />
      <circle cx={toX} cy={toY} r={4} />
    </g>
  );
}
