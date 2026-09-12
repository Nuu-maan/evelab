"use client";

import { useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ProjectGraph } from "@evelab/eve-project";

/** The canvas answers one question: who can invoke whom? */
type AgentNodeData = {
  name: string;
  model?: string;
  toolCount: number;
  skillCount: number;
  kind: "agent" | "subagent";
};

function AgentNode({ data }: NodeProps<Node<AgentNodeData>>) {
  return (
    <div className="node" data-kind={data.kind}>
      {data.kind === "subagent" && <Handle type="target" position={Position.Top} />}
      <p className="node-name">{data.name}</p>
      <p className="node-meta">{data.model ?? "Inherits model"}</p>
      <p className="node-meta">
        {data.toolCount} tools · {data.skillCount} skills
      </p>
      {data.kind === "agent" && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}

const nodeTypes = { agent: AgentNode };

export function SubagentGraph({
  graph,
  onSelect,
}: {
  graph: ProjectGraph;
  onSelect?: (id: string) => void;
}) {
  const nodes = useMemo<Node<AgentNodeData>[]>(() => {
    const subagents = graph.nodes.filter((node) => node.kind === "subagent");
    const width = 240;
    const offset = ((subagents.length - 1) * width) / 2;
    let index = 0;

    return graph.nodes.map((node) => {
      const position =
        node.kind === "agent"
          ? { x: 0, y: 0 }
          : { x: index++ * width - offset, y: 160 };
      return {
        id: node.id,
        type: "agent",
        position,
        data: {
          name: node.name,
          model: node.model,
          toolCount: node.toolCount,
          skillCount: node.skillCount,
          kind: node.kind,
        },
      };
    });
  }, [graph]);

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => ({
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
      })),
    [graph],
  );

  return (
    <div className="graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: false }}
        onNodeClick={(_, node) => onSelect?.(node.id)}
      >
        <Background gap={20} size={1} color="var(--border-strong)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
