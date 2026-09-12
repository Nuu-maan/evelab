"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import type { CanvasNode } from "@evelab/eve-project";
import { CodeEditor, languageFor } from "@/components/editor";
import { SaveIndicator, type SaveState } from "@/components/save-state";
import { EASE_OUT } from "@/components/interaction";
import { deleteSkillAction, deleteToolAction, deleteSubagentAction, saveFileAction } from "@/lib/actions";

/**
 * The right-hand panel. Selecting a node opens the file that defines it, so
 * editing a skill on the canvas is editing SKILL.md, not a GUI representation
 * of it.
 */
export function CanvasInspector({
  projectId,
  node,
  content,
  onClose,
}: {
  projectId: string;
  node: CanvasNode;
  content: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(content);
  const [state, setState] = useState<SaveState>("saved");
  const savedRef = useRef(content);

  useEffect(() => {
    setValue(content);
    savedRef.current = content;
    setState("saved");
  }, [content, node.id]);

  const save = useCallback(async () => {
    if (value === savedRef.current) return;
    setState("saving");
    try {
      await saveFileAction(projectId, node.filePath, value);
      savedRef.current = value;
      setState("saved");
      router.refresh();
    } catch {
      setState("error");
    }
  }, [node.filePath, projectId, router, value]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "s" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void save();
      }
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, save]);

  const [, entityId] = node.id.split(":");
  const removal =
    node.kind === "tool"
      ? { action: deleteToolAction, field: "toolId" }
      : node.kind === "skill"
        ? { action: deleteSkillAction, field: "skillId" }
        : node.kind === "subagent"
          ? { action: deleteSubagentAction, field: "subagentId" }
          : undefined;

  return (
    <motion.aside
      className="inspector"
      aria-label={`${node.name} inspector`}
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 24, opacity: 0 }}
      transition={EASE_OUT}
    >
      <div className="inspector-head">
        <div>
          <p className="node-kind">{node.kind}</p>
          <h2 className="section-title">{node.name}</h2>
          <p className="list-item-detail">{node.detail}</p>
        </div>
        <button className="button" data-variant="ghost" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="inspector-meta">
        <code className="mono palette-hint">{node.filePath}</code>
        <SaveIndicator state={state} />
      </div>

      <div className="inspector-body">
        <div className="inspector-editor">
          <CodeEditor
            value={value}
            language={languageFor(node.filePath)}
            onChange={(next) => {
              setValue(next);
              setState(next === savedRef.current ? "saved" : "dirty");
            }}
            onSave={() => void save()}
          />
        </div>
      </div>

      <div className="inspector-foot">
        <div className="row">
          <button
            className="button"
            data-variant="primary"
            type="button"
            onClick={() => void save()}
            disabled={state === "saved" || state === "saving"}
          >
            Save
          </button>
          <span className="kbd">⌘S</span>
          <Link
            className="button"
            data-variant="ghost"
            href={`/projects/${projectId}/files?path=${encodeURIComponent(node.filePath)}`}
          >
            Open in Files
          </Link>
        </div>

        {removal && entityId && (
          <form
            action={removal.action}
            onSubmit={(event) => {
              if (!confirm(`Delete ${node.name}? This removes its files.`)) event.preventDefault();
              else onClose();
            }}
          >
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name={removal.field} value={entityId} />
            <button className="button" data-variant="danger" type="submit">
              Delete
            </button>
          </form>
        )}
      </div>
    </motion.aside>
  );
}
