"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { CanvasNodeKind } from "@evelab/eve-project";
import { KINDS, KindTile } from "@/components/kinds";

export type CanvasNodeData = {
  name: string;
  detail: string;
  filePath: string;
  kind: CanvasNodeKind;
  /** Created while the canvas was open, so it gets an entrance. */
  fresh: boolean;
};

export type CapabilityNode = Node<CanvasNodeData, "capability">;

function CanvasNodeCardBase({ data, selected }: NodeProps<CapabilityNode>) {
  const owns = data.kind === "agent" || data.kind === "subagent";

  return (
    <div
      className="node"
      data-kind={data.kind}
      data-selected={selected || undefined}
      data-fresh={data.fresh || undefined}
    >
      {data.kind !== "agent" && (
        <Handle
          className="node-handle"
          type="target"
          position={Position.Top}
          isConnectableStart={false}
        />
      )}
      <div className="node-head">
        <KindTile kind={data.kind} />
        <span className="node-kind">{KINDS[data.kind].label}</span>
      </div>
      <p className="node-name" title={data.name}>
        {data.name}
      </p>
      <p className="node-meta">{data.detail}</p>
      <p className="node-path mono">{data.filePath}</p>
      {owns && <Handle className="node-handle" type="source" position={Position.Bottom} />}
    </div>
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardBase);
