"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { ProjectFile } from "@evelab/eve-project";
import { CodeEditor, languageFor } from "@/components/editor";
import { FileIcon } from "@/components/files/file-icon";
import { FileTree } from "@/components/files/file-tree";
import { ResizeHandle } from "@/components/resize-handle";
import { SaveIndicator, type SaveState } from "@/components/save-state";
import { Shortcut } from "@/components/shortcut";
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
    return files.find((file) => file.path === "agent.ts")?.path ?? files[0]?.path ?? "";
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

  const open = useCallback(
    (nextPath: string) => {
      if (nextPath === path) return;
      if (savedRef.current !== content && !confirm("Discard unsaved changes?")) return;
      const next = files.find((file) => file.path === nextPath)?.content ?? "";
      setPath(nextPath);
      setContent(next);
      savedRef.current = next;
      setState("saved");
      router.replace(`/projects/${projectId}/files?path=${encodeURIComponent(nextPath)}`);
    },
    [content, files, path, projectId, router],
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
        <div className="empty">
          <p className="empty-title">This project has no files.</p>
        </div>
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
                      <ChevronRight className="editor-crumb-separator" aria-hidden="true" strokeWidth={1.5} />
                    </>
                  )}
                </Fragment>
              );
            })}
          </nav>
          <div className="row">
            <SaveIndicator state={state} />
            <Shortcut keys="S" />
            <button
              className="button"
              data-size="small"
              type="button"
              onClick={() => void save()}
              disabled={state === "saved" || state === "saving"}
            >
              Save
            </button>
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
    </div>
  );
}
