"use client";

import { motion } from "motion/react";
import { IconCross } from "@/components/icons";
import { PANEL_MOTION } from "@/components/canvas/canvas-inspector";
import { Icon } from "@/components/icon";
import { KindTile } from "@/components/kinds";
import { ResizeHandle } from "@/components/resize-handle";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
      {...PANEL_MOTION}
    >
      <ResizeHandle pane="inspector" edge="start" label="Resize panel" />

      <div className="inspector-head">
        <KindTile kind={kind} size="large" />
        <div className="inspector-title">
          <p className="node-kind" data-kind={kind}>
            New {kind}
          </p>
          <h2 className="section-title">{isTool ? "TypeScript tool" : "Subagent"}</h2>
          <p className="list-item-detail">
            {isTool
              ? "Writes one file under tools/ that you own from the first line."
              : "Writes one markdown file under subagents/."}
          </p>
        </div>
        <Button variant="ghost" size="icon" type="button" aria-label="Close" onClick={onClose}>
          <Icon icon={IconCross} />
        </Button>
      </div>

      <form
        action={isTool ? createToolAction : createSubagentAction}
        className="inspector-form"
        onSubmit={(event) => {
          const form = new FormData(event.currentTarget);
          const id = String(form.get(isTool ? "toolId" : "subagentId") ?? "");
          if (id) onSubmitted(id);
        }}
      >
        <input type="hidden" name="projectId" value={projectId} />

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="draft-id">{isTool ? "Tool name" : "Subagent id"}</FieldLabel>
            <Input
              className="font-mono"
              id="draft-id"
              name={isTool ? "toolId" : "subagentId"}
              placeholder={isTool ? "search-docs" : "researcher"}
              pattern="[a-z0-9][a-z0-9-]*"
              required
              autoFocus
            />
            <FieldDescription>
              Lowercase and dashes. Becomes {isTool ? "tools/<name>.ts" : "subagents/<id>.md"}.
            </FieldDescription>
          </Field>

          {!isTool && (
            <Field>
              <FieldLabel htmlFor="draft-name">Name</FieldLabel>
              <Input id="draft-name" name="name" placeholder="Researcher" required />
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="draft-description">Description</FieldLabel>
            <Input id="draft-description" name="description" maxLength={280} />
            <FieldDescription>
              {isTool
                ? "The model reads this to decide when to call the tool."
                : "The parent agent reads this to decide when to delegate."}
            </FieldDescription>
          </Field>

          {!isTool && (
            <Field>
              <FieldLabel htmlFor="draft-model">Model</FieldLabel>
              <Input className="font-mono" id="draft-model" name="modelId" placeholder={defaultModel} />
              <FieldDescription>Leave empty to inherit the main agent&apos;s model.</FieldDescription>
            </Field>
          )}
        </FieldGroup>

        <div className="row">
          <Button type="submit">Create {kind}</Button>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </motion.aside>
  );
}
