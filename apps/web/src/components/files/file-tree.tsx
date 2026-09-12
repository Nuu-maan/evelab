"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronRight, ListCollapse } from "lucide-react";
import { FileIcon, FolderIcon } from "@/components/files/file-icon";
import { ancestorsOf, buildFileTree, visibleRows } from "@/components/files/tree";

/**
 * The project as an editor's explorer shows it: folders first, compacted
 * single-child chains, indent guides, and full keyboard support following the
 * WAI-ARIA tree pattern.
 */
export function FileTree({
  rootName,
  paths,
  current,
  dirty,
  onOpen,
}: {
  rootName: string;
  paths: string[];
  current: string;
  dirty: boolean;
  onOpen: (path: string) => void;
}) {
  const tree = useMemo(() => buildFileTree(paths), [paths]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(ancestorsOf(current)));
  const [focused, setFocused] = useState(current);
  const listRef = useRef<HTMLUListElement>(null);

  // A file opened from elsewhere, such as a ?path= link, is revealed.
  useEffect(() => {
    setExpanded((previous) => {
      const missing = ancestorsOf(current).filter((path) => !previous.has(path));
      return missing.length === 0 ? previous : new Set([...previous, ...missing]);
    });
    setFocused(current);
  }, [current]);

  const rows = useMemo(() => visibleRows(tree, expanded), [tree, expanded]);

  const toggle = (path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const focusRow = (path: string | undefined) => {
    if (path === undefined) return;
    setFocused(path);
    listRef.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const index = rows.findIndex((row) => row.node.path === focused);
    const row = rows[index];
    if (!row) return;
    const isDirectory = row.node.kind === "directory";
    const isOpen = isDirectory && expanded.has(row.node.path);

    switch (event.key) {
      case "ArrowDown":
        focusRow(rows[Math.min(index + 1, rows.length - 1)]?.node.path);
        break;
      case "ArrowUp":
        focusRow(rows[Math.max(index - 1, 0)]?.node.path);
        break;
      case "Home":
        focusRow(rows[0]?.node.path);
        break;
      case "End":
        focusRow(rows.at(-1)?.node.path);
        break;
      case "ArrowRight":
        if (isDirectory && !isOpen) toggle(row.node.path);
        else if (isOpen) focusRow(rows[index + 1]?.node.path);
        break;
      case "ArrowLeft":
        if (isOpen) {
          toggle(row.node.path);
        } else {
          const parent = rows
            .slice(0, index)
            .reverse()
            .find((other) => other.depth < row.depth);
          focusRow(parent?.node.path);
        }
        break;
      case "Enter":
      case " ":
        if (isDirectory) toggle(row.node.path);
        else onOpen(row.node.path);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div className="explorer">
      <div className="explorer-head">
        <span className="explorer-title">{rootName}</span>
        <button
          className="button"
          data-variant="ghost"
          data-size="icon-small"
          type="button"
          aria-label="Collapse folders"
          title="Collapse folders"
          onClick={() => setExpanded(new Set())}
        >
          <ListCollapse aria-hidden="true" strokeWidth={1.5} />
        </button>
      </div>

      <ul className="tree" role="tree" aria-label="Project files" ref={listRef} onKeyDown={onKeyDown}>
        {rows.map(({ node, depth }) => {
          const isDirectory = node.kind === "directory";
          const open = isDirectory && expanded.has(node.path);
          const selected = node.path === current;
          const segments = node.name.split("/");

          return (
            <li
              key={node.path}
              className="tree-row"
              role="treeitem"
              aria-level={depth + 1}
              aria-expanded={isDirectory ? open : undefined}
              aria-selected={selected}
              tabIndex={node.path === focused ? 0 : -1}
              data-path={node.path}
              onClick={() => {
                setFocused(node.path);
                if (isDirectory) toggle(node.path);
                else onOpen(node.path);
              }}
            >
              <span className="tree-guides" aria-hidden="true">
                {Array.from({ length: depth }, (_, level) => (
                  <span className="tree-guide" key={level} />
                ))}
              </span>
              {isDirectory ? (
                <ChevronRight
                  className="tree-chevron"
                  data-open={open || undefined}
                  aria-hidden="true"
                  strokeWidth={1.5}
                />
              ) : (
                <span className="tree-chevron" aria-hidden="true" />
              )}
              {isDirectory ? (
                <FolderIcon path={node.path} open={open} />
              ) : (
                <FileIcon name={node.name} />
              )}
              <span className="tree-name" data-muted={node.name.startsWith(".") || undefined}>
                {segments.map((segment, index) => (
                  <span key={`${segment}-${index}`}>
                    {index > 0 && <span className="tree-name-separator"> / </span>}
                    {segment}
                  </span>
                ))}
              </span>
              {selected && dirty && <span className="tree-dirty" title="Unsaved changes" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
