"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveInstructionsAction } from "@/lib/actions";
import { CodeEditor } from "@/components/editor";
import { SaveIndicator, type SaveState } from "@/components/save-state";

/** instructions.md editing: Monaco, ⌘S, and a debounced autosave. */
export function InstructionsEditor({
  projectId,
  initialContent,
}: {
  projectId: string;
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [state, setState] = useState<SaveState>("saved");
  const savedRef = useRef(initialContent);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const save = useCallback(
    async (next: string) => {
      if (next === savedRef.current) return;
      setState("saving");
      try {
        await saveInstructionsAction(projectId, next);
        savedRef.current = next;
        setState("saved");
      } catch {
        setState("error");
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (state !== "dirty") return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(content), 1200);
    return () => clearTimeout(timer.current);
  }, [content, save, state]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (savedRef.current !== content) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [content]);

  return (
    <div className="editor-pane editor-frame" style={{ height: "62vh" }}>
      <div className="editor-bar">
        <code className="mono">instructions.md</code>
        <div className="row">
          <SaveIndicator state={state} />
          <span className="kbd">⌘S</span>
          <button
            className="button"
            type="button"
            onClick={() => void save(content)}
            disabled={state === "saved" || state === "saving"}
          >
            Save
          </button>
        </div>
      </div>
      <div className="editor-host">
        <CodeEditor
          value={content}
          language="markdown"
          onChange={(next) => {
            setContent(next);
            setState(next === savedRef.current ? "saved" : "dirty");
          }}
          onSave={() => void save(content)}
        />
      </div>
    </div>
  );
}
