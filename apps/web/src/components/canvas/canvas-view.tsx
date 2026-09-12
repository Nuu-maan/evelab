"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type Edge,
  type IsValidConnection,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { AnimatePresence } from "motion/react";
import { Maximize, Minus, Plus } from "lucide-react";
import type { CanvasGraph, CanvasNode, CanvasNodeKind, CapabilityLink } from "@evelab/eve-project";
import {
  CanvasNodeCard,
  type CanvasNodeData,
  type CapabilityNode,
} from "@/components/canvas/canvas-node";
import { CanvasInspector } from "@/components/canvas/canvas-inspector";
import { CanvasCreatePanel, type DraftKind } from "@/components/canvas/canvas-create-panel";
import { fallbackPositions, type Positions } from "@/components/canvas/layout";
import { KindTile } from "@/components/kinds";
import { ResizeHandle } from "@/components/resize-handle";
import { SkillImportDialog } from "@/components/skill-import-dialog";
import { changeOwnershipAction, saveLayoutAction } from "@/lib/actions";
import "@/app/canvas.css";

const nodeTypes = { capability: CanvasNodeCard };

export interface CanvasProps {
  projectId: string;
  graph: CanvasGraph;
  /** Contents of each node's file, so selecting a node opens instantly. */
  contents: Record<string, string>;
  positions: Positions;
  defaultModel: string;
}

const PALETTE: { kind: DraftKind | "skill"; title: string; detail: string }[] = [
  { kind: "tool", title: "TypeScript tool", detail: "tools/<name>.ts" },
  { kind: "subagent", title: "Subagent", detail: "subagents/<id>.md" },
  { kind: "skill", title: "Skill", detail: "Import from GitHub" },
];

function nodeData(node: CanvasNode, fresh: boolean): CanvasNodeData {
  return { name: node.name, detail: node.detail, filePath: node.filePath, kind: node.kind, fresh };
}

function toEdge(source: string, target: string, kind: CanvasNodeKind): Edge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    className: `edge-${kind}`,
    // Ownership of tools and skills is editable; a subagent always belongs to the agent.
    reconnectable: kind === "tool" || kind === "skill",
    interactionWidth: 24,
  };
}

function CanvasControls() {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <div className="canvas-controls" role="toolbar" aria-label="Canvas view">
      <button
        className="canvas-control"
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        onClick={() => void zoomOut({ duration: 200 })}
      >
        <Minus aria-hidden="true" strokeWidth={1.5} />
      </button>
      <button
        className="canvas-control canvas-zoom"
        type="button"
        aria-label="Reset zoom to 100%"
        title="Reset zoom"
        onClick={() => void zoomTo(1, { duration: 200 })}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        className="canvas-control"
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        onClick={() => void zoomIn({ duration: 200 })}
      >
        <Plus aria-hidden="true" strokeWidth={1.5} />
      </button>
      <span className="canvas-controls-separator" aria-hidden="true" />
      <button
        className="canvas-control"
        type="button"
        aria-label="Fit to screen"
        title="Fit to screen"
        onClick={() => void fitView({ duration: 240, padding: 0.25, maxZoom: 1 })}
      >
        <Maximize aria-hidden="true" strokeWidth={1.5} />
      </button>
    </div>
  );
}

