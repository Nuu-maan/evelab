"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { IconCross } from "@/components/icons";
import { ChannelForm, type ChatSdkOption } from "@/components/channel-form";
import { ConnectionForm } from "@/components/connection-form";
import { Icon } from "@/components/icon";
import { KindTile } from "@/components/kinds";
import { SkillImportForm } from "@/components/skill-import-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createSubagentAction, createToolAction } from "@/lib/actions";

export type DraftKind = "tool" | "subagent" | "skill" | "connection" | "channel";

const NAME_PATTERN = "[A-Za-z0-9][A-Za-z0-9_\\-]*";

const COPY: Record<DraftKind, { title: string; detail: (base: string) => string }> = {
  tool: {
    title: "New tool",
    detail: (base) => `Writes ${base}tools/<name>.ts, a defineTool you own from the first line.`,
  },
  subagent: {
    title: "New subagent",
    detail: (base) => `Writes ${base}subagents/<name>/ with its own agent.ts and instructions.`,
  },
  skill: {
    title: "Add skill",
    detail: (base) => `Imports a skill into ${base}skills/<name>/ from GitHub or skills.sh. Nothing is written until you install it.`,
  },
  connection: {
    title: "New connection",
    detail: (base) => `Writes ${base}connections/<name>.ts. Its remote tools reach the model as <name>__<tool>.`,
  },
  channel: {
    title: "New channel",
    detail: (base) => `Writes ${base}channels/<name>.ts. Chat SDK adapters bring WhatsApp, Telegram and more.`,
  },
};

/**
 * Creating something from the canvas. The form is the confirmation step, and
 * a resource created for a subagent lands in that subagent's folder.
 */
export function CanvasCreatePanel({
  projectId,
  kind,
  root,
  defaultModel,
  models,
  owner,
  existingChannels,
  chatSdkAdapters,
  chatSdkStates,
  onClose,
  onSubmitted,
}: {
  projectId: string;
  kind: DraftKind;
  root: string;
  defaultModel: string;
  models: { id: string; label: string }[];
  /** The subagent this is created for, when it is not the root agent. */
  owner?: string;
  existingChannels: string[];
  chatSdkAdapters: ChatSdkOption[];
  chatSdkStates: ChatSdkOption[];
  onClose: () => void;
  onSubmitted: (entityId: string) => void;
}) {
  const router = useRouter();
  const base = root ? `${root}/` : "";
  const copy = COPY[kind];
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = String(form.get(kind === "tool" ? "toolId" : "subagentId") ?? "");
    setPending(true);
    setError(undefined);
    try {
      await (kind === "tool" ? createToolAction(form) : createSubagentAction(form));
      onSubmitted(id);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That could not be created.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="inspector-content">
      <header className="inspector-header">
        <KindTile kind={kind} size="large" />
        <div className="inspector-titles">
          <p className="inspector-eyebrow">{owner ? `For ${owner}` : "Create"}</p>
          <h2 className="inspector-name">{copy.title}</h2>
          <p className="inspector-detail">{copy.detail(base)}</p>
        </div>
        <Button variant="ghost" size="icon-sm" type="button" aria-label="Close" onClick={onClose}>
          <Icon icon={IconCross} />
        </Button>
      </header>

      <div className="inspector-scroll">
        {kind === "skill" ? (
          <SkillImportForm projectId={projectId} autoFocus onInstalled={onSubmitted} onCancel={onClose} />
        ) : kind === "connection" ? (
          <ConnectionForm projectId={projectId} onCreated={onSubmitted} onCancel={onClose} autoFocus />
        ) : kind === "channel" ? (
          <ChannelForm
            projectId={projectId}
            existing={existingChannels}
            chatSdkAdapters={chatSdkAdapters}
            chatSdkStates={chatSdkStates}
            onCreated={onClose}
          />
        ) : (
          <form className="inspector-form" onSubmit={(event) => void submit(event)}>
            <input type="hidden" name="projectId" value={projectId} />

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="draft-id">Name</FieldLabel>
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
                    : "The parent agent reads this to decide when to delegate."}
                </FieldDescription>
              </Field>

              {kind === "subagent" && (
                <Field>
                  <FieldLabel htmlFor="draft-model">Model</FieldLabel>
                  <Input
                    className="font-mono"
                    id="draft-model"
                    name="modelId"
                    list="draft-models"
                    defaultValue={defaultModel}
                    required
                  />
                  <datalist id="draft-models">
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </datalist>
                  <FieldDescription>Eve needs a model on every subagent. It starts as the root agent&apos;s.</FieldDescription>
                </Field>
              )}
            </FieldGroup>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <div className="row">
              <Button type="submit" disabled={pending}>
                Create {kind}
              </Button>
              <Button variant="ghost" type="button" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
