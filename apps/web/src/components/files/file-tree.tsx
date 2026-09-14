"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  IconChevronDoubleUp,
  IconChevronRight,
  IconFilePlus,
  IconFolderPlus,
  IconPencil,
  IconTrash,
} from "@/components/icons";
import { FileIcon, FolderIcon } from "@/components/files/file-icon";
import { ancestorsOf, buildFileTree, visibleRows } from "@/components/files/tree";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type EntryKind = "file" | "directory";

type Draft =
  | { mode: "create"; kind: EntryKind; parent: string }
  | { mode: "rename"; kind: EntryKind; path: string };

function parentOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

function lastSegment(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** The name being typed for a new or renamed entry: Enter commits, Escape or leaving it empty cancels. */
function DraftInput({
  initial,
  kind,
  label,
  error,
  onCommit,
  onCancel,
}: {
  initial: string;
  kind: EntryKind;
  label: string;
  error?: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    input.focus();
    // Renaming a file selects its name, not its extension, as editors do.
    const dot = kind === "file" ? initial.lastIndexOf(".") : -1;
    input.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial, kind]);

  const finish = (value: string) => {
    const name = value.trim();
    if (!name || name === initial) onCancel();
    else onCommit(name);
  };

  return (
    <input
      ref={ref}
      className="tree-input"
      aria-label={label}
      aria-invalid={error ? true : undefined}
      defaultValue={initial}
      spellCheck={false}
      autoComplete="off"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(event.currentTarget.value);
        if (event.key === "Escape") onCancel();
      }}
      onBlur={(event) => finish(event.currentTarget.value)}
    />
  );
}

/**
 * The project as an editor's explorer shows it: folders first, compacted
 * single-child chains, indent guides, and full keyboard support following the
 * WAI-ARIA tree pattern. New files and folders are named inline where they will
 * appear; F2 renames and Delete removes the focused entry.
 */
