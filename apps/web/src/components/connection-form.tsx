"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createConnectionAction, discoverMcpToolsAction } from "@/lib/actions";

const NAME_PATTERN = "[A-Za-z0-9][A-Za-z0-9_\\-]*";

type Auth = "none" | "connect" | "token";
type Kind = "mcp" | "openapi";
type Tool = { name: string; description?: string };

function parseNames(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * Writes an MCP or OpenAPI connection. Used on the canvas and on the
 * Connections page, so both write the same file. For an MCP server, EveLab can
 * list its tools first, so the allow list is picked rather than typed.
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
  const [kind, setKind] = useState<Kind>("mcp");
  const [auth, setAuth] = useState<Auth>("none");
  const [url, setUrl] = useState("");
  const [allow, setAllow] = useState("");
  const [discoveryToken, setDiscoveryToken] = useState("");
  const [tools, setTools] = useState<Tool[]>();
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const selected = useMemo(() => new Set(parseNames(allow)), [allow]);

  const discover = async () => {
    setDiscovering(true);
    setDiscoverError(undefined);
    const result = await discoverMcpToolsAction({
      projectId,
      url,
      token: auth === "token" ? discoveryToken : undefined,
    });
    setDiscovering(false);
    if (!result.ok) {
      setTools(undefined);
      setDiscoverError(result.message);
      return;
    }
    setTools(result.tools);
    if (result.tools.length === 0) setDiscoverError("The server did not list any tools.");
  };

  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    // Names typed by hand that the server did not list are kept.
    setAllow([...next].join(", "));
  };

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
      kind,
      url: url.trim(),
      description: text("description") ?? "",
      auth,
      connector: text("connector"),
      tokenEnv: text("tokenEnv"),
      allow: kind === "mcp" ? allow : text("allow"),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    formElement.reset();
    setKind("mcp");
    setAuth("none");
    setUrl("");
    setAllow("");
    setDiscoveryToken("");
    setTools(undefined);
    setDiscoverError(undefined);
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
          <Select
            name="connectionKind"
            value={kind}
            onValueChange={(value) => {
              setKind(value as Kind);
              setTools(undefined);
              setDiscoverError(undefined);
            }}
          >
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
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setTools(undefined);
            }}
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

        {kind === "mcp" ? (
          <Field>
            <FieldLabel htmlFor="connection-allow">Only these tools</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              {auth === "token" && (
                <Input
                  className="min-w-40 flex-1 font-mono"
                  type="password"
                  aria-label="Token to list tools with"
                  placeholder="Token, for listing tools only"
                  autoComplete="off"
                  value={discoveryToken}
                  onChange={(event) => setDiscoveryToken(event.target.value)}
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!url.trim() || discovering || auth === "connect"}
                onClick={() => void discover()}
              >
                {discovering ? "Listing tools" : tools ? "List again" : "Discover tools"}
              </Button>
            </div>
            <FieldDescription>
              {auth === "connect"
                ? "Vercel Connect signs requests only when the agent runs, so EveLab cannot list this server's tools. Type their names below."
                : auth === "token"
                  ? "The token is used once to list tools and is never saved."
                  : "EveLab asks the server for its tools. It never calls one."}
            </FieldDescription>

            {discoverError && (
              <p className="form-error" role="alert">
                {discoverError}
              </p>
            )}

            {tools && tools.length > 0 && (
              <div className="rounded-lg border">
                <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
                  <span>
                    {selected.size === 0
                      ? `${tools.length} ${tools.length === 1 ? "tool" : "tools"}, all exposed`
                      : `${[...selected].filter((name) => tools.some((tool) => tool.name === name)).length} of ${tools.length} selected`}
                  </span>
                  <span className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAllow(tools.map((tool) => tool.name).join(", "))}>
                      Select all
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAllow("")}>
                      Clear
                    </Button>
                  </span>
                </div>
                <ul className="max-h-64 divide-y overflow-auto" aria-label="Tools the server offers">
                  {tools.map((tool) => {
                    const id = `connection-tool-${tool.name}`;
                    return (
                      <li key={tool.name} className="flex items-start gap-2.5 px-3 py-2">
                        <Checkbox id={id} className="mt-0.5" checked={selected.has(tool.name)} onCheckedChange={() => toggle(tool.name)} />
                        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                          <span className="block truncate font-mono text-xs">{tool.name}</span>
                          {tool.description && (
                            <span className="line-clamp-2 block text-xs text-muted-foreground">{tool.description}</span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <Input
              className="font-mono"
              id="connection-allow"
              name="allow"
              placeholder="search_issues, get_issue"
              value={allow}
              onChange={(event) => setAllow(event.target.value)}
            />
            <FieldDescription>Optional. Leave empty to expose everything the server offers.</FieldDescription>
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor="connection-allow">Only these operations</FieldLabel>
            <Input className="font-mono" id="connection-allow" name="allow" placeholder="listIssues, getIssue" />
            <FieldDescription>Optional. Leave empty to expose every operation in the document.</FieldDescription>
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
