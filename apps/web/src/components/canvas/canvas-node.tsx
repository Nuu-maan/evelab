"use client";

import { createContext, memo, useContext } from "react";
import { Handle, Position, useConnection, type Node, type NodeProps } from "@xyflow/react";
import type { CanvasNodeKind, CapabilityCounts } from "@evelab/eve-project";
import { IconChevronDown, IconChevronRight } from "@/components/icons";
import { portFraction, portsFor, type LayoutMode, type PortKind } from "@/components/canvas/layout";
import { Icon } from "@/components/icon";
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

const COUNT_KEY: Record<PortKind, keyof CapabilityCounts> = {
  subagent: "subagents",
  tool: "tools",
  skill: "skills",
  connection: "connections",
  channel: "channels",
};

/** The id of the port on an agent that wires to things of a kind. */
export function portHandle(kind: CanvasNodeKind): string {
  return `out-${kind}`;
}

/**
 * One card per agent or resource. An agent card ends in a row of ports, one
 * per kind of thing it can have, each with its own endpoint: wires leave the
 * subagent port for subagents and the skill port for skills, so they never
 * have to share a line or cross each other on the way out.
 */
function CanvasNodeCardBase({ id, data, selected }: NodeProps<CapabilityNode>) {
  const { mode, uses, toggleCollapse } = useContext(CanvasContext);
  const horizontal = mode === "horizontal";
  const owns = isAgentKind(data.kind);
  const resource = isResourceKind(data.kind);
  // Selectors return strings and booleans, so a drag re-renders a card only when its answer changes.
  const drag = useConnection((connection) =>
    connection.inProgress ? `${connection.fromNode.id}|${connection.fromHandle?.id ?? ""}` : "",
  );
  const [fromId, fromHandle] = drag ? drag.split("|") : [undefined, undefined];
  const valid = resource && fromId !== undefined && fromHandle === portHandle(data.kind) && !uses(fromId, id);
  const targeted = useConnection((connection) => connection.inProgress && connection.toNode?.id === id);
  const tier = data.kind === "agent" ? "root" : owns ? "agent" : "resource";
  const ports = owns ? portsFor(data.kind) : [];
  const total = ports.reduce((sum, port) => sum + (data.counts?.[COUNT_KEY[port]] ?? 0), 0);
  const usedBy = data.usedBy ?? 0;

  return (
    <div
      className="node"
      data-kind={data.kind}
      data-tier={tier}
      data-selected={selected || undefined}
      data-fresh={data.fresh || undefined}
      data-valid={valid || undefined}
      data-invalid={(fromId !== undefined && fromId !== id && !valid) || undefined}
      data-targeted={(targeted && valid) || undefined}
      title={data.description}
    >
      {data.kind !== "agent" && (
        <Handle
          className="node-handle node-target"
          type="target"
          // Channels sit above the root, so their wires arrive from below.
          position={
            data.kind === "channel" ? (horizontal ? Position.Right : Position.Bottom) : horizontal ? Position.Left : Position.Top
          }
          isConnectableStart={false}
        />
      )}

      {data.kind === "agent" && (
        <>
          <div className="node-top-port" data-kind="channel" data-horizontal={horizontal || undefined} title="Channels">
            <Icon icon={KINDS.channel.icon} size={14} />
            <span className="tabular-nums">{data.counts?.channels ?? 0}</span>
          </div>
          <Handle
            id={portHandle("channel")}
            type="source"
            data-kind="channel"
            className="node-handle node-port-handle node-channel-handle"
            position={horizontal ? Position.Left : Position.Top}
            isConnectable={false}
          />
        </>
      )}

      <div className="node-head">
        <span className="node-icon" aria-hidden="true">
          <Icon icon={KINDS[data.kind].icon} size={14} />
        </span>
        <div className="node-titles">
          <p className="node-name">{data.name}</p>
          <p className="node-type">
            {data.kind === "agent" ? "Root agent" : KINDS[data.kind].label}
            {data.shared && <span className="node-shared">Shared</span>}
          </p>
        </div>
        {owns && total > 0 && (
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
        {resource && (
          <p className="node-reading">
            <strong>{usedBy}</strong> {usedBy === 1 ? "agent" : "agents"}
            <span className="node-reading-muted">{data.shared ? "shared definition" : "defined in place"}</span>
          </p>
        )}
        {data.kind === "channel" && (
          <p className="node-reading">
            <strong>/{data.name}</strong>
            <span className="node-reading-muted">route</span>
          </p>
        )}
        <p className="node-detail" title={data.detail}>
          {data.detail}
        </p>
        <p className="node-path" title={data.filePath}>
          {data.filePath}
        </p>
      </div>

      {owns && (
        <div className="node-ports" style={{ gridTemplateColumns: `repeat(${ports.length}, minmax(0, 1fr))` }}>
          {ports.map((port) => {
            const count = data.counts?.[COUNT_KEY[port]] ?? 0;
            return (
              <div
                key={port}
                className="node-port"
                data-kind={port}
                data-empty={count === 0 || undefined}
                title={`${count} ${count === 1 ? KINDS[port].label.toLowerCase() : KINDS[port].plural.toLowerCase()}`}
              >
                <Icon icon={KINDS[port].icon} size={14} />
                <span className="tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {ports.map((port) => (
        <Handle
          key={port}
          id={portHandle(port)}
          type="source"
          data-kind={port}
          className="node-handle node-port-handle"
          position={horizontal ? Position.Right : Position.Bottom}
          style={
            horizontal
              ? { top: `${portFraction(data.kind, port) * 100}%` }
              : { left: `${portFraction(data.kind, port) * 100}%` }
          }
        />
      ))}
    </div>
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardBase);