function CanvasInner({ projectId, graph, contents, positions, defaultModel }: CanvasProps) {
  const router = useRouter();
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [draft, setDraft] = useState<{ kind: DraftKind; x: number; y: number } | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone?: "error" } | undefined>();
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Where a node created from a palette drop should appear once the server has it. */
  const pending = useRef<Positions>({});
  const reconnecting = useRef<{ edge: Edge; connected: boolean } | undefined>(undefined);
  const renderedGraph = useRef(graph);

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
  const [edges, setEdges] = useState<Edge[]>(graphEdges);

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
          const { name, detail, filePath } = previous.data;
          const same = name === node.name && detail === node.detail && filePath === node.filePath;
          return same ? previous : { ...previous, data: nodeData(node, previous.data.fresh) };
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
    async (change: { remove?: CapabilityLink; add?: CapabilityLink }, optimistic: (edges: Edge[]) => Edge[]) => {
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

  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => {
      const source = kinds.get(connection.source);
      const target = kinds.get(connection.target);
      if (source !== "agent" && source !== "subagent") return false;
      if (target !== "tool" && target !== "skill") return false;
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
        { add: { owner: connection.source, capability: connection.target } },
        (current) => [
          ...current.filter((edge) => edge.id !== `agent->${connection.target}`),
          toEdge(connection.source, connection.target, kind),
        ],
      );
    },
    [changeOwnership, kinds],
  );

  const onReconnect = useCallback(
    (previous: Edge, connection: Connection) => {
      if (reconnecting.current) reconnecting.current.connected = true;
      if (previous.source === connection.source && previous.target === connection.target) return;
      const kind = kinds.get(connection.target) ?? "tool";
      void changeOwnership(
        {
          remove: { owner: previous.source, capability: previous.target },
          add: { owner: connection.source, capability: connection.target },
        },
        (current) => [
          ...current.filter((edge) => edge.id !== previous.id),
          toEdge(connection.source, connection.target, kind),
        ],
      );
    },
    [changeOwnership, kinds],
  );

  const onReconnectEnd = useCallback(
    (_: unknown, edge: Edge) => {
      const state = reconnecting.current;
      reconnecting.current = undefined;
      if (state?.connected) return;
      if (edge.source === "agent") {
        setNotice({ text: "Drop the end on a subagent to hand this over" });
        return;
      }
      // Dropped on empty canvas: the subagent lets go, and the agent picks it up.
      void changeOwnership(
        { remove: { owner: edge.source, capability: edge.target } },
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

  const openDraft = (kind: DraftKind | "skill", point = { x: 0, y: 260 }) => {
    closeInspector();
    if (kind === "skill") setImportOpen(true);
    else setDraft({ kind, ...point });
  };

  const selected: CanvasNode | undefined = graph.nodes.find((node) => node.id === selectedId);

  const hint = notice
    ? notice
    : graph.nodes.length === 1
      ? { text: "Drag a tool or subagent from the left to start building" }
      : { text: "Click a node to open its file. Drag an edge end to move ownership." };

  return (
    <div className="canvas-layout">
      <aside className="canvas-palette" aria-label="Add to canvas">
        <p className="canvas-palette-label">Add to canvas</p>

        {PALETTE.map((item) => (
          <div
            key={item.kind}
            className="palette-chip"
            data-kind={item.kind}
            draggable
            role="button"
            tabIndex={0}
            onDragStart={(event) => {
              event.dataTransfer.setData("application/evelab-kind", item.kind);
              event.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => openDraft(item.kind)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDraft(item.kind);
              }
            }}
          >
            <KindTile kind={item.kind} />
            <span className="palette-chip-text">
              <span className="palette-chip-title">{item.title}</span>
              <span className="palette-chip-detail mono">{item.detail}</span>
            </span>
          </div>
        ))}

        <p className="canvas-palette-hint">
          Drop a chip on the canvas, or press Enter on it. Edges show who can use what: drag the end
          of one onto a subagent to hand a tool or skill over, or onto empty canvas to give it back
          to the agent.
        </p>

        <ResizeHandle pane="palette" label="Resize palette" />
      </aside>

      <div
        className="canvas-surface"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("application/evelab-kind")) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(event) => {
          const kind = event.dataTransfer.getData("application/evelab-kind");
          if (kind !== "tool" && kind !== "subagent" && kind !== "skill") return;
          event.preventDefault();
          openDraft(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        }}
      >
        <ReactFlow<CapabilityNode, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onNodeDragStop={persist}
          onPaneClick={() => setSelectedId(undefined)}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onReconnectStart={(_, edge) => {
            reconnecting.current = { edge, connected: false };
          }}
          onReconnectEnd={onReconnectEnd}
          isValidConnection={isValidConnection}
          edgesReconnectable
          reconnectRadius={14}
          connectionLineStyle={{ strokeDasharray: "4 4" }}
          // Nodes are files; removing one is a confirmed action in the inspector, never a keypress.
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
          minZoom={0.3}
          maxZoom={1.75}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="var(--border-strong)" />
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
