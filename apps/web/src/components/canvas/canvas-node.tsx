"use client";

import { createContext, memo, useContext } from "react";
import { Handle, Position, useConnection, type Node, type NodeProps } from "@xyflow/react";
import type { CanvasNodeKind, CapabilityCounts } from "@evelab/eve-project";
import { IconChevronDown, IconChevronRight, IconUsers } from "@/components/icons";
import { Icon } from "@/components/icon";
import { KINDS, KindCount } from "@/components/kinds";

export type CanvasNodeData = {
  name: string;
  detail: string;
  description?: string;
  counts?: CapabilityCounts;
  filePath: string;
  kind: CanvasNodeKind;
  /** A canonical definition in `lib/` that agents re-export. */
  shared?: boolean;
  /** How many agents use this resource. */
  usedBy?: number;
  /** Its subagents and resources are folded away. */
  collapsed?: boolean;
  /** How many nodes the fold hides. */
  hiddenCount?: number;
  /** Created while the canvas was open, so it gets an entrance. */
  fresh: boolean;
};

export type CapabilityNode = Node<CanvasNodeData, "capability">;

export interface CanvasContextValue {
  horizontal: boolean;
  /** Whether an agent already uses a resource, so a drag can show where it may land. */
  uses: (agentId: string, resourceId: string) => boolean;
  toggleCollapse: (agentId: string) => void;
  detachEdge: (agentId: string, resourceId: string) => void;
}

export const CanvasContext = createContext<CanvasContextValue>({
  horizontal: false,
  uses: () => false,
  toggleCollapse: () => {},
  detachEdge: () => {},
});

export function isAgentKind(kind: CanvasNodeKind | undefined): boolean {
  return kind === "agent" || kind === "subagent";
}

export function isResourceKind(kind: CanvasNodeKind | undefined): kind is "tool" | "skill" | "connection" {
  return kind === "tool" || kind === "skill" || kind === "connection";
}

const COUNT_KINDS = [
  ["subagent", "subagents"],
  ["tool", "tools"],
  ["skill", "skills"],
  ["connection", "connections"],
  ["channel", "channels"],
] as const;

/**
 * One node per agent or resource. Size says where it sits in the hierarchy,
 * colour only says what kind it is, and a shared resource says how many agents
 * use it, because it is drawn once however many do.
 */
function CanvasNodeCardBase({ id, data, selected }: NodeProps<CapabilityNode>) {
  const { horizontal, uses, toggleCollapse } = useContext(CanvasContext);
  const owns = isAgentKind(data.kind);
  const resource = isResourceKind(data.kind);
  // Both selectors return primitives, so a drag re-renders a node when its answer changes, not every frame.
  const from = useConnection((connection) => (connection.inProgress ? connection.fromNode.id : undefined));
  const targeted = useConnection((connection) => connection.inProgress && connection.toNode?.id === id);
  const valid = resource && from !== undefined && !uses(from, id);
  const tier = data.kind === "agent" ? "root" : owns ? "agent" : "resource";
  const counts = data.counts ? COUNT_KINDS.filter(([, key]) => (data.counts![key] ?? 0) > 0) : [];
  const usedBy = data.usedBy ?? 0;

  return (
    <div
      className="node"
      data-kind={data.kind}
      data-tier={tier}
      data-selected={selected || undefined}
      data-fresh={data.fresh || undefined}
      data-valid={valid || undefined}
      data-invalid={(from !== undefined && from !== id && !valid) || undefined}
      data-targeted={(targeted && valid) || undefined}
    >
      {data.kind !== "agent" && (
        <Handle
          className="node-handle"
          type="target"
          position={horizontal ? Position.Left : Position.Top}
          isConnectableStart={false}
        />
      )}

      <div className="node-head">
        <span className="node-tile" aria-hidden="true">
          <Icon icon={KINDS[data.kind].icon} size={tier === "resource" ? 14 : 16} />
        </span>
        <div className="node-titles">
          <p className="node-type">
            {KINDS[data.kind].label}
            {data.shared && <span className="node-shared">Shared</span>}
          </p>
          <p className="node-name" title={data.name}>
            {data.name}
          </p>
        </div>
        {owns && counts.length > 0 && (
          <button
            type="button"
            className="node-collapse nodrag nopan"
            aria-expanded={!data.collapsed}
            aria-label={data.collapsed ? `Expand ${data.name}` : `Collapse ${data.name}`}
            onClick={(event) => {
              event.stopPropagation();
              toggleCollapse(id);
            }}
          >
            {data.collapsed && data.hiddenCount ? <span className="tabular-nums">+{data.hiddenCount}</span> : null}
            <Icon icon={data.collapsed ? IconChevronRight : IconChevronDown} size={14} />
          </button>
        )}
      </div>

      {data.description && tier !== "resource" && (
        <p className="node-description" title={data.description}>
          {data.description}
        </p>
      )}

      <div className="node-meta">
        <span className="node-detail" title={data.detail}>
          {data.detail}
        </span>
        {resource && (data.shared || usedBy > 1) && (
          <span className="node-usage" title={`${usedBy} ${usedBy === 1 ? "agent uses" : "agents use"} this`}>
            <Icon icon={IconUsers} size={12} />
            <span className="tabular-nums">{usedBy}</span>
          </span>
        )}
      </div>

      {owns && counts.length > 0 && (
        <div className="node-counts">
          {counts.map(([kind, key]) => (
            <KindCount key={kind} kind={kind} count={data.counts![key] ?? 0} />
          ))}
        </div>
      )}

      <p className="node-path mono" title={data.filePath}>
        {data.filePath}
      </p>

      {owns && (
        <Handle className="node-handle" type="source" position={horizontal ? Position.Right : Position.Bottom} />
      )}
    </div>
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardBase);
