"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  useViewport,
  type Connection,
  type EdgeMouseHandler,
  type IsValidConnection,
  type Node,
  type NodeMouseHandler,
  type OnNodeDrag,
} from "@xyflow/react";
import type { CanvasEdge, CanvasGraph, CanvasNode, CanvasNodeKind } from "@evelab/eve-project";
import { IconChevronDown, IconFullscreen, IconMinus, IconPlus } from "@/components/icons";
import { CanvasConnectionLine, RelationEdgePath, type RelationEdge } from "@/components/canvas/canvas-edge";
import {
  CanvasContext,
  CanvasNodeCard,
  isAgentKind,
  isResourceKind,
  type CanvasContextValue,
  type CanvasNodeData,
  type CapabilityNode,
} from "@/components/canvas/canvas-node";
import {
  CanvasInspector,
  dialogIsOpen,
  InspectorColumn,
  type CreateKind,
  type Issue,
  type SourceState,
} from "@/components/canvas/canvas-inspector";
import { CanvasCreatePanel, type DraftKind } from "@/components/canvas/canvas-create-panel";
import { ResourceBrowser } from "@/components/canvas/resource-browser";
import { autoLayout, type LayoutMode, type Positions } from "@/components/canvas/layout";
import type { ChatSdkOption } from "@/components/channel-form";
import { ConfirmDialog } from "@/components/confirm";
import { Icon } from "@/components/icon";
import { KINDS, KindTile } from "@/components/kinds";
import { SkillImportDialog } from "@/components/skill-import-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { attachResourceAction, changeOwnershipAction, detachResourceAction, removeNodeAction, saveLayoutAction } from "@/lib/actions";
import "@/app/canvas.css";

const nodeTypes = { capability: CanvasNodeCard };
const edgeTypes = { relation: RelationEdgePath };

export interface CanvasProps {
  projectId: string;
  graph: CanvasGraph;
  /** Contents of each node's file, so selecting a node opens instantly. */
  contents: Record<string, string>;
  positions: Positions;
  mode: LayoutMode;
  collapsed: string[];
  defaultModel: string;
  models: { id: string; label: string }[];
  /** Where the agent lives: "agent" or "" for the flat layout. */
  root: string;
  issues: Issue[];
  chatSdkAdapters: ChatSdkOption[];
  chatSdkStates: ChatSdkOption[];
}

type Result = { ok: true } | { ok: false; message: string };
type Point = { x: number; y: number };

type HistoryEntry =
  | { type: "move"; before: Positions; after: Positions }
  | { type: "attach" | "detach"; resource: string; agent: string };

const LAYOUTS: { mode: LayoutMode; label: string; hint: string }[] = [
  { mode: "hierarchical", label: "Hierarchical", hint: "Root on top, resources below" },
  { mode: "horizontal", label: "Horizontal", hint: "Left to right" },
  { mode: "vertical", label: "Vertical", hint: "An indented outline" },
  { mode: "freeform", label: "Freeform", hint: "Only where you put things" },
];

const ADD_ITEMS: { kind: CreateKind; hint: string }[] = [
  { kind: "subagent", hint: "An agent the root delegates to" },
  { kind: "tool", hint: "A function the model calls" },
  { kind: "skill", hint: "Instructions loaded on demand" },
  { kind: "connection", hint: "An MCP server or OpenAPI service" },
  { kind: "channel", hint: "Chat SDK, Slack, HTTP and more" },
];

/** "tool:#github" or "tool:researcher/github" to "github". */
function refName(ref: string): string {
  return ref.slice(Math.max(ref.lastIndexOf("#"), ref.lastIndexOf("/"), ref.indexOf(":")) + 1);
}

/** The id a resource has once it lives in lib/, which is where attach and detach leave it. */
function sharedId(ref: string): string {
  return `${ref.slice(0, ref.indexOf(":"))}:#${refName(ref)}`;
}

function nodeData(node: CanvasNode, fresh: boolean): CanvasNodeData {
  const { name, detail, description, counts, filePath, kind, shared } = node;
  return { name, detail, description, counts, filePath, kind, shared, usedBy: node.usedBy?.length, fresh };
}

function sameData(previous: CanvasNodeData, node: CanvasNode): boolean {
  return (
    previous.name === node.name &&
    previous.detail === node.detail &&
    previous.description === node.description &&
    previous.filePath === node.filePath &&
    previous.shared === node.shared &&
    previous.usedBy === node.usedBy?.length &&
    JSON.stringify(previous.counts) === JSON.stringify(node.counts)
  );
}

function toEdge(edge: Pick<CanvasEdge, "source" | "target" | "relation">, kind: CanvasNodeKind): RelationEdge {
  return {
    id: `${edge.source}->${edge.target}`,
    source: edge.source,
    target: edge.target,
    type: "relation",
    className: `edge-${kind}`,
    interactionWidth: 20,
    data: { relation: edge.relation, detachable: isResourceKind(kind) },
  };
}

