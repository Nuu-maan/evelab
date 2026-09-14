"use client";

import { createContext, memo, useContext } from "react";
import { Handle, Position, useConnection, type Node, type NodeProps } from "@xyflow/react";
import type { CanvasNodeKind, CapabilityCounts } from "@evelab/eve-project";
import { IconChevronDown, IconChevronRight } from "@/components/icons";
import { portFraction, portsFor, type LayoutMode, type PortKind, type WireStyle } from "@/components/canvas/layout";
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
  wireStyle: WireStyle;
  /** Whether an agent already uses a resource, so a drag can show where it may land. */
  uses: (agentId: string, resourceId: string) => boolean;
  toggleCollapse: (agentId: string) => void;
  detachEdge: (agentId: string, resourceId: string) => void;
}

export const CanvasContext = createContext<CanvasContextValue>({
  mode: "hierarchical",
  wireStyle: "curved",
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
 * One node per agent or resource, drawn the way n8n draws them: an icon and a
 * name, and nothing else to read. Agents are a card with diamond ports on the
 * bottom edge, labelled underneath; tools, skills and connections are round
 * tiles; channels are square ones. Everything else about a node lives in the
 * inspector, which opens when it is selected.
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
  const tier = data.kind === "agent" ? "root" : owns ? "agent" : data.kind === "channel" ? "channel" : "resource";
  const ports = owns ? portsFor(data.kind) : [];
  const total = ports.reduce((sum, port) => sum + (data.counts?.[COUNT_KEY[port]] ?? 0), 0);
  const typeLabel = data.kind === "agent" ? "Root agent" : KINDS[data.kind].label;

  const target =
    data.kind === "agent" ? null : (
      <Handle
        className="node-handle node-target"
        type="target"
        // Channels sit above the root, so their wires arrive from below.
        position={
          data.kind === "channel" ? (horizontal ? Position.Right : Position.Bottom) : horizontal ? Position.Left : Position.Top
        }
        isConnectableStart={false}
      />
    );

  return (
    <div
      className="node"
      data-horizontal={horizontal || undefined}
      data-kind={data.kind}
      data-tier={tier}
      data-selected={selected || undefined}
      data-fresh={data.fresh || undefined}
      data-valid={valid || undefined}
      data-invalid={(fromId !== undefined && fromId !== id && !valid) || undefined}
      data-targeted={(targeted && valid) || undefined}
      title={`${typeLabel}: ${data.description ?? data.name}`}
    >
      {owns ? (
        <>
          <div
            className="node-card"
            // Ports run down the right edge when horizontal, so the card is just tall enough to space them.
            style={horizontal && ports.length > 0 ? { minHeight: Math.max(68, ports.length * 18 + 12) } : undefined}
          >
            {target}
            {data.kind === "agent" && (
              <Handle
                id={portHandle("channel")}
                type="source"
                data-kind="channel"
                className="node-handle node-port-handle node-channel-handle"
                position={horizontal ? Position.Left : Position.Top}
                isConnectable={false}
              />
            )}
            <span className="node-glyph" aria-hidden="true">
              <Icon icon={KINDS[data.kind].icon} size={20} />
            </span>
            <span className="node-text">
              <span className="node-name">{data.name}</span>
              <span className="node-type">{typeLabel}</span>
            </span>
            {total > 0 && (
              <button
                type="button"
                className="node-collapse nodrag nopan"
                data-collapsed={data.collapsed || undefined}
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
            {horizontal && (
              // Each port's name sits inside the card beside its diamond, in rows that share the diamonds' spacing.
              <span className="node-side-labels" aria-hidden="true" style={{ gridTemplateRows: `repeat(${ports.length}, minmax(0, 1fr))` }}>
                {ports.map((port) => (
                  <span key={port} className="node-port-label" data-kind={port} data-empty={(data.counts?.[COUNT_KEY[port]] ?? 0) === 0 || undefined}>
                    {KINDS[port].plural}
                  </span>
                ))}
              </span>
            )}
            {ports.map((port) => {
              const count = data.counts?.[COUNT_KEY[port]] ?? 0;
              return (
                <Handle
                  key={port}
                  id={portHandle(port)}
                  type="source"
                  data-kind={port}
                  data-empty={count === 0 || undefined}
                  className="node-handle node-port-handle"
                  title={`${KINDS[port].plural}: ${count}`}
                  position={horizontal ? Position.Right : Position.Bottom}
                  style={
                    horizontal
                      ? { top: `${portFraction(data.kind, port) * 100}%` }
                      : { left: `${portFraction(data.kind, port) * 100}%` }
                  }
                />
              );
            })}
          </div>

          {!horizontal && (
            <div className="node-port-labels" style={{ gridTemplateColumns: `repeat(${ports.length}, minmax(0, 1fr))` }}>
              {ports.map((port) => {
                const count = data.counts?.[COUNT_KEY[port]] ?? 0;
                return (
                  <span key={port} className="node-port-label" data-kind={port} data-empty={count === 0 || undefined}>
                    {KINDS[port].plural}
                  </span>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="node-card">
            {target}
            <span className="node-glyph" aria-hidden="true">
              <Icon icon={KINDS[data.kind].icon} size={26} />
            </span>
            {data.shared && <span className="node-shared" aria-label="Shared definition" />}
          </div>
          <span className="node-name">{data.name}</span>
          <span className="node-type">
            {resource && (data.usedBy ?? 0) > 1 ? `${typeLabel} · ${data.usedBy} agents` : typeLabel}
          </span>
        </>
      )}
    </div>
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardBase);
