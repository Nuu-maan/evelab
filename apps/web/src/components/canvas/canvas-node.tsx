"use client";

import { memo } from "react";
import { Handle, Position, useConnection, type Node, type NodeProps } from "@xyflow/react";
import type { CanvasNodeKind } from "@evelab/eve-project";
import { FileIcon } from "@/components/files/file-icon";
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

function CanvasNodeCardBase({ id, data, selected }: NodeProps<CapabilityNode>) {
  const owns = data.kind === "agent" || data.kind === "subagent";
  // Both selectors return booleans, so a drag re-renders a node twice, not on every frame.
  const receiving = useConnection((connection) => owns && connection.inProgress);
  const targeted = useConnection(
    (connection) => connection.inProgress && connection.toNode?.id === id,
  );
  const fileName = data.filePath.slice(data.filePath.lastIndexOf("/") + 1);

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
        <Handle
          className="node-handle"
          type="target"
          position={Position.Top}
          isConnectableStart={false}
        />
      )}
      <div className="node-body">
        <div className="node-head">
          <KindTile kind={data.kind} />
          <span className="node-kind">{KINDS[data.kind].label}</span>
        </div>
        <p className="node-name" title={data.name}>
          {data.name}
        </p>
        <p className="node-meta">{data.detail}</p>
      </div>
      <div className="node-foot">
        <FileIcon name={fileName} />
        <span className="node-path mono">{data.filePath}</span>
      </div>
      {owns && <Handle className="node-handle" type="source" position={Position.Bottom} />}
    </div>
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardBase);
