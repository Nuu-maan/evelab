"use client";

import { useMemo, useState } from "react";
import type { CanvasNode, CanvasNodeKind } from "@evelab/eve-project";
import { IconFileText, IconGridSquare, IconMagnifyingGlass, IconPlus } from "@/components/icons";
import { PaletteChip } from "@/components/canvas/palette-chip";
import { isResourceKind } from "@/components/canvas/canvas-node";
import type { Annotation } from "@/components/canvas/layout";
import { Icon } from "@/components/icon";
import { KINDS } from "@/components/kinds";

type Point = { x: number; y: number };
type GroupKind = Exclude<CanvasNodeKind, "agent">;

const GROUPS: GroupKind[] = ["subagent", "tool", "skill", "connection", "channel"];

const ANNOTATE: { type: Annotation["type"]; title: string; detail: string; icon: typeof IconFileText }[] = [
  { type: "note", title: "Note", detail: "Handwritten text", icon: IconFileText },
  { type: "section", title: "Section", detail: "Group things together", icon: IconGridSquare },
];

/**
 * A floating library of everything the architecture is made of, grouped by
 * kind. Resources are picked up and dropped onto an agent to attach them;
 * notes and sections are dropped anywhere.
 */
export function ResourceBrowser({
  nodes,
  selectedId,
  onSelect,
  onCreate,
  canDrop,
  onDrop,
  onHoverDrop,
  canPlace,
  onAnnotate,
}: {
  nodes: CanvasNode[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreate: (kind: GroupKind) => void;
  canDrop: (resourceId: string, point: Point) => boolean;
  onDrop: (resourceId: string, point: Point) => void;
  onHoverDrop: (over: boolean) => void;
  canPlace: (point: Point) => boolean;
  onAnnotate: (type: Annotation["type"], point?: Point) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const groups = useMemo(
    () =>
      GROUPS.map((kind) => ({
        kind,
        items: nodes
          .filter((node) => node.kind === kind)
          .filter(
            (node) =>
              !needle ||
              node.name.toLowerCase().includes(needle) ||
              node.detail.toLowerCase().includes(needle) ||
              node.description?.toLowerCase().includes(needle),
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      })),
    [needle, nodes],
  );

  return (
    <aside className="canvas-float canvas-browser" aria-label="Resources">
      <label className="browser-search">
        <Icon icon={IconMagnifyingGlass} size={14} />
        <input
          type="search"
          value={query}
          placeholder="Search"
          aria-label="Search resources"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
        />
      </label>

      <div className="browser-list">
        {groups.map((group) => {
          if (needle && group.items.length === 0) return null;
          const { label, plural } = KINDS[group.kind];
          return (
            <section key={group.kind} className="browser-group" aria-label={plural}>
              <div className="browser-group-head">
                <p className="browser-group-label">{plural}</p>
                <button
                  type="button"
                  className="browser-group-add"
                  aria-label={`New ${label.toLowerCase()}`}
                  title={`New ${label.toLowerCase()}`}
                  onClick={() => onCreate(group.kind)}
                >
                  <Icon icon={IconPlus} size={12} />
                </button>
              </div>
              {group.items.length === 0 && (
                <button type="button" className="browser-empty-row" onClick={() => onCreate(group.kind)}>
                  New {label.toLowerCase()}
                </button>
              )}
              {group.items.map((node) => {
                const users = node.usedBy?.length ?? 0;
                return (
                  <PaletteChip
                    key={node.id}
                    variant="row"
                    draggable={isResourceKind(node.kind)}
                    selected={node.id === selectedId}
                    item={{ kind: node.kind, title: node.name, detail: node.detail }}
                    badge={node.shared ? `${users}` : undefined}
                    dropLabel="Release to attach"
                    onActivate={() => onSelect(node.id)}
                    canDrop={(point) => canDrop(node.id, point)}
                    onDrop={(point) => onDrop(node.id, point)}
                    onHoverDrop={onHoverDrop}
                  />
                );
              })}
            </section>
          );
        })}

        {!needle && (
          <section className="browser-group" aria-label="Annotate">
            <div className="browser-group-head">
              <p className="browser-group-label">Annotate</p>
            </div>
            {ANNOTATE.map((item) => (
              <PaletteChip
                key={item.type}
                variant="row"
                item={{
                  title: item.title,
                  detail: item.detail,
                  tile: (
                    <span className="kind-tile annotate-tile">
                      <Icon icon={item.icon} size={14} />
                    </span>
                  ),
                }}
                dropLabel="Release to place"
                onActivate={() => onAnnotate(item.type)}
                canDrop={canPlace}
                onDrop={(point) => onAnnotate(item.type, point)}
                onHoverDrop={() => {}}
              />
            ))}
          </section>
        )}
      </div>
    </aside>
  );
}
