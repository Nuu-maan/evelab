"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createConnectionAction } from "@/lib/actions";

const NAME_PATTERN = "[A-Za-z0-9][A-Za-z0-9_\\-]*";

type Auth = "none" | "connect" | "token";

/**
 * Writes an MCP or OpenAPI connection. Used on the canvas and on the
 * Connections page, so both write the same file.
 */
export function ConnectionForm({
  projectId,
  onCreated,
  onCancel,
  autoFocus,
}: {
  projectId: string;
  onCreated?: (id: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [auth, setAuth] = useState<Auth>("none");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const text = (name: string) => String(form.get(name) ?? "").trim() || undefined;
    const id = text("name") ?? "";
    setPending(true);
    setError(undefined);
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
    formElement.reset();
    setAuth("none");
    onCreated?.(id);
    router.refresh();
  };

  return (
    <form className="inspector-form" onSubmit={(event) => void submit(event)}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="connection-name">Connection name</FieldLabel>
          <Input
            className="font-mono"
            id="connection-name"
            name="name"
            placeholder="linear"
            pattern={NAME_PATTERN}
            required
            autoFocus={autoFocus}
          />
          <FieldDescription>Its tools reach the model as &lt;name&gt;__&lt;tool&gt;.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="connection-kind">Protocol</FieldLabel>
          <Select name="connectionKind" defaultValue="mcp">
            <SelectTrigger id="connection-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mcp">MCP server</SelectItem>
              <SelectItem value="openapi">OpenAPI document</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="connection-url">URL</FieldLabel>
          <Input
            className="font-mono"
            id="connection-url"
            name="url"
            type="url"
            placeholder="https://mcp.linear.app/mcp"
            required
          />
          <FieldDescription>The MCP endpoint, or the URL of the OpenAPI document.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="connection-description">Description</FieldLabel>
          <Input id="connection-description" name="description" maxLength={500} />
          <FieldDescription>Tells the model what this service is for.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="connection-auth">Authentication</FieldLabel>
          <Select value={auth} onValueChange={(value) => setAuth(value as Auth)}>
            <SelectTrigger id="connection-auth" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="connect">Vercel Connect</SelectItem>
              <SelectItem value="token">Token from an environment variable</SelectItem>
            </SelectContent>
          </Select>
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
            <FieldLabel htmlFor="connection-connector">Connector</FieldLabel>
            <Input
              className="font-mono"
              id="connection-connector"
              name="connector"
              placeholder="mcp.linear.app/linear"
              required
            />
            <FieldDescription>
              Create one with <code className="mono">vercel connect create</code> or in the Vercel dashboard.
            </FieldDescription>
          </Field>
        )}
        {auth === "token" && (
          <Field>
            <FieldLabel htmlFor="connection-token">Environment variable</FieldLabel>
            <Input className="font-mono" id="connection-token" name="tokenEnv" placeholder="LINEAR_API_KEY" required />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="connection-allow">Only these tools</FieldLabel>
          <Input className="font-mono" id="connection-allow" name="allow" placeholder="search_issues, get_issue" />
          <FieldDescription>Optional. Leave empty to expose everything the server offers.</FieldDescription>
        </Field>
      </FieldGroup>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="row">
        <Button type="submit" disabled={pending}>
          Create connection
        </Button>
        {onCancel && (
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
