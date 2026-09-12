"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { CanvasNodeKind } from "@evelab/eve-project";

export type CanvasNodeData = {
  name: string;
  detail: string;
  filePath: string;
  kind: CanvasNodeKind;
  selected: boolean;
};

const KIND_LABEL: Record<CanvasNodeKind, string> = {
  agent: "Agent",
  subagent: "Subagent",
  tool: "Tool",
  skill: "Skill",
};

export function CanvasNodeCard({ data }: NodeProps<Node<CanvasNodeData>>) {
  return (
    <div className="node" data-kind={data.kind} data-selected={data.selected}>
      {data.kind !== "agent" && <Handle type="target" position={Position.Top} />}
      <div className="node-head">
        <span className="node-kind">{KIND_LABEL[data.kind]}</span>
      </div>
      <p className="node-name" title={data.name}>
        {data.name}
      </p>
      <p className="node-meta">{data.detail}</p>
      <p className="node-meta mono">{data.filePath}</p>
      {(data.kind === "agent" || data.kind === "subagent") && (
        <Handle type="source" position={Position.Bottom} />
      )}
    </div>
  );
}
