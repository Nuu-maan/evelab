"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  useViewport,
  type Connection,
  type IsValidConnection,
  type NodeMouseHandler,
} from "@xyflow/react";
import { AnimatePresence } from "motion/react";
import { IconFullscreen, IconMinus, IconPlus } from "@/components/icons";
import type { CanvasGraph, CanvasNode, CanvasNodeKind } from "@evelab/eve-project";
import {
  OwnershipConnectionLine,
  OwnershipEdgePath,
  type OwnershipEdge,
} from "@/components/canvas/canvas-edge";
import {
  CanvasNodeCard,
  type CanvasNodeData,
  type CapabilityNode,
} from "@/components/canvas/canvas-node";
import { CanvasInspector } from "@/components/canvas/canvas-inspector";
import { CanvasCreatePanel, type DraftKind } from "@/components/canvas/canvas-create-panel";
import { PaletteChip } from "@/components/canvas/palette-chip";
import { fallbackPositions, type Positions } from "@/components/canvas/layout";
import { Icon } from "@/components/icon";
import { ResizeHandle } from "@/components/resize-handle";
import { SkillImportDialog } from "@/components/skill-import-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { changeOwnershipAction, saveLayoutAction } from "@/lib/actions";
import "@/app/canvas.css";

const nodeTypes = { capability: CanvasNodeCard };
const edgeTypes = { ownership: OwnershipEdgePath };

export interface CanvasProps {
  projectId: string;
  graph: CanvasGraph;
  /** Contents of each node's file, so selecting a node opens instantly. */
  contents: Record<string, string>;
  positions: Positions;
  defaultModel: string;
  /** Where the agent lives: "agent" or "" for the flat layout. */
  root: string;
}

type PaletteKind = DraftKind | "skill";

function palette(root: string): { kind: PaletteKind; title: string; detail: string }[] {
  const base = root ? `${root}/` : "";
  return [
    { kind: "tool", title: "TypeScript tool", detail: `${base}tools/<name>.ts` },
    { kind: "subagent", title: "Subagent", detail: `${base}subagents/<name>/` },
    { kind: "connection", title: "Connection", detail: "MCP or OpenAPI" },
    { kind: "skill", title: "Skill", detail: "Import from GitHub" },
  ];
}

const MOVABLE = new Set<CanvasNodeKind>(["tool", "skill", "connection"]);

function nodeData(node: CanvasNode, fresh: boolean): CanvasNodeData {
  const { name, detail, description, counts, filePath, kind } = node;
  return { name, detail, description, counts, filePath, kind, fresh };
}

/** Whether a refreshed node would render exactly as the one on screen. */
function sameData(previous: CanvasNodeData, node: CanvasNode): boolean {
  return (
    previous.name === node.name &&
    previous.detail === node.detail &&
    previous.description === node.description &&
    previous.filePath === node.filePath &&
    JSON.stringify(previous.counts) === JSON.stringify(node.counts)
  );
}

function toEdge(source: string, target: string, kind: CanvasNodeKind): OwnershipEdge {
  // Tools, skills and connections can change hands; a subagent's place is its directory.
  const movable = MOVABLE.has(kind);
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: "ownership",
    className: `edge-${kind}`,
    reconnectable: movable,
    interactionWidth: 24,
    data: { movable },
  };
}

