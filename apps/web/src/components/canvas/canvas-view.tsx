"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AnimatePresence } from "motion/react";
import type { CanvasGraph, CanvasNode } from "@evelab/eve-project";
import { CanvasNodeCard, type CanvasNodeData } from "@/components/canvas/canvas-node";
import { CanvasInspector } from "@/components/canvas/canvas-inspector";
import { CanvasCreatePanel, type DraftKind } from "@/components/canvas/canvas-create-panel";
import { SkillImportDialog } from "@/components/skill-import-dialog";
import { saveLayoutAction } from "@/lib/actions";

const nodeTypes = { capability: CanvasNodeCard };

export interface CanvasProps {
  projectId: string;
  graph: CanvasGraph;
  /** Contents of each node's file, so selecting a node opens instantly. */
  contents: Record<string, string>;
  positions: Record<string, { x: number; y: number }>;
  defaultModel: string;
}

const COLUMN = 268;
const ROW = 190;

/**
 * Tidy tree layout, used until the user drags something.
 *
 * Children sit under the node that owns them and siblings share the width of
 * their subtree, so the default picture has no crossing edges.
 */
function fallbackPositions(graph: CanvasGraph): Record<string, { x: number; y: number }> {
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const edge of graph.edges) {
    if (hasParent.has(edge.target)) continue;
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
    hasParent.add(edge.target);
  }

  const width = (id: string): number => {
    const kids = children.get(id) ?? [];
    if (kids.length === 0) return 1;
    return kids.reduce((total, kid) => total + width(kid), 0);
  };

  const positions: Record<string, { x: number; y: number }> = {};

  const place = (id: string, left: number, depth: number): void => {
    const span = width(id);
    positions[id] = { x: (left + span / 2 - 0.5) * COLUMN, y: depth * ROW };
    let cursor = left;
    for (const kid of children.get(id) ?? []) {
      place(kid, cursor, depth + 1);
      cursor += width(kid);
    }
  };

  const roots = graph.nodes.filter((node) => !hasParent.has(node.id));
  let cursor = 0;
  for (const root of roots) {
    place(root.id, cursor, 0);
    cursor += width(root.id);
  }

  // Anything unreachable from a root still needs somewhere to sit.
  let orphan = 0;
  for (const node of graph.nodes) {
    if (!positions[node.id]) {
      positions[node.id] = { x: orphan++ * COLUMN, y: (roots.length + 2) * ROW };
    }
  }

  return positions;
}

function CanvasInner({ projectId, graph, contents, positions, defaultModel }: CanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [draft, setDraft] = useState<{ kind: DraftKind; x: number; y: number } | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [layout, setLayout] = useState<Record<string, { x: number; y: number }>>(() => ({
    ...fallbackPositions(graph),
    ...positions,
  }));
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Nodes added outside the canvas still need a position.
  useEffect(() => {
    setLayout((current) => {
      const fallback = fallbackPositions(graph);
      const next = { ...current };
      let changed = false;
      for (const node of graph.nodes) {
        if (!next[node.id]) {
          next[node.id] = fallback[node.id] ?? { x: 0, y: 0 };
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [graph]);

  const persist = useCallback(
    (next: Record<string, { x: number; y: number }>) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void saveLayoutAction(projectId, next), 500);
    },
    [projectId],
  );

  const nodes = useMemo<Node<CanvasNodeData>[]>(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: "capability",
        position: layout[node.id] ?? { x: 0, y: 0 },
        data: {
          name: node.name,
          detail: node.detail,
          filePath: node.filePath,
          kind: node.kind,
          selected: node.id === selectedId,
        },
      })),
    [graph.nodes, layout, selectedId],
  );

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => ({
        id: `${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
      })),
    [graph.edges],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<CanvasNodeData>>[]) => {
      let moved = false;
      setLayout((current) => {
        const next = { ...current };
        for (const change of changes) {
          if (change.type === "position" && change.position) {
            next[change.id] = { x: change.position.x, y: change.position.y };
            moved = true;
          }
        }
        if (moved) persist(next);
        return moved ? next : current;
      });
    },
    [persist],
  );

  const onNodeClick = useCallback<NodeMouseHandler<Node<CanvasNodeData>>>((_, node) => {
    setDraft(undefined);
    setImportOpen(false);
    setSelectedId(node.id);
  }, []);

  const selected: CanvasNode | undefined = graph.nodes.find((node) => node.id === selectedId);

  return (
    <div className="canvas-layout">
      <aside className="canvas-palette" aria-label="Add to canvas">
        <p className="sidebar-group-label">Drag onto canvas</p>

        {(["tool", "subagent"] as const).map((kind) => (
          <div
            key={kind}
            className="palette-chip"
            draggable
            role="button"
            tabIndex={0}
            onDragStart={(event) => {
              event.dataTransfer.setData("application/evelab-kind", kind);
              event.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => setDraft({ kind, x: 0, y: 260 })}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setDraft({ kind, x: 0, y: 260 });
              }
            }}
          >
            <span className="palette-chip-title">
              {kind === "tool" ? "TypeScript tool" : "Subagent"}
            </span>
            <span className="palette-chip-detail">
              {kind === "tool" ? "tools/<name>.ts" : "subagents/<id>.md"}
            </span>
          </div>
        ))}

        <div
          className="palette-chip"
          draggable
          role="button"
          tabIndex={0}
          onDragStart={(event) => {
            event.dataTransfer.setData("application/evelab-kind", "skill");
            event.dataTransfer.effectAllowed = "move";
          }}
          onClick={() => setImportOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setImportOpen(true);
            }
          }}
        >
          <span className="palette-chip-title">Skill</span>
          <span className="palette-chip-detail">Import from GitHub</span>
        </div>

        <p className="canvas-palette-hint">
          Drop a chip on the canvas, or press Enter on it. Click any node to edit the file behind it.
        </p>
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
          if (!kind) return;
          event.preventDefault();
          const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          setSelectedId(undefined);
          if (kind === "skill") {
            setImportOpen(true);
            return;
          }
          if (kind === "tool" || kind === "subagent") {
            setDraft({ kind, x: point.x, y: point.y });
          }
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedId(undefined)}
          nodesConnectable={false}
          fitView
          minZoom={0.4}
          maxZoom={1.6}
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={22} size={1} color="var(--border-strong)" />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>

        {!selected && !draft && (
          <p className="canvas-hint">
            {graph.nodes.length === 1
              ? "Drag a tool or subagent from the left to start building"
              : "Click a node to open its file"}
          </p>
        )}

        <AnimatePresence>
          {selected && (
            <CanvasInspector
              key={selected.id}
              projectId={projectId}
              node={selected}
              content={contents[selected.filePath] ?? ""}
              onClose={() => setSelectedId(undefined)}
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
                const id = `${draft.kind}:${entityId}`;
                setLayout((current) => {
                  const next = { ...current, [id]: { x: draft.x, y: draft.y } };
                  persist(next);
                  return next;
                });
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
