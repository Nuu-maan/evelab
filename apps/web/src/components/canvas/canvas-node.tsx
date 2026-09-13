"use client";

import { createContext, memo, useContext } from "react";
import { Handle, Position, useConnection, type Node, type NodeProps } from "@xyflow/react";
import type { CanvasNodeKind, CapabilityCounts } from "@evelab/eve-project";
import { IconChevronDown, IconChevronRight } from "@/components/icons";
import { Icon } from "@/components/icon";
import type { LayoutMode } from "@/components/canvas/layout";
import { KINDS } from "@/components/kinds";

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
  mode: LayoutMode;
  /** Whether an agent already uses a resource, so a drag can show where it may land. */
  uses: (agentId: string, resourceId: string) => boolean;
  toggleCollapse: (agentId: string) => void;
  detachEdge: (agentId: string, resourceId: string) => void;
}

export const CanvasContext = createContext<CanvasContextValue>({
  mode: "hierarchical",
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

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

/** The two readings a card leads with, like a dashboard tile: a big number and what it counts. */
function readings(data: CanvasNodeData): { value: string; label: string }[] {
  const counts = data.counts;
  const resources = counts ? counts.tools + counts.skills + counts.connections : 0;
  if (data.kind === "agent") {
    return [
      { value: String(counts?.subagents ?? 0), label: plural(counts?.subagents ?? 0, "subagent", "subagents") },
      { value: String(resources), label: plural(resources, "resource", "resources") },
    ];
  }
  if (data.kind === "subagent") {
    return [
      { value: String(resources), label: plural(resources, "resource", "resources") },
      { value: String(counts?.subagents ?? 0), label: "nested" },
    ];
  }
  if (data.kind === "channel") return [{ value: `/${data.name}`, label: "route" }];
  const usedBy = data.usedBy ?? 0;
  return [
    { value: String(usedBy), label: plural(usedBy, "agent", "agents") },
    { value: "", label: data.shared ? "shared" : "local" },
  ];
}

/**
 * One card per agent or resource: a tinted frame in the kind's colour, its
 * name, two readings and the model or source it runs on. The root is the
 * largest card, resources the smallest.
 */
function CanvasNodeCardBase({ id, data, selected }: NodeProps<CapabilityNode>) {
  const { mode, uses, toggleCollapse } = useContext(CanvasContext);
  // Horizontal wires run left to right; the outline enters from the left and leaves from the bottom.
  const targetPosition =
    mode === "horizontal" ? Position.Left : mode === "vertical" && data.kind !== "subagent" ? Position.Left : Position.Top;
  const sourcePosition = mode === "horizontal" ? Position.Right : Position.Bottom;
  const owns = isAgentKind(data.kind);
  const resource = isResourceKind(data.kind);
  // Both selectors return primitives, so a drag re-renders a node when its answer changes, not every frame.
  const from = useConnection((connection) => (connection.inProgress ? connection.fromNode.id : undefined));
  const targeted = useConnection((connection) => connection.inProgress && connection.toNode?.id === id);
  const valid = resource && from !== undefined && !uses(from, id);
  const tier = data.kind === "agent" ? "root" : owns ? "agent" : "resource";
  const [primary, secondary] = readings(data);
  const foldable = owns && data.counts && data.counts.subagents + data.counts.tools + data.counts.skills + data.counts.connections > 0;

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
      title={data.description}
    >
      {data.kind !== "agent" && (
        <Handle
          className="node-handle"
          type="target"
          position={targetPosition}
          isConnectableStart={false}
        />
      )}

      <div className="node-head">
        <Icon icon={KINDS[data.kind].icon} size={tier === "resource" ? 16 : 18} />
        <p className="node-name">{data.name}</p>
        {data.shared && <span className="node-shared">Shared</span>}
        {foldable && (
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

      <div className="node-body">
        <div className="node-readings">
          {primary && (
            <span className="node-reading">
              {primary.value && <strong>{primary.value}</strong>}
              <em>{primary.label}</em>
            </span>
          )}
          {secondary && (
            <span className="node-reading" data-secondary="">
              {secondary.value && <strong>{secondary.value}</strong>}
              <em>{secondary.label}</em>
            </span>
          )}
        </div>
        <p className="node-detail" title={data.detail}>
          {data.detail}
        </p>
        <p className="node-path" title={data.filePath}>
          {data.filePath}
        </p>
      </div>

      {owns && (
        <Handle className="node-handle" type="source" position={sourcePosition} />
      )}
    </div>
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardBase);
