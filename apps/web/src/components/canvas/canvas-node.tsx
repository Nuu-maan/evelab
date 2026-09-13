"use client";

import { memo } from "react";
import { Handle, Position, useConnection, type Node, type NodeProps } from "@xyflow/react";
import type { CanvasNodeKind, CapabilityCounts } from "@evelab/eve-project";
import { FileIcon } from "@/components/files/file-icon";
import { Icon } from "@/components/icon";
import { KINDS, KindCount } from "@/components/kinds";

export type CanvasNodeData = {
  name: string;
  detail: string;
  description?: string;
  counts?: CapabilityCounts;
  filePath: string;
  kind: CanvasNodeKind;
  /** Created while the canvas was open, so it gets an entrance. */
  fresh: boolean;
};

export type CapabilityNode = Node<CanvasNodeData, "capability">;

const COUNT_KINDS = [
  ["tool", "tools"],
  ["skill", "skills"],
  ["subagent", "subagents"],
  ["connection", "connections"],
] as const;

/**
 * A capability as a card: what it is, what it does, and the file behind it.
 * Colour lives in the icon tile and the selection ring; the card itself stays
 * neutral, so a canvas full of nodes reads as calm rather than loud.
 */
function CanvasNodeCardBase({ id, data, selected }: NodeProps<CapabilityNode>) {
  const owns = data.kind === "agent" || data.kind === "subagent";
  // Both selectors return booleans, so a drag re-renders a node twice, not on every frame.
  const receiving = useConnection((connection) => owns && connection.inProgress);
  const targeted = useConnection((connection) => connection.inProgress && connection.toNode?.id === id);
  const fileName = data.filePath.slice(data.filePath.lastIndexOf("/") + 1);
  const counts = data.counts ? COUNT_KINDS.filter(([, key]) => data.counts![key] > 0) : [];

  return (
    <div
      className="node"
      data-kind={data.kind}
      data-selected={selected || undefined}
      data-fresh={data.fresh || undefined}
      data-receiving={receiving || undefined}
      data-targeted={targeted || undefined}
    >
      {data.kind !== "agent" && (
        <Handle className="node-handle" type="target" position={Position.Top} isConnectableStart={false} />
      )}

      <div className="node-head">
        <span className="node-tile" aria-hidden="true">
          <Icon icon={KINDS[data.kind].icon} size={16} />
        </span>
        <div className="node-titles">
          <p className="node-name" title={data.name}>
            {data.name}
          </p>
          <p className="node-detail" title={data.detail}>
            {data.detail}
          </p>
        </div>
        <span className="node-badge">{KINDS[data.kind].label}</span>
      </div>

      {data.description && (
        <p className="node-description" title={data.description}>
          {data.description}
        </p>
      )}

      {counts.length > 0 && (
        <div className="node-counts">
          {counts.map(([kind, key]) => (
            <KindCount key={kind} kind={kind} count={data.counts![key]} />
          ))}
        </div>
      )}

      <div className="node-foot">
        <FileIcon name={fileName} />
        <span className="node-path mono">{data.filePath}</span>
      </div>

      {owns && <Handle className="node-handle" type="source" position={Position.Bottom} />}
    </div>
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardBase);
