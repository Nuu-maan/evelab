"use client";

import { motion } from "motion/react";
import { EASE_OUT } from "@/components/interaction";
import { createSubagentAction, createToolAction } from "@/lib/actions";

export type DraftKind = "tool" | "subagent";

/**
 * Opened by dropping a palette chip on the canvas. The form is the confirmation
 * step: dropping alone never writes a file.
 */
export function CanvasCreatePanel({
  projectId,
  kind,
  defaultModel,
  onClose,
  onSubmitted,
}: {
  projectId: string;
  kind: DraftKind;
  defaultModel: string;
  onClose: () => void;
  onSubmitted: (entityId: string) => void;
}) {
  const isTool = kind === "tool";

  return (
    <motion.aside
      className="inspector"
      aria-label={isTool ? "New tool" : "New subagent"}
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 24, opacity: 0 }}
      transition={EASE_OUT}
    >
      <div className="inspector-head">
        <div>
          <p className="node-kind">New {kind}</p>
          <h2 className="section-title">{isTool ? "TypeScript tool" : "Subagent"}</h2>
          <p className="list-item-detail">
            {isTool
              ? "Writes one file under tools/ that you own from the first line."
              : "Writes one markdown file under subagents/."}
          </p>
        </div>
        <button className="button" data-variant="ghost" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <form
        action={isTool ? createToolAction : createSubagentAction}
        className="modal-body"
        onSubmit={(event) => {
          const form = new FormData(event.currentTarget);
          const id = String(form.get(isTool ? "toolId" : "subagentId") ?? "");
          if (id) onSubmitted(id);
        }}
      >
        <input type="hidden" name="projectId" value={projectId} />

        <div className="field">
          <label className="label" htmlFor="draft-id">
            {isTool ? "Tool name" : "Subagent id"}
          </label>
          <input
            className="input mono"
            id="draft-id"
            name={isTool ? "toolId" : "subagentId"}
            placeholder={isTool ? "search-docs" : "researcher"}
            pattern="[a-z0-9][a-z0-9-]*"
            required
            autoFocus
          />
          <p className="helper">
            Lowercase and dashes. Becomes {isTool ? "tools/<name>.ts" : "subagents/<id>.md"}.
          </p>
        </div>

        {!isTool && (
          <div className="field">
            <label className="label" htmlFor="draft-name">
              Name
            </label>
            <input className="input" id="draft-name" name="name" placeholder="Researcher" required />
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="draft-description">
            Description
          </label>
          <input className="input" id="draft-description" name="description" maxLength={280} />
          <p className="helper">
            {isTool
              ? "The model reads this to decide when to call the tool."
              : "The parent agent reads this to decide when to delegate."}
          </p>
        </div>

        {!isTool && (
          <div className="field">
            <label className="label" htmlFor="draft-model">
              Model
            </label>
            <input className="input mono" id="draft-model" name="modelId" placeholder={defaultModel} />
            <p className="helper">Leave empty to inherit the main agent&apos;s model.</p>
          </div>
        )}

        <div className="row">
          <button className="button" data-variant="primary" type="submit">
            Create {kind}
          </button>
          <button className="button" data-variant="ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </motion.aside>
  );
}