function snapshot(nodes: Node[]): Positions {
  return Object.fromEntries(nodes.map((node) => [node.id, { x: node.position.x, y: node.position.y }]));
}

/** What folding an agent hides: its subagents, and resources nobody visible still uses. */
function foldedNodes(graph: CanvasGraph, collapsed: Set<string>) {
  const hidden = new Set<string>();
  const counts = new Map<string, number>();
  if (collapsed.size === 0) return { hidden, counts };
  const out = new Map<string, CanvasEdge[]>();
  const consumers = new Map<string, string[]>();
  for (const edge of graph.edges) {
    out.set(edge.source, [...(out.get(edge.source) ?? []), edge]);
    consumers.set(edge.target, [...(consumers.get(edge.target) ?? []), edge.source]);
  }
  const hideUnder = (id: string, owner: string) => {
    for (const edge of out.get(id) ?? []) {
      if (hidden.has(edge.target)) continue;
      const users = consumers.get(edge.target) ?? [];
      if (edge.relation !== "contains" && !users.every((user) => user === id || hidden.has(user) || collapsed.has(user))) {
        continue;
      }
      hidden.add(edge.target);
      counts.set(owner, (counts.get(owner) ?? 0) + 1);
      if (edge.relation === "contains") hideUnder(edge.target, owner);
    }
  };
  for (const id of collapsed) if (!hidden.has(id)) hideUnder(id, id);
  return { hidden, counts };
}

function typingInto(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true'], .monaco-editor"));
}

