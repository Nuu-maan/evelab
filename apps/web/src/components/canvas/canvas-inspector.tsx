"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { X } from "lucide-react";
import type { CanvasNode } from "@evelab/eve-project";
import { CodeEditor, languageFor } from "@/components/editor";
import { DRAWER, EXIT } from "@/components/interaction";
import { KINDS, KindTile } from "@/components/kinds";
import { ResizeHandle } from "@/components/resize-handle";
import { SaveIndicator, type SaveState } from "@/components/save-state";
import { Shortcut } from "@/components/shortcut";
import { deleteSkillAction, deleteToolAction, deleteSubagentAction, saveFileAction } from "@/lib/actions";

/** Panels slide in from the edge they live on, and leave the same way, faster. */
export const PANEL_MOTION = {
  initial: { opacity: 0, transform: "translateX(24px)" },
  animate: { opacity: 1, transform: "translateX(0px)", transition: DRAWER },
  exit: { opacity: 0, transform: "translateX(16px)", transition: EXIT },
};

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
    <motion.aside className="inspector" aria-label={`${node.name} inspector`} {...PANEL_MOTION}>
      <ResizeHandle pane="inspector" edge="start" label="Resize inspector" />

      <div className="inspector-head">
        <KindTile kind={node.kind} size="large" />
        <div className="inspector-title">
          <p className="node-kind" data-kind={node.kind}>
            {KINDS[node.kind].label}
          </p>
          <h2 className="section-title">{node.name}</h2>
          <p className="list-item-detail">{node.detail}</p>
        </div>
        <button
          className="button"
          data-variant="ghost"
          data-size="icon"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          <X aria-hidden="true" strokeWidth={1.5} />
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
          <Shortcut keys="S" />
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
