"use client";

import { useMemo, useState } from "react";
import type { CanvasNode, CanvasNodeKind } from "@evelab/eve-project";
import { IconMagnifyingGlass, IconPlus } from "@/components/icons";
import { PaletteChip } from "@/components/canvas/palette-chip";
import { isResourceKind } from "@/components/canvas/canvas-node";
import { Icon } from "@/components/icon";
import { KINDS, KindTile } from "@/components/kinds";
import { ResizeHandle } from "@/components/resize-handle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Point = { x: number; y: number };
type Filter = "all" | Exclude<CanvasNodeKind, "agent">;

const GROUPS: Exclude<CanvasNodeKind, "agent">[] = ["subagent", "tool", "skill", "connection", "channel"];

/**
 * Everything the architecture is made of, in one searchable list. Resources
 * are picked up and dropped onto an agent to attach them; anything can be
 * clicked to find it on the canvas.
 */
export function ResourceBrowser({
  nodes,
  selectedId,
  onSelect,
  onCreate,
  canDrop,
  onDrop,
  onHoverDrop,
}: {
  nodes: CanvasNode[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreate: (kind: Exclude<CanvasNodeKind, "agent">) => void;
  canDrop: (resourceId: string, point: Point) => boolean;
  onDrop: (resourceId: string, point: Point) => void;
  onHoverDrop: (over: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return GROUPS.filter((kind) => filter === "all" || filter === kind)
      .map((kind) => ({
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
      }))
      .filter((group) => group.items.length > 0);
  }, [filter, nodes, query]);

  const total = nodes.filter((node) => node.kind !== "agent").length;

  return (
    <aside className="canvas-browser" aria-label="Resources">
      <div className="browser-head">
        <div className="browser-title-row">
          <p className="browser-title">Resources</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Create a resource">
                <Icon icon={IconPlus} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {GROUPS.map((kind) => (
                <DropdownMenuItem key={kind} onSelect={() => onCreate(kind)}>
                  <KindTile kind={kind} />
                  New {KINDS[kind].label.toLowerCase()}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <label className="browser-search">
          <Icon icon={IconMagnifyingGlass} size={14} />
          <input
            type="search"
            value={query}
            placeholder="Search resources"
            aria-label="Search resources"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
          />
        </label>

        <div className="browser-filters" role="group" aria-label="Filter by kind">
          {(["all", ...GROUPS] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              className="browser-filter"
              data-kind={value === "all" ? undefined : value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "All" : KINDS[value].plural}
            </button>
          ))}
        </div>
      </div>

      <div className="browser-list">
        {groups.map((group) => (
          <section key={group.kind} className="browser-group" aria-label={KINDS[group.kind].plural}>
            <p className="browser-group-label">
              {KINDS[group.kind].plural}
              <span className="tabular-nums">{group.items.length}</span>
            </p>
            {group.items.map((node) => {
              const attachable = isResourceKind(node.kind);
              const users = node.usedBy?.length ?? 0;
              return (
                <PaletteChip
                  key={node.id}
                  variant="row"
                  draggable={attachable}
                  selected={node.id === selectedId}
                  item={{ kind: node.kind, title: node.name, detail: node.detail }}
                  badge={node.shared ? `${users} ${users === 1 ? "agent" : "agents"}` : undefined}
                  dropLabel="Release to attach"
                  onActivate={() => onSelect(node.id)}
                  canDrop={(point) => canDrop(node.id, point)}
                  onDrop={(point) => onDrop(node.id, point)}
                  onHoverDrop={onHoverDrop}
                />
              );
            })}
          </section>
        ))}

        {groups.length === 0 && (
          <p className="browser-empty">{total === 0 ? "Nothing here yet. Create a resource to start." : "No resources match."}</p>
        )}
      </div>

      <p className="browser-hint">Drag a tool, skill or connection onto an agent to attach it.</p>

      <ResizeHandle pane="palette" label="Resize resources" />
    </aside>
  );
}
