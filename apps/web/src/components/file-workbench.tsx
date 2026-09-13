"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconChevronRight } from "@/components/icons";
import type { ProjectFile } from "@evelab/eve-project";
import { ConfirmDialog } from "@/components/confirm";
import { EmptyState } from "@/components/empty-state";
import { CodeEditor, languageFor } from "@/components/editor";
import { FileIcon } from "@/components/files/file-icon";
import { FileTree } from "@/components/files/file-tree";
import { Icon } from "@/components/icon";
import { ResizeHandle } from "@/components/resize-handle";
import { SaveIndicator, type SaveState } from "@/components/save-state";
import { Shortcut } from "@/components/shortcut";
import { Button } from "@/components/ui/button";
import { saveFileAction } from "@/lib/actions";
import "@/app/explorer.css";

/**
 * The "never get locked into the GUI" surface: every project file, editable,
 * including the ones the GUI generates.
 */
export function FileWorkbench({
  projectId,
  files,
}: {
  projectId: string;
  files: ProjectFile[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("path");

  const initialPath = useMemo(() => {
    if (requested && files.some((file) => file.path === requested)) return requested;
    const preferred = ["agent/agent.ts", "agent.ts", "agent/instructions.md", "instructions.md"];
    return preferred.find((path) => files.some((file) => file.path === path)) ?? files[0]?.path ?? "";
  }, [files, requested]);

  const [path, setPath] = useState(initialPath);
  const [content, setContent] = useState(
    () => files.find((file) => file.path === initialPath)?.content ?? "",
  );
  const [state, setState] = useState<SaveState>("saved");
  const savedRef = useRef(content);
  const paths = useMemo(() => files.map((file) => file.path), [files]);

  useEffect(() => {
    setPath(initialPath);
    const next = files.find((file) => file.path === initialPath)?.content ?? "";
    setContent(next);
    savedRef.current = next;
    setState("saved");
  }, [files, initialPath]);

  const [pendingPath, setPendingPath] = useState<string | undefined>();

  const openNow = useCallback(
    (nextPath: string) => {
      const next = files.find((file) => file.path === nextPath)?.content ?? "";
      setPath(nextPath);
      setContent(next);
      savedRef.current = next;
      setState("saved");
      router.replace(`/projects/${projectId}/files?path=${encodeURIComponent(nextPath)}`);
    },
    [files, projectId, router],
  );

  const open = useCallback(
    (nextPath: string) => {
      if (nextPath === path) return;
      if (savedRef.current !== content) setPendingPath(nextPath);
      else openNow(nextPath);
    },
    [content, openNow, path],
  );

  const save = useCallback(async () => {
    if (!path || content === savedRef.current) return;
    setState("saving");
    try {
      await saveFileAction(projectId, path, content);
      savedRef.current = content;
      setState("saved");
      router.refresh();
    } catch {
      setState("error");
    }
  }, [content, path, projectId, router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "s" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  if (files.length === 0) {
    return (
      <div className="page">
        <EmptyState title="This project has no files." />
      </div>
    );
  }

  const segments = path.split("/");

  return (
    <div className="explorer-layout">
      <aside className="explorer-pane" aria-label="Explorer">
        <FileTree
          rootName={projectId}
          paths={paths}
          current={path}
          dirty={state === "dirty"}
          onOpen={open}
        />
        <ResizeHandle pane="explorer" label="Resize file explorer" />
      </aside>

      <div className="editor-pane">
        <div className="editor-bar">
          <nav className="editor-crumbs" aria-label="File path">
            {segments.map((segment, index) => {
              const last = index === segments.length - 1;
              return (
                <Fragment key={`${segment}-${index}`}>
                  {last ? (
                    <span className="editor-crumb-current" aria-current="page">
                      <FileIcon name={segment} />
                      {segment}
                    </span>
                  ) : (
                    <>
                      <span>{segment}</span>
                      <span className="editor-crumb-separator" aria-hidden="true">
                        <Icon icon={IconChevronRight} size={14} />
                      </span>
                    </>
                  )}
                </Fragment>
              );
            })}
          </nav>
          <div className="row">
            <SaveIndicator state={state} />
            <Shortcut keys="S" />
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => void save()}
              disabled={state === "saved" || state === "saving"}
            >
              Save
            </Button>
          </div>
        </div>
        <div className="editor-host">
          <CodeEditor
            value={content}
            language={languageFor(path)}
            onChange={(next) => {
              setContent(next);
              setState(next === savedRef.current ? "saved" : "dirty");
            }}
            onSave={() => void save()}
          />
        </div>
      </div>

      <ConfirmDialog
        open={pendingPath !== undefined}
        onOpenChange={(next) => !next && setPendingPath(undefined)}
        title="Discard unsaved changes?"
        description={
          <>
            Your edits to <span className="mono">{path}</span> have not been saved.
          </>
        }
        confirmLabel="Discard"
        onConfirm={() => {
          if (pendingPath) openNow(pendingPath);
          setPendingPath(undefined);
        }}
      />
    </div>
  );
}
