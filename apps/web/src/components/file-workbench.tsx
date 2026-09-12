"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ProjectFile } from "@evelab/eve-project";
import { CodeEditor, languageFor } from "@/components/editor";
import { SaveIndicator, type SaveState } from "@/components/save-state";
import { saveFileAction } from "@/lib/actions";

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
    return files[0]?.path ?? "";
  }, [files, requested]);

  const [path, setPath] = useState(initialPath);
  const [content, setContent] = useState(
    () => files.find((file) => file.path === initialPath)?.content ?? "",
  );
  const [state, setState] = useState<SaveState>("saved");
  const savedRef = useRef(content);

  useEffect(() => {
    setPath(initialPath);
    const next = files.find((file) => file.path === initialPath)?.content ?? "";
    setContent(next);
    savedRef.current = next;
    setState("saved");
  }, [files, initialPath]);

  const open = useCallback(
    (nextPath: string) => {
      if (savedRef.current !== content && !confirm("Discard unsaved changes?")) return;
      const next = files.find((file) => file.path === nextPath)?.content ?? "";
      setPath(nextPath);
      setContent(next);
      savedRef.current = next;
      setState("saved");
      router.replace(`/projects/${projectId}/files?path=${encodeURIComponent(nextPath)}`);
    },
    [content, files, projectId, router],
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

  return (
    <div className="editor-layout">
      <nav className="file-tree" aria-label="Files">
        {files.map((file) => (
          <button
            key={file.path}
            type="button"
            className="file-tree-item"
            aria-current={file.path === path}
            onClick={() => open(file.path)}
          >
            {file.path}
          </button>
        ))}
      </nav>

      <div className="editor-pane">
        <div className="editor-bar">
          <code className="mono">{path}</code>
          <div className="row">
            <SaveIndicator state={state} />
            <button
              className="button"
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
