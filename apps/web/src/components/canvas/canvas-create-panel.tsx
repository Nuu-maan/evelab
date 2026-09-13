"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { IconCross } from "@/components/icons";
import { PANEL_MOTION } from "@/components/canvas/canvas-inspector";
import { Icon } from "@/components/icon";
import { KindTile } from "@/components/kinds";
import { ResizeHandle } from "@/components/resize-handle";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createConnectionAction, createSubagentAction, createToolAction } from "@/lib/actions";

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
  const router = useRouter();
  const base = root ? `${root}/` : "";
  const copy = COPY[kind];
  const [auth, setAuth] = useState<"none" | "connect" | "token">("none");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const submitConnection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || undefined;
    setPending(true);
    setError(undefined);
    const id = text("name") ?? "";
    const result = await createConnectionAction({
      projectId,
      id,
      kind: form.get("connectionKind") === "openapi" ? "openapi" : "mcp",
      url: text("url") ?? "",
      description: text("description") ?? "",
      auth,
      connector: text("connector"),
      tokenEnv: text("tokenEnv"),
      allow: text("allow"),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSubmitted(id);
    router.refresh();
  };

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
        <form className="inspector-form" onSubmit={(event) => void submitConnection(event)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="draft-id">Connection name</FieldLabel>
              <Input className="font-mono" id="draft-id" name="name" placeholder="linear" pattern={NAME_PATTERN} required autoFocus />
            </Field>
            <Field>
              <FieldLabel htmlFor="draft-kind">Protocol</FieldLabel>
              <select id="draft-kind" name="connectionKind" className="native-select" defaultValue="mcp">
                <option value="mcp">MCP server</option>
                <option value="openapi">OpenAPI document</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="draft-url">URL</FieldLabel>
              <Input className="font-mono" id="draft-url" name="url" type="url" placeholder="https://mcp.linear.app/mcp" required />
              <FieldDescription>The MCP endpoint, or the URL of the OpenAPI document.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="draft-description">Description</FieldLabel>
              <Input id="draft-description" name="description" maxLength={500} />
              <FieldDescription>Tells the model what this service is for.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="draft-auth">Authentication</FieldLabel>
              <select
                id="draft-auth"
                className="native-select"
                value={auth}
                onChange={(event) => setAuth(event.target.value as typeof auth)}
              >
                <option value="none">None</option>
                <option value="connect">Vercel Connect</option>
                <option value="token">Token from an environment variable</option>
              </select>
              <FieldDescription>
                {auth === "connect"
                  ? "Vercel Connect holds the credential and signs each call. EveLab never sees it."
                  : auth === "token"
                    ? "The token is read from the deployment's environment at run time."
                    : "For public servers."}
              </FieldDescription>
            </Field>
            {auth === "connect" && (
              <Field>
                <FieldLabel htmlFor="draft-connector">Connector</FieldLabel>
                <Input className="font-mono" id="draft-connector" name="connector" placeholder="mcp.linear.app/linear" required />
              </Field>
            )}
            {auth === "token" && (
              <Field>
                <FieldLabel htmlFor="draft-token">Environment variable</FieldLabel>
                <Input className="font-mono" id="draft-token" name="tokenEnv" placeholder="LINEAR_API_KEY" required />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="draft-allow">Only these tools</FieldLabel>
              <Input className="font-mono" id="draft-allow" name="allow" placeholder="search_issues, get_issue" />
              <FieldDescription>Optional. Leave empty to expose everything the server offers.</FieldDescription>
            </Field>
          </FieldGroup>

          {error && (
            <p className="hint" role="alert" data-tone="error">
              {error}
            </p>
          )}

          <div className="row">
            <Button type="submit" disabled={pending}>
              Create connection
            </Button>
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
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