function ToolbarButton({
  label,
  tooltip,
  onClick,
  className,
  children,
}: {
  label: string;
  tooltip: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" type="button" aria-label={label} className={className} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

/** Its own component so panning re-renders the zoom readout, not the canvas. */
function ZoomControls() {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const { zoom } = useViewport();
  return (
    <>
      <ToolbarButton label="Zoom out" tooltip="Zoom out" onClick={() => void zoomOut({ duration: 200 })}>
        <Icon icon={IconMinus} />
      </ToolbarButton>
      <ToolbarButton
        label="Reset zoom to 100%"
        tooltip="Reset to 100%"
        className="w-12 text-xs tabular-nums text-muted-foreground"
        onClick={() => void zoomTo(1, { duration: 200 })}
      >
        {Math.round(zoom * 100)}%
      </ToolbarButton>
      <ToolbarButton label="Zoom in" tooltip="Zoom in" onClick={() => void zoomIn({ duration: 200 })}>
        <Icon icon={IconPlus} />
      </ToolbarButton>
      <ToolbarButton
        label="Fit to screen"
        tooltip="Fit everything (0)"
        onClick={() => void fitView({ duration: 280, padding: 0.2, maxZoom: 1 })}
      >
        <Icon icon={IconFullscreen} />
      </ToolbarButton>
    </>
  );
}

function CanvasInner(props: CanvasProps) {
  const { projectId, graph, contents, positions, issues, root } = props;
  const router = useRouter();
  const { fitView, getNodes, getNode, getIntersectingNodes, setCenter, getZoom } = useReactFlow<CapabilityNode, RelationEdge>();

  const [mode, setMode] = useState<LayoutMode>(props.mode);
  const [collapsed, setCollapsed] = useState(() => new Set(props.collapsed));
  const [snap, setSnap] = useState(false);
  const [locked, setLocked] = useState(false);
  const [minimap, setMinimap] = useState(true);
  const [hovered, setHovered] = useState<{ type: "node" | "edge"; id: string }>();
  const [attachTarget, setAttachTarget] = useState<string>();
  const [dragging, setDragging] = useState<string>();
  const [settling, setSettling] = useState(false);
  const [draft, setDraft] = useState<{ kind: DraftKind; owner?: string }>();
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CanvasNode>();
  const [notice, setNotice] = useState<{ text: string; tone?: "error"; undo?: boolean }>();
  const [pendingCount, setPendingCount] = useState(0);
  const [sourceState, setSourceState] = useState<SourceState>("saved");

  const layoutState = useRef({ mode: props.mode, collapsed: new Set(props.collapsed) });
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Positions for nodes the server has not sent yet, or that are about to change id. */
  const pending = useRef<Positions>({});
  const history = useRef<{ past: HistoryEntry[]; future: HistoryEntry[] }>({ past: [], future: [] });
  const dragStart = useRef<Positions>({});
  const clipboard = useRef<string[]>([]);
  const renderedGraph = useRef(graph);

  const byId = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const kinds = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node.kind] as const)), [graph.nodes]);
  const graphEdges = useMemo(
    () => graph.edges.map((edge) => toEdge(edge, kinds.get(edge.target) ?? "tool")),
    [graph.edges, kinds],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<CapabilityNode>(
    useMemo(() => {
      const layout = { ...autoLayout(graph, props.mode === "freeform" ? "hierarchical" : props.mode), ...positions };
      return graph.nodes.map((node) => ({
        id: node.id,
        type: "capability" as const,
        position: layout[node.id] ?? { x: 0, y: 0 },
        data: nodeData(node, false),
      }));
      // Initial state only; later graphs are merged in the effect below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<RelationEdge>(graphEdges);

  // Fit once the cards have real sizes; fitting on mount measures placeholder boxes.
  const initialized = useNodesInitialized();
  const fitted = useRef(false);
  useEffect(() => {
    if (!initialized || fitted.current) return;
    fitted.current = true;
    requestAnimationFrame(() => void fitView({ padding: 0.12, maxZoom: 1 }));
  }, [fitView, initialized]);

  const usesSet = useMemo(() => new Set(edges.map((edge) => `${edge.source}|${edge.target}`)), [edges]);
  const uses = useCallback(
    (agent: string, resource: string) => usesSet.has(`${agent}|${resource}`) || usesSet.has(`${agent}|${sharedId(resource)}`),
    [usesSet],
  );

  // Merge a refreshed graph into the live nodes, keeping positions, measurements
  // and selection for everything that already exists.
  useEffect(() => {
    if (renderedGraph.current === graph) return;
    renderedGraph.current = graph;
    const auto = autoLayout(graph, layoutState.current.mode === "freeform" ? "hierarchical" : layoutState.current.mode);
    setNodes((current) => {
      const existing = new Map(current.map((node) => [node.id, node]));
      const placedChildren = new Map<string, number>();
      return graph.nodes.map((node) => {
        const previous = existing.get(node.id);
        if (previous) {
          return sameData(previous.data, node) ? previous : { ...previous, data: nodeData(node, previous.data.fresh) };
        }
        let position = pending.current[node.id] ?? positions[node.id];
        delete pending.current[node.id];
        if (!position) {
          // A new node sits under the agent it belongs to, beside anything added with it.
          const parent = graph.edges.find((edge) => edge.target === node.id);
          const owner = parent ? existing.get(parent.source) : undefined;
          if (owner) {
            const index = placedChildren.get(owner.id) ?? 0;
            placedChildren.set(owner.id, index + 1);
            const horizontal = layoutState.current.mode === "horizontal";
            const offset = (owner.measured?.height ?? 140) + 72;
            position = horizontal
              ? { x: owner.position.x + (owner.measured?.width ?? 260) + 96, y: owner.position.y + index * 112 }
              : { x: owner.position.x + index * 244, y: owner.position.y + offset };
          }
        }
        return {
          id: node.id,
          type: "capability" as const,
          position: position ?? auto[node.id] ?? { x: 0, y: 0 },
          data: nodeData(node, true),
        };
      });
    });
    setEdges((current) => {
      const selected = new Set(current.filter((edge) => edge.selected).map((edge) => edge.id));
      return graphEdges.map((edge) => (selected.has(edge.id) ? { ...edge, selected: true } : edge));
    });
  }, [graph, graphEdges, positions, setEdges, setNodes]);

  const persist = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const next: Positions = {};
      for (const node of getNodes()) next[node.id] = { x: Math.round(node.position.x), y: Math.round(node.position.y) };
      for (const [id, position] of Object.entries(pending.current)) {
        next[id] = { x: Math.round(position.x), y: Math.round(position.y) };
      }
      void saveLayoutAction(projectId, next, {
        mode: layoutState.current.mode,
        collapsed: [...layoutState.current.collapsed],
      });
    }, 400);
  }, [getNodes, projectId]);

  const say = useCallback((next: { text: string; tone?: "error"; undo?: boolean } | undefined) => {
    clearTimeout(noticeTimer.current);
    setNotice(next);
    if (next && next.tone !== "error") noticeTimer.current = setTimeout(() => setNotice(undefined), 5000);
  }, []);

  const settle = useCallback(() => {
    clearTimeout(settleTimer.current);
    setSettling(true);
    settleTimer.current = setTimeout(() => setSettling(false), 360);
  }, []);

  const record = useCallback((entry: HistoryEntry) => {
    history.current.past = [...history.current.past.slice(-99), entry];
    history.current.future = [];
  }, []);

  const run = useCallback(
    async (task: () => Promise<Result>): Promise<boolean> => {
      setPendingCount((count) => count + 1);
      try {
        const result = await task();
        if (!result.ok) say({ text: result.message, tone: "error" });
        return result.ok;
      } catch {
        say({ text: "Something went wrong writing the project.", tone: "error" });
        return false;
      } finally {
        setPendingCount((count) => count - 1);
        router.refresh();
      }
    },
    [router, say],
  );

  /** A resource keeps its place on the canvas when attaching or detaching moves it to lib/. */
  const carry = useCallback(
    (resource: string) => {
      const node = getNode(resource);
      if (node && !resource.includes("#")) pending.current[sharedId(resource)] = node.position;
    },
    [getNode],
  );

  const attach = useCallback(
    async (resource: string, agent: string, options: { record?: boolean } = {}) => {
      const kind = resource.slice(0, resource.indexOf(":")) as CanvasNodeKind;
      const agentName = byId.get(agent)?.name ?? agent;
      if (!isResourceKind(kind) || !isAgentKind(kinds.get(agent))) return;
      if (uses(agent, resource)) {
        say({ text: `${agentName} already uses ${refName(resource)}` });
        return;
      }
      carry(resource);
      const relation = kind === "tool" ? "has tool" : kind === "skill" ? "has skill" : "connects to";
      setEdges((current) => [...current, toEdge({ source: agent, target: resource, relation }, kind)]);
      const ok = await run(() => attachResourceAction({ projectId, resource, agent }));
      if (!ok) {
        setEdges(graphEdges);
        return;
      }
      if (options.record !== false) record({ type: "attach", resource: sharedId(resource), agent });
      say({ text: `${refName(resource)} attached to ${agentName}`, undo: options.record !== false });
    },
    [byId, carry, graphEdges, kinds, projectId, record, run, say, setEdges, uses],
  );

  const detach = useCallback(
    async (resource: string, agent: string, options: { record?: boolean } = {}) => {
      const agentName = byId.get(agent)?.name ?? agent;
      carry(resource);
      setEdges((current) =>
        current.filter((edge) => !(edge.source === agent && (edge.target === resource || edge.target === sharedId(resource)))),
      );
      const ok = await run(() => detachResourceAction({ projectId, resource, agent }));
      if (!ok) {
        setEdges(graphEdges);
        return;
      }
      if (options.record !== false) record({ type: "detach", resource: sharedId(resource), agent });
      say({ text: `${refName(resource)} detached from ${agentName}`, undo: options.record !== false });
    },
    [byId, carry, graphEdges, projectId, record, run, say, setEdges],
  );

  const applyPositions = useCallback(
    (placed: Positions) => {
      settle();
      setNodes((current) => current.map((node) => (placed[node.id] ? { ...node, position: placed[node.id]! } : node)));
      persist();
    },
    [persist, setNodes, settle],
  );

  const undo = useCallback(() => {
    const entry = history.current.past.pop();
    if (!entry) return;
    history.current.future.push(entry);
    say(undefined);
    if (entry.type === "move") applyPositions(entry.before);
    else if (entry.type === "attach") void detach(entry.resource, entry.agent, { record: false });
    else void attach(entry.resource, entry.agent, { record: false });
  }, [applyPositions, attach, detach, say]);

  const redo = useCallback(() => {
    const entry = history.current.future.pop();
    if (!entry) return;
    history.current.past.push(entry);
    if (entry.type === "move") applyPositions(entry.after);
    else if (entry.type === "attach") void attach(entry.resource, entry.agent, { record: false });
    else void detach(entry.resource, entry.agent, { record: false });
  }, [applyPositions, attach, detach]);

  const applyLayout = useCallback(
    (next: LayoutMode) => {
      setMode(next);
      layoutState.current.mode = next;
      if (next !== "freeform") {
        const placed = autoLayout(graph, next, foldedNodes(graph, layoutState.current.collapsed).hidden);
        record({ type: "move", before: snapshot(getNodes()), after: placed });
        applyPositions(placed);
        requestAnimationFrame(() => void fitView({ duration: 360, padding: 0.2, maxZoom: 1 }));
      }
      persist();
    },
    [applyPositions, fitView, getNodes, graph, persist, record],
  );

  const align = useCallback(
    (axis: "x" | "y") => {
      const selected = getNodes().filter((node) => node.selected);
      if (selected.length < 2) return;
      const value = Math.min(...selected.map((node) => node.position[axis]));
      const after = Object.fromEntries(selected.map((node) => [node.id, { ...node.position, [axis]: value }]));
      record({ type: "move", before: snapshot(selected), after });
      applyPositions(after);
    },
    [applyPositions, getNodes, record],
  );

  const toggleCollapse = useCallback(
    (id: string) => {
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        layoutState.current.collapsed = next;
        return next;
      });
      persist();
    },
    [persist],
  );

  const select = useCallback(
    (id: string) => {
      setDraft(undefined);
      setNodes((current) => current.map((node) => ({ ...node, selected: node.id === id })));
      setEdges((current) => current.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)));
      const node = getNode(id);
      if (node) {
        const width = node.measured?.width ?? 240;
        const height = node.measured?.height ?? 100;
        void setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: Math.max(getZoom(), 0.8), duration: 320 });
      }
    },
    [getNode, getZoom, setCenter, setEdges, setNodes],
  );

  const clearSelection = useCallback(() => {
    setNodes((current) => (current.some((node) => node.selected) ? current.map((node) => ({ ...node, selected: false })) : current));
    setEdges((current) => (current.some((edge) => edge.selected) ? current.map((edge) => ({ ...edge, selected: false })) : current));
  }, [setEdges, setNodes]);

  const create = useCallback(
    (kind: CreateKind, owner?: string) => {
      setAddOpen(false);
      if (kind === "skill") {
        setImportOpen(true);
        return;
      }
      setDraft({ kind, owner: owner && owner !== "agent" && kind !== "channel" ? owner : undefined });
    },
    [],
  );

  const removeNode = useCallback(async () => {
    const node = confirmDelete;
    setConfirmDelete(undefined);
    if (!node) return;
    clearSelection();
    const ok = await run(() => removeNodeAction({ projectId, ref: node.id }));
    if (ok) say({ text: `Deleted ${node.name}` });
  }, [clearSelection, confirmDelete, projectId, run, say]);

  const selectedNodes = nodes.filter((node) => node.selected);
  const selectedEdges = edges.filter((edge) => edge.selected);
  const selected = selectedNodes.length === 1 ? byId.get(selectedNodes[0]!.id) : undefined;
  const addTarget = selected && isAgentKind(selected.kind) ? selected : byId.get("agent");

  const focusSelection = useCallback(() => {
    const targets = getNodes().filter((node) => node.selected);
    void fitView({
      nodes: targets.length > 0 ? targets.map((node) => ({ id: node.id })) : undefined,
      duration: 320,
      padding: 0.35,
      maxZoom: 1.2,
    });
  }, [fitView, getNodes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (typingInto(event.target) || dialogIsOpen()) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && key === "a") {
        event.preventDefault();
        setNodes((current) => current.map((node) => (node.hidden ? node : { ...node, selected: true })));
        return;
      }
      if (mod && key === "c") {
        const copied = getNodes().filter((node) => node.selected && isResourceKind(node.data.kind));
        if (copied.length === 0) return;
        clipboard.current = copied.map((node) => node.id);
        say({ text: `Copied ${copied.length === 1 ? copied[0]!.data.name : `${copied.length} resources`}. Select an agent and paste to attach.` });
        return;
      }
      if (mod && key === "v") {
        if (clipboard.current.length === 0 || !addTarget) return;
        event.preventDefault();
        for (const resource of clipboard.current) void attach(resource, addTarget.id);
        return;
      }
      if (mod || event.altKey) return;

      switch (event.key) {
        case "Delete":
        case "Backspace": {
          const detachable = selectedEdges.filter((edge) => edge.data?.detachable);
          if (detachable.length > 0) {
            event.preventDefault();
            for (const edge of detachable) void detach(edge.target, edge.source);
          } else if (selected && selected.kind !== "agent") {
            event.preventDefault();
            setConfirmDelete(selected);
          }
          break;
        }
        case "f":
        case "F":
          focusSelection();
          break;
        case "0":
          void fitView({ duration: 320, padding: 0.2, maxZoom: 1 });
          break;
        case "1":
          void fitView({ nodes: [{ id: "agent" }], duration: 320, padding: 0.6, maxZoom: 1 });
          break;
        case "a":
        case "A":
          event.preventDefault();
          setAddOpen(true);
          break;
        case "Escape":
          setDraft(undefined);
          clearSelection();
          say(undefined);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addTarget, attach, clearSelection, detach, fitView, focusSelection, getNodes, redo, say, selected, selectedEdges, setNodes, undo]);

  const { hidden, counts } = useMemo(() => foldedNodes(graph, collapsed), [collapsed, graph]);

  const related = useMemo(() => {
    if (!hovered || dragging) return undefined;
    if (hovered.type === "edge") {
      const edge = graph.edges.find((candidate) => `${candidate.source}->${candidate.target}` === hovered.id);
      return new Set(edge ? [edge.source, edge.target] : []);
    }
    const set = new Set([hovered.id]);
    for (const edge of graph.edges) {
      if (edge.source === hovered.id) set.add(edge.target);
      if (edge.target === hovered.id) set.add(edge.source);
    }
    return set;
  }, [dragging, graph.edges, hovered]);

  const displayNodes = useMemo(
    () =>
      nodes.map((node) => {
        const classes: string[] = [];
        if (related) classes.push(related.has(node.id) ? "is-related" : "is-dim");
        if (node.id === attachTarget) classes.push("is-attach-target");
        if (settling) classes.push("is-settling");
        const className = classes.join(" ") || undefined;
        const isHidden = hidden.has(node.id);
        const isCollapsed = collapsed.has(node.id) || undefined;
        const hiddenCount = counts.get(node.id);
        const dataChanged = node.data.collapsed !== isCollapsed || node.data.hiddenCount !== hiddenCount;
        if (!dataChanged && node.className === className && Boolean(node.hidden) === isHidden) return node;
        return {
          ...node,
          className,
          hidden: isHidden,
          data: dataChanged ? { ...node.data, collapsed: isCollapsed, hiddenCount } : node.data,
        };
      }),
    [attachTarget, collapsed, counts, hidden, nodes, related, settling],
  );

  const displayEdges = useMemo(() => {
    const list = edges.map((edge) => {
      const touches = hovered?.type === "edge" ? hovered.id === edge.id : hovered?.type === "node" && (edge.source === hovered.id || edge.target === hovered.id);
      const kind = kinds.get(edge.target) ?? "tool";
      const className = [`edge-${kind}`, related ? (touches ? "is-related" : "is-dim") : ""].filter(Boolean).join(" ");
      const showLabel = Boolean(edge.selected || (hovered?.type === "edge" && hovered.id === edge.id));
      if (edge.className === className && edge.data?.showLabel === showLabel) return edge;
      return { ...edge, className, data: { ...edge.data!, showLabel } };
    });
    if (dragging && attachTarget) {
      const kind = kinds.get(dragging) ?? "tool";
      list.push({ ...toEdge({ source: attachTarget, target: dragging, relation: "has tool" }, kind), id: "attach-preview", className: `edge-${kind} is-preview`, selectable: false });
    }
    return list;
  }, [attachTarget, dragging, edges, hovered, kinds, related]);

  const isValidConnection = useCallback<IsValidConnection<RelationEdge>>(
    (connection) =>
      isAgentKind(kinds.get(connection.source)) &&
      isResourceKind(kinds.get(connection.target)) &&
      !uses(connection.source, connection.target),
    [kinds, uses],
  );

  const onConnect = useCallback(
    (connection: Connection) => void attach(connection.target, connection.source),
    [attach],
  );

  const onNodeDragStart = useCallback<OnNodeDrag<CapabilityNode>>(
    (_, node) => {
      dragStart.current = snapshot(getNodes());
      setDragging(node.id);
    },
    [getNodes],
  );

  const onNodeDrag = useCallback<OnNodeDrag<CapabilityNode>>(
    (_, node) => {
      if (!isResourceKind(node.data.kind)) return;
      const hit = getIntersectingNodes(node).find((candidate) => isAgentKind(kinds.get(candidate.id)) && !uses(candidate.id, node.id));
      setAttachTarget((current) => (current === hit?.id ? current : hit?.id));
    },
    [getIntersectingNodes, kinds, uses],
  );

  const onNodeDragStop = useCallback<OnNodeDrag<CapabilityNode>>(
    (_, node, dragged) => {
      setDragging(undefined);
      const target = attachTarget;
      setAttachTarget(undefined);
      if (target) {
        // Dropped onto an agent: attach, and the card returns to where it was picked up.
        applyPositions({ [node.id]: dragStart.current[node.id]! });
        void attach(node.id, target);
        return;
      }
      const before: Positions = {};
      const after: Positions = {};
      for (const moved of dragged) {
        const start = dragStart.current[moved.id];
        if (start && (start.x !== moved.position.x || start.y !== moved.position.y)) {
          before[moved.id] = start;
          after[moved.id] = moved.position;
        }
      }
      if (Object.keys(after).length > 0) {
        record({ type: "move", before, after });
        if (layoutState.current.mode !== "freeform") {
          layoutState.current.mode = "freeform";
          setMode("freeform");
        }
        persist();
      }
    },
    [applyPositions, attach, attachTarget, persist, record],
  );

  const agentAt = useCallback(
    (point: Point): string | undefined => {
      for (const element of document.elementsFromPoint(point.x, point.y)) {
        const id = (element as HTMLElement).closest<HTMLElement>(".react-flow__node")?.dataset.id;
        if (id && isAgentKind(kinds.get(id))) return id;
      }
      return undefined;
    },
    [kinds],
  );

  const context = useMemo<CanvasContextValue>(
    () => ({
      horizontal: mode === "horizontal",
      uses,
      toggleCollapse,
      detachEdge: (agent, resource) => void detach(resource, agent),
    }),
    [detach, mode, toggleCollapse, uses],
  );

  const errors = issues.filter((issue) => issue.level === "error");
  const sync =
    pendingCount > 0
      ? { label: "Writing files", tone: "busy" }
      : sourceState === "conflict"
        ? { label: "Conflict", tone: "error" }
        : sourceState === "dirty"
          ? { label: "Unsaved", tone: "warning" }
          : errors.length > 0
            ? { label: `${errors.length} ${errors.length === 1 ? "issue" : "issues"}`, tone: "error" }
            : { label: "In sync", tone: "ok" };

  const empty = graph.nodes.every((node) => node.kind === "agent" || node.kind === "channel");
  const attachable = addTarget ? graph.nodes.filter((node) => isResourceKind(node.kind) && !uses(addTarget.id, node.id)) : [];

  return (
    <CanvasContext.Provider value={context}>
      <div className="canvas-layout">
        <ResourceBrowser
          nodes={graph.nodes}
          selectedId={selected?.id}
          onSelect={select}
          onCreate={(kind) => create(kind)}
          canDrop={(resource, point) => {
            const target = agentAt(point);
            const ok = Boolean(target && !uses(target, resource));
            setAttachTarget((current) => {
              const next = ok ? target : undefined;
              return current === next ? current : next;
            });
            return ok;
          }}
          onDrop={(resource, point) => {
            const target = agentAt(point);
            setAttachTarget(undefined);
            if (target) void attach(resource, target);
          }}
          onHoverDrop={(over) => {
            if (!over) setAttachTarget(undefined);
          }}
        />

        <div className="canvas-surface" data-locked={locked || undefined}>
          <ReactFlow<CapabilityNode, RelationEdge>
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeMouseEnter={useCallback<NodeMouseHandler<CapabilityNode>>((_, node) => setHovered({ type: "node", id: node.id }), [])}
            onNodeMouseLeave={useCallback(() => setHovered(undefined), [])}
            onEdgeMouseEnter={useCallback<EdgeMouseHandler<RelationEdge>>((_, edge) => setHovered({ type: "edge", id: edge.id }), [])}
            onEdgeMouseLeave={useCallback(() => setHovered(undefined), [])}
            onNodeClick={() => setDraft(undefined)}
            onPaneClick={() => setDraft(undefined)}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            connectionLineComponent={CanvasConnectionLine}
            connectionRadius={40}
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            panOnDrag={[1, 2]}
            panOnScroll
            multiSelectionKeyCode={["Meta", "Control", "Shift"]}
            // Deleting a node removes files; the canvas asks first, so React Flow never deletes on its own.
            deleteKeyCode={null}
            snapToGrid={snap}
            snapGrid={[16, 16]}
            nodesDraggable={!locked}
            nodesConnectable={!locked}
            elevateEdgesOnSelect
            onlyRenderVisibleElements={graph.nodes.length > 120}
            // React Flow asks open projects without a Pro plan to keep its attribution.
            attributionPosition="bottom-left"
            minZoom={0.2}
            maxZoom={2}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--canvas-dot)" />
            {minimap && (
              <MiniMap
                pannable
                zoomable
                position="bottom-right"
                nodeBorderRadius={4}
                nodeStrokeWidth={0}
                nodeClassName={(node) => `minimap-node minimap-${(node.data as CanvasNodeData).kind}`}
                ariaLabel="Minimap"
              />
            )}
          </ReactFlow>

          <div className="canvas-toolbar" role="toolbar" aria-label="Canvas">
            <DropdownMenu open={addOpen} onOpenChange={setAddOpen}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Icon icon={IconPlus} />
                  Add
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="w-72">
                <DropdownMenuLabel>
                  Add to {addTarget?.kind === "subagent" ? addTarget.name : "the architecture"}
                </DropdownMenuLabel>
                <DropdownMenuItem disabled>
                  <KindTile kind="agent" />
                  <span className="menu-text">
                    Agent
                    <span className="menu-hint">One root agent per Eve project</span>
                  </span>
                </DropdownMenuItem>
                {ADD_ITEMS.map((item) => (
                  <DropdownMenuItem
                    key={item.kind}
                    onSelect={() => create(item.kind, addTarget?.id)}
                    disabled={item.kind === "channel" && addTarget?.kind === "subagent"}
                  >
                    <KindTile kind={item.kind} />
                    <span className="menu-text">
                      {KINDS[item.kind].label}
                      <span className="menu-hint">{item.hint}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
                {attachable.length > 0 && addTarget && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Attach existing to {addTarget.name}</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-60">
                        {attachable.map((resource) => (
                          <DropdownMenuItem key={resource.id} onSelect={() => void attach(resource.id, addTarget.id)}>
                            <KindTile kind={resource.kind} />
                            <span className="min-w-0 flex-1 truncate">{resource.name}</span>
                            {resource.shared && <span className="menu-meta">Shared</span>}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="canvas-toolbar-separator" aria-hidden="true" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  Layout
                  <Icon icon={IconChevronDown} size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8} className="w-60">
                <DropdownMenuRadioGroup value={mode} onValueChange={(value) => applyLayout(value as LayoutMode)}>
                  {LAYOUTS.map((layout) => (
                    <DropdownMenuRadioItem key={layout.mode} value={layout.mode}>
                      <span className="menu-text">
                        {layout.label}
                        <span className="menu-hint">{layout.hint}</span>
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={selectedNodes.length < 2} onSelect={() => align("x")}>
                  Align left edges
                </DropdownMenuItem>
                <DropdownMenuItem disabled={selectedNodes.length < 2} onSelect={() => align("y")}>
                  Align top edges
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={collapsed.size === 0}
                  onSelect={() => {
                    setCollapsed(new Set());
                    layoutState.current.collapsed = new Set();
                    persist();
                  }}
                >
                  Expand everything
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={snap} onCheckedChange={(value) => setSnap(value === true)}>
                  Snap to grid
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={minimap} onCheckedChange={(value) => setMinimap(value === true)}>
                  Minimap
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={locked} onCheckedChange={(value) => setLocked(value === true)}>
                  Lock canvas
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={undo}>
                  Undo
                  <DropdownMenuShortcut>Ctrl Z</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={redo}>
                  Redo
                  <DropdownMenuShortcut>Ctrl Shift Z</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="canvas-toolbar-separator" aria-hidden="true" />
            <ZoomControls />
            <span className="canvas-toolbar-separator" aria-hidden="true" />

            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="sync-status" data-tone={sync.tone} onClick={clearSelection}>
                  <span className="sync-dot" aria-hidden="true" />
                  {sync.label}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                The canvas reads and writes the Eve files directly.
              </TooltipContent>
            </Tooltip>
          </div>

          {empty && !draft && (
            <div className="canvas-empty">
              <p className="canvas-empty-title">Build your agent architecture</p>
              <p className="canvas-empty-text">
                Give the root agent subagents, tools, skills and connections. A resource can be shared by any number of
                agents and is still defined once.
              </p>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Icon icon={IconPlus} />
                Add resource
              </Button>
            </div>
          )}

          {notice && (
            <div className="canvas-notice" role="status" data-tone={notice.tone}>
              <span>{notice.text}</span>
              {notice.undo && (
                <button type="button" className="canvas-notice-action" onClick={undo}>
                  Undo
                </button>
              )}
            </div>
          )}
        </div>

        <InspectorColumn label={draft ? "Create" : selected ? `${selected.name} inspector` : "Architecture"}>
          {draft ? (
            <CanvasCreatePanel
              key={`${draft.kind}-${draft.owner ?? "root"}`}
              projectId={projectId}
              kind={draft.kind}
              root={root}
              owner={draft.owner ? byId.get(draft.owner)?.name : undefined}
              defaultModel={props.defaultModel}
              models={props.models}
              existingChannels={graph.nodes.filter((node) => node.kind === "channel").map((node) => node.name)}
              chatSdkAdapters={props.chatSdkAdapters}
              chatSdkStates={props.chatSdkStates}
              onClose={() => setDraft(undefined)}
              onSubmitted={(entityId) => {
                const owner = draft.owner;
                const kind = draft.kind;
                setDraft(undefined);
                say({ text: `Created ${entityId}` });
                if (owner && (kind === "tool" || kind === "connection")) {
                  // Created at the root first, then moved into the subagent's own folder.
                  void run(() => changeOwnershipAction({ projectId, capability: `${kind}:${entityId}`, to: owner }));
                }
              }}
            />
          ) : (
            <CanvasInspector
              projectId={projectId}
              graph={graph}
              node={selected}
              content={selected ? (contents[selected.filePath] ?? "") : ""}
              issues={issues}
              onSelect={select}
              onClear={clearSelection}
              onAttach={(resource, agent) => void attach(resource, agent)}
              onDetach={(resource, agent) => void detach(resource, agent)}
              onCreate={create}
              onDelete={setConfirmDelete}
              onSourceState={setSourceState}
            />
          )}
        </InspectorColumn>

        <SkillImportDialog projectId={projectId} open={importOpen} onClose={() => setImportOpen(false)} />

        <ConfirmDialog
          open={Boolean(confirmDelete)}
          onOpenChange={(open) => {
            if (!open) setConfirmDelete(undefined);
          }}
          title={`Delete ${confirmDelete?.name ?? ""}?`}
          description={
            confirmDelete?.kind === "subagent"
              ? "This removes the subagent's folder with everything defined inside it. Commit first if you might want it back."
              : confirmDelete?.shared
                ? `This removes ${confirmDelete.filePath} and the re-export from all ${confirmDelete.usedBy?.length ?? 0} agents using it.`
                : `This removes ${confirmDelete?.filePath ?? "the file"} from the project. Commit first if you might want it back.`
          }
          confirmLabel="Delete"
          onConfirm={() => void removeNode()}
        />
      </div>
    </CanvasContext.Provider>
  );
}

export function CanvasView(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