function ControlButton({
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
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={label}
          className={className}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function CanvasControls() {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <div className="canvas-controls" role="toolbar" aria-label="Canvas view">
      <ControlButton label="Zoom out" tooltip="Zoom out" onClick={() => void zoomOut({ duration: 200 })}>
        <Icon icon={IconMinus} />
      </ControlButton>
      <ControlButton
        label="Reset zoom to 100%"
        tooltip="Reset zoom"
        className="w-12 text-xs tabular-nums text-muted-foreground"
        onClick={() => void zoomTo(1, { duration: 200 })}
      >
        {Math.round(zoom * 100)}%
      </ControlButton>
      <ControlButton label="Zoom in" tooltip="Zoom in" onClick={() => void zoomIn({ duration: 200 })}>
        <Icon icon={IconPlus} />
      </ControlButton>
      <span className="canvas-controls-separator" aria-hidden="true" />
      <ControlButton
        label="Fit to screen"
        tooltip="Fit to screen"
        onClick={() => void fitView({ duration: 240, padding: 0.25, maxZoom: 1 })}
      >
        <Icon icon={IconFullscreen} />
      </ControlButton>
    </div>
  );
}

function CanvasInner({ projectId, graph, contents, positions, defaultModel, root }: CanvasProps) {
  const router = useRouter();
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [draft, setDraft] = useState<{ kind: DraftKind; x: number; y: number } | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone?: "error" } | undefined>();
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Where a node created from a palette drop should appear once the server has it. */
  const pending = useRef<Positions>({});
  const reconnecting = useRef<{ edge: OwnershipEdge; connected: boolean } | undefined>(undefined);
  const renderedGraph = useRef(graph);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [dropTarget, setDropTarget] = useState(false);

  const kinds = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node.kind] as const)),
    [graph.nodes],
  );
  const graphEdges = useMemo(
    () => graph.edges.map((edge) => toEdge(edge.source, edge.target, kinds.get(edge.target) ?? "tool")),
    [graph.edges, kinds],
  );

  // React Flow owns node state so it can keep measured sizes between renders.
  // Rebuilding nodes from props on every drag frame is what made them blink.
  const [nodes, setNodes, onNodesChange] = useNodesState<CapabilityNode>(
    useMemo(() => {
      const layout = { ...fallbackPositions(graph), ...positions };
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
  const [edges, setEdges] = useState<OwnershipEdge[]>(graphEdges);

  // Merge a refreshed graph into the live nodes, keeping positions, measurements
  // and selection for everything that already exists.
  useEffect(() => {
    if (renderedGraph.current === graph) return;
    renderedGraph.current = graph;
    const fallback = fallbackPositions(graph);
    setNodes((current) => {
      const existing = new Map(current.map((node) => [node.id, node]));
      return graph.nodes.map((node) => {
        const previous = existing.get(node.id);
        if (previous) {
          return sameData(previous.data, node) ? previous : { ...previous, data: nodeData(node, previous.data.fresh) };
        }
        const position = pending.current[node.id] ?? positions[node.id] ?? fallback[node.id];
        delete pending.current[node.id];
        return {
          id: node.id,
          type: "capability" as const,
          position: position ?? { x: 0, y: 0 },
          data: nodeData(node, true),
        };
      });
    });
    setEdges(graphEdges);
  }, [graph, graphEdges, positions, setNodes]);

  const persist = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const next: Positions = {};
      for (const node of getNodes()) {
        next[node.id] = { x: Math.round(node.position.x), y: Math.round(node.position.y) };
      }
      void saveLayoutAction(projectId, { ...next, ...pending.current });
    }, 400);
  }, [getNodes, projectId]);

  /** Applies an ownership change optimistically, then lets the server have the last word. */
  const changeOwnership = useCallback(
    async (
      change: { capability: string; to: string },
      optimistic: (edges: OwnershipEdge[]) => OwnershipEdge[],
    ) => {
      setEdges(optimistic);
      setNotice(undefined);
      const result = await changeOwnershipAction({ projectId, ...change });
      if (!result.ok) {
        setEdges(graphEdges);
        setNotice({ text: result.message, tone: "error" });
      }
      router.refresh();
    },
    [graphEdges, projectId, router],
  );

  const isValidConnection = useCallback<IsValidConnection<OwnershipEdge>>(
    (connection) => {
      const source = kinds.get(connection.source);
      const target = kinds.get(connection.target);
      if (source !== "agent" && source !== "subagent") return false;
      if (!target || !MOVABLE.has(target)) return false;
      const moving = reconnecting.current?.edge;
      // A new edge from the agent says nothing: it already owns whatever no subagent claims.
      if (source === "agent" && !moving) return false;
      return !edges.some(
        (edge) =>
          edge.source === connection.source &&
          edge.target === connection.target &&
          edge.id !== moving?.id,
      );
    },
    [edges, kinds],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const kind = kinds.get(connection.target) ?? "tool";
      void changeOwnership(
        { capability: connection.target, to: connection.source },
        (current) => [
          ...current.filter((edge) => edge.target !== connection.target),
          toEdge(connection.source, connection.target, kind),
        ],
      );
    },
    [changeOwnership, kinds],
  );

  const onReconnect = useCallback(
    (previous: OwnershipEdge, connection: Connection) => {
      if (reconnecting.current) reconnecting.current.connected = true;
      if (previous.source === connection.source && previous.target === connection.target) return;
      const kind = kinds.get(connection.target) ?? "tool";
      void changeOwnership(
        { capability: previous.target, to: connection.source },
        (current) => [
          ...current.filter((edge) => edge.id !== previous.id),
          toEdge(connection.source, connection.target, kind),
        ],
      );
    },
    [changeOwnership, kinds],
  );

  const onReconnectEnd = useCallback(
    (_: unknown, edge: OwnershipEdge) => {
      const state = reconnecting.current;
      reconnecting.current = undefined;
      if (state?.connected) return;
      if (edge.source === "agent") {
        setNotice({ text: "Drop the end on a subagent to hand this over" });
        return;
      }
      // Dropped on empty canvas: the subagent lets go, and the agent picks it up.
      void changeOwnership(
        { capability: edge.target, to: "agent" },
        (current) => current.filter((candidate) => candidate.id !== edge.id),
      );
    },
    [changeOwnership],
  );

  const onNodeClick = useCallback<NodeMouseHandler<CapabilityNode>>((_, node) => {
    setDraft(undefined);
    setImportOpen(false);
    setNotice(undefined);
    setSelectedId(node.id);
  }, []);

  const closeInspector = useCallback(() => {
    setSelectedId(undefined);
    setNodes((current) =>
      current.some((node) => node.selected)
        ? current.map((node) => (node.selected ? { ...node, selected: false } : node))
        : current,
    );
  }, [setNodes]);

  const openDraft = (kind: PaletteKind, point = { x: 0, y: 260 }) => {
    closeInspector();
    if (kind === "skill") setImportOpen(true);
    else setDraft({ kind, ...point });
  };

  const overSurface = useCallback((point: { x: number; y: number }) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    return Boolean(rect && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom);
  }, []);

  const selected: CanvasNode | undefined = graph.nodes.find((node) => node.id === selectedId);

  const hint = notice
    ? notice
    : graph.nodes.length === 1
      ? { text: "Drag a tool or subagent from the left to start building" }
      : { text: "Click a node to open its file. Select an edge, then drag an end to move it to another agent." };

  return (
    <div className="canvas-layout">
      <aside className="canvas-palette" aria-label="Add to canvas">
        <div className="canvas-palette-scroll">
          <p className="canvas-palette-label">Add to canvas</p>

          {palette(root).map((item) => (
            <PaletteChip
              key={item.kind}
              item={item}
              onActivate={() => openDraft(item.kind)}
              canDrop={overSurface}
              onHoverDrop={setDropTarget}
              onDrop={(point) => openDraft(item.kind, screenToFlowPosition(point))}
            />
          ))}

          <div className="canvas-palette-hint">
            <p>Drag a chip onto the canvas, or press Enter on it.</p>
            <p>
              Edges are ownership. Drag an edge&apos;s end onto a subagent to move that file into its
              directory; drop it on empty canvas to give it back.
            </p>
          </div>
        </div>

        <ResizeHandle pane="palette" label="Resize palette" />
      </aside>

      <div className="canvas-surface" ref={surfaceRef} data-drop-target={dropTarget || undefined}>
        <ReactFlow<CapabilityNode, OwnershipEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onNodeDragStop={persist}
          onPaneClick={() => setSelectedId(undefined)}
          onEdgesChange={(changes) =>
            setEdges((current) => {
              const selection = new Map(
                changes.flatMap((change) => (change.type === "select" ? [[change.id, change.selected]] : [])),
              );
              if (selection.size === 0) return current;
              return current.map((edge) =>
                selection.has(edge.id) ? { ...edge, selected: selection.get(edge.id) } : edge,
              );
            })
          }
          onConnect={onConnect}
          onReconnect={onReconnect}
          onReconnectStart={(_, edge) => {
            reconnecting.current = { edge, connected: false };
          }}
          onReconnectEnd={onReconnectEnd}
          isValidConnection={isValidConnection}
          edgesReconnectable
          reconnectRadius={18}
          connectionRadius={36}
          connectionLineComponent={OwnershipConnectionLine}
          elevateEdgesOnSelect
          // Nodes are files; removing one is a confirmed action in the inspector, never a keypress.
          deleteKeyCode={null}
          // React Flow asks open projects without a Pro plan to keep its attribution.
          attributionPosition="bottom-right"
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
          minZoom={0.3}
          maxZoom={1.75}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--canvas-dot)" />
          <CanvasControls />
        </ReactFlow>

        {!selected && !draft && (
          <p className="canvas-hint" role="status" data-tone={hint.tone}>
            {hint.text}
          </p>
        )}

        <AnimatePresence>
          {selected && (
            <CanvasInspector
              key={selected.id}
              projectId={projectId}
              node={selected}
              content={contents[selected.filePath] ?? ""}
              onClose={closeInspector}
            />
          )}

          {draft && !selected && (
            <CanvasCreatePanel
              key={`draft-${draft.kind}`}
              projectId={projectId}
              kind={draft.kind}
              root={root}
              defaultModel={defaultModel}
              onClose={() => setDraft(undefined)}
              onSubmitted={(entityId) => {
                // Keep the new node where it was dropped.
                pending.current[`${draft.kind}:${entityId}`] = {
                  x: Math.round(draft.x),
                  y: Math.round(draft.y),
                };
                persist();
                setDraft(undefined);
              }}
            />
          )}
        </AnimatePresence>
      </div>

      <SkillImportDialog
        projectId={projectId}
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </div>
  );
}

export function CanvasView(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