export function FileTree({
  rootName,
  paths,
  folders,
  current,
  dirty,
  onOpen,
  onCreate,
  onRename,
  onDelete,
}: {
  rootName: string;
  paths: string[];
  /** Every folder, including empty ones, so a new folder shows before it has files. */
  folders: string[];
  current: string;
  dirty: boolean;
  onOpen: (path: string) => void;
  /** Resolves to an error message when the entry could not be created. */
  onCreate: (kind: EntryKind, path: string) => Promise<string | undefined>;
  onRename: (from: string, to: string) => Promise<string | undefined>;
  onDelete: (path: string, kind: EntryKind) => void;
}) {
  const tree = useMemo(() => buildFileTree(paths, folders), [paths, folders]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(ancestorsOf(current)));
  const [focused, setFocused] = useState(current);
  const [draft, setDraft] = useState<Draft>();
  const [draftError, setDraftError] = useState<string>();
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

  const kindOf = (path: string): EntryKind => (rows.find((row) => row.node.path === path)?.node.kind ?? "file");

  /** New entries go inside the focused folder, or beside the focused file. */
  const startCreate = (kind: EntryKind) => {
    const focusedRow = rows.find((row) => row.node.path === focused);
    const parent = !focusedRow ? "" : focusedRow.node.kind === "directory" ? focusedRow.node.path : parentOf(focusedRow.node.path);
    if (parent) setExpanded((previous) => new Set([...previous, ...ancestorsOf(`${parent}/x`), parent]));
    setDraftError(undefined);
    setDraft({ mode: "create", kind, parent });
  };

  const startRename = (path: string) => {
    setDraftError(undefined);
    setDraft({ mode: "rename", kind: kindOf(path), path });
  };

  const commitDraft = async (name: string) => {
    if (!draft) return;
    const target =
      draft.mode === "create"
        ? draft.parent
          ? `${draft.parent}/${name}`
          : name
        : parentOf(draft.path)
          ? `${parentOf(draft.path)}/${name}`
          : name;
    const error = draft.mode === "create" ? await onCreate(draft.kind, target) : await onRename(draft.path, target);
    if (error) {
      setDraftError(error);
      return;
    }
    setDraft(undefined);
    setDraftError(undefined);
    setFocused(target);
  };

  const cancelDraft = () => {
    setDraft(undefined);
    setDraftError(undefined);
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
      case "F2":
        startRename(row.node.path);
        break;
      case "Delete":
        onDelete(row.node.path, row.node.kind);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  // Where the name for a new entry is typed: first inside its folder, or at the top for the project root.
  const draftAfter = draft?.mode === "create" ? draft.parent : undefined;
  const draftDepth =
    draft?.mode === "create" && draft.parent ? (rows.find((row) => row.node.path === draft.parent)?.depth ?? -1) + 1 : 0;

  const createRow =
    draft?.mode === "create" ? (
      <li className="tree-row tree-row-draft" role="none">
        <span className="tree-guides" aria-hidden="true">
          {Array.from({ length: draftDepth }, (_, level) => (
            <span className="tree-guide" key={level} />
          ))}
        </span>
        <span className="tree-chevron" aria-hidden="true" />
        {draft.kind === "directory" ? <FolderIcon path="" open={false} /> : <FileIcon name="" />}
        <DraftInput
          initial=""
          kind={draft.kind}
          label={draft.kind === "directory" ? "New folder name" : "New file name"}
          error={draftError}
          onCommit={(name) => void commitDraft(name)}
          onCancel={cancelDraft}
        />
      </li>
    ) : null;

  return (
    <div className="explorer">
      <div className="explorer-head">
        <span className="explorer-title">{rootName}</span>
        <div className="explorer-actions">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" type="button" aria-label="New file" onClick={() => startCreate("file")}>
                <Icon icon={IconFilePlus} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New file</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label="New folder"
                onClick={() => startCreate("directory")}
              >
                <Icon icon={IconFolderPlus} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New folder</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label="Collapse folders"
                onClick={() => setExpanded(new Set())}
              >
                <Icon icon={IconChevronDoubleUp} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Collapse folders</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {draftError && (
        <p className="tree-draft-error" role="alert">
          {draftError}
        </p>
      )}

      <ul className="tree" role="tree" aria-label="Project files" ref={listRef} onKeyDown={onKeyDown}>
        {draftAfter === "" && createRow}
        {rows.map(({ node, depth }) => {
          const isDirectory = node.kind === "directory";
          const open = isDirectory && expanded.has(node.path);
          const selected = node.path === current;
          const segments = node.name.split("/");
          const renaming = draft?.mode === "rename" && draft.path === node.path;

          return (
            <Fragment key={node.path}>
              <li
                className="tree-row"
                role="treeitem"
                aria-level={depth + 1}
                aria-expanded={isDirectory ? open : undefined}
                aria-selected={selected}
                tabIndex={node.path === focused ? 0 : -1}
                data-path={node.path}
                onClick={() => {
                  setFocused(node.path);
                  if (renaming) return;
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
                  <span className="tree-chevron" data-open={open || undefined} aria-hidden="true">
                    <Icon icon={IconChevronRight} size={14} />
                  </span>
                ) : (
                  <span className="tree-chevron" aria-hidden="true" />
                )}
                {isDirectory ? <FolderIcon path={node.path} open={open} /> : <FileIcon name={node.name} />}
                {renaming ? (
                  <DraftInput
                    initial={lastSegment(node.path)}
                    kind={node.kind}
                    label={`Rename ${lastSegment(node.path)}`}
                    error={draftError}
                    onCommit={(name) => void commitDraft(name)}
                    onCancel={cancelDraft}
                  />
                ) : (
                  <>
                    <span className="tree-name" data-muted={node.name.startsWith(".") || undefined}>
                      {segments.map((segment, index) => (
                        <span key={`${segment}-${index}`}>
                          {index > 0 && <span className="tree-name-separator"> / </span>}
                          {segment}
                        </span>
                      ))}
                    </span>
                    {selected && dirty && <span className="tree-dirty" title="Unsaved changes" />}
                    <span className="tree-row-actions">
                      <button
                        type="button"
                        className="tree-action"
                        tabIndex={-1}
                        aria-label={`Rename ${lastSegment(node.path)}`}
                        title="Rename (F2)"
                        onClick={(event) => {
                          event.stopPropagation();
                          startRename(node.path);
                        }}
                      >
                        <Icon icon={IconPencil} size={13} />
                      </button>
                      <button
                        type="button"
                        className="tree-action"
                        tabIndex={-1}
                        aria-label={`Delete ${lastSegment(node.path)}`}
                        title="Delete"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(node.path, node.kind);
                        }}
                      >
                        <Icon icon={IconTrash} size={13} />
                      </button>
                    </span>
                  </>
                )}
              </li>
              {draftAfter !== undefined && draftAfter !== "" && draftAfter === node.path && createRow}
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}
