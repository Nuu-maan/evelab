"use client";

import { motion } from "motion/react";
import { IconCross } from "@/components/icons";
import { PANEL_MOTION } from "@/components/canvas/canvas-inspector";
import { ConnectionForm } from "@/components/connection-form";
import { Icon } from "@/components/icon";
import { KindTile } from "@/components/kinds";
import { ResizeHandle } from "@/components/resize-handle";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createSubagentAction, createToolAction } from "@/lib/actions";

export type DraftKind = "tool" | "subagent" | "connection";

const NAME_PATTERN = "[A-Za-z0-9][A-Za-z0-9_\\-]*";

const COPY: Record<DraftKind, { title: string; detail: (base: string) => string; label: string }> = {
  tool: {
    title: "TypeScript tool",
    detail: (base) => `Writes ${base}tools/<name>.ts, a defineTool you own from the first line.`,
    label: "New tool",
  },
  subagent: {
    title: "Subagent",
    detail: (base) => `Writes ${base}subagents/<name>/ with its own agent.ts and instructions.`,
    label: "New subagent",
  },
  connection: {
    title: "Connection",
    detail: (base) => `Writes ${base}connections/<name>.ts. Its remote tools reach the model as <name>__<tool>.`,
    label: "New connection",
  },
};

/**
 * Opened by dropping a palette chip on the canvas. The form is the confirmation
 * step: dropping alone never writes a file.
 */
export function CanvasCreatePanel({
  projectId,
  kind,
  root,
  defaultModel,
  onClose,
  onSubmitted,
}: {
  projectId: string;
  kind: DraftKind;
  root: string;
  defaultModel: string;
  onClose: () => void;
  onSubmitted: (entityId: string) => void;
}) {
  const base = root ? `${root}/` : "";
  const copy = COPY[kind];

  return (
    <motion.aside className="inspector" aria-label={copy.label} {...PANEL_MOTION}>
      <ResizeHandle pane="inspector" edge="start" label="Resize panel" />

      <div className="inspector-head">
        <KindTile kind={kind} size="large" />
        <div className="inspector-title">
          <p className="node-kind" data-kind={kind}>
            New {kind}
          </p>
          <h2 className="section-title">{copy.title}</h2>
          <p className="list-item-detail">{copy.detail(base)}</p>
        </div>
        <Button variant="ghost" size="icon" type="button" aria-label="Close" onClick={onClose}>
          <Icon icon={IconCross} />
        </Button>
      </div>

      {kind === "connection" ? (
        <ConnectionForm projectId={projectId} onCreated={onSubmitted} onCancel={onClose} autoFocus />
      ) : (
        <form
          action={kind === "tool" ? createToolAction : createSubagentAction}
          className="inspector-form"
          onSubmit={(event) => {
            const form = new FormData(event.currentTarget);
            const id = String(form.get(kind === "tool" ? "toolId" : "subagentId") ?? "");
            if (id) onSubmitted(id);
          }}
        >
          <input type="hidden" name="projectId" value={projectId} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="draft-id">{kind === "tool" ? "Tool name" : "Subagent name"}</FieldLabel>
              <Input
                className="font-mono"
                id="draft-id"
                name={kind === "tool" ? "toolId" : "subagentId"}
                placeholder={kind === "tool" ? "search_docs" : "researcher"}
                pattern={NAME_PATTERN}
                required
                autoFocus
              />
              <FieldDescription>Letters, digits, - and _. The model calls it by this name.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="draft-description">Description</FieldLabel>
              <Input id="draft-description" name="description" maxLength={500} required={kind === "subagent"} />
              <FieldDescription>
                {kind === "tool"
                  ? "The model reads this to decide when to call the tool."
                  : "Required. The parent agent reads this to decide when to delegate."}
              </FieldDescription>
            </Field>

            {kind === "subagent" && (
              <Field>
                <FieldLabel htmlFor="draft-model">Model</FieldLabel>
                <Input className="font-mono" id="draft-model" name="modelId" placeholder={defaultModel} />
                <FieldDescription>Leave empty for Eve&apos;s default model.</FieldDescription>
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
      )}
    </motion.aside>
  );
}
