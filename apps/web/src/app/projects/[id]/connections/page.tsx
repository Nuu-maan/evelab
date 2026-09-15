import Link from "next/link";
import { agentPath, type Connection } from "@evelab/eve-project";
import { IconLink } from "@/components/icons";
import { ConfirmSubmit } from "@/components/confirm";
import { BrandLogo } from "@/components/brand-logo";
import { ConnectionCatalog } from "@/components/connection-catalog";
import { EmptyState } from "@/components/empty-state";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteEntityAction } from "@/lib/actions";
import { brandFor } from "@/lib/brands";
import { getProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const AUTH_LABELS: Record<Connection["auth"], string> = {
  none: "No auth",
  connect: "Vercel Connect",
  token: "Token",
  custom: "Custom auth",
};

function endpoint(connection: Connection): string | undefined {
  return connection.url ?? connection.spec;
}

function ConnectionBrand({ name, url }: { name: string; url?: string }) {
  const brand = brandFor(name, url);
  return brand ? <BrandLogo brand={brand} size={16} /> : null;
}

export default async function ConnectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  const directory = agentPath(project.root, "connections/");
  // Every agent's own connections, nested subagents included, keyed by the folder they live in.
  const walk = (subagents: typeof project.subagents, prefix: string): { connection: Connection; owner: string }[] =>
    subagents.flatMap((subagent) =>
      subagent.kind === "local"
        ? [
            ...subagent.connections.map((connection) => ({ connection, owner: `${prefix}${subagent.id}` })),
            ...walk(subagent.subagents, `${prefix}${subagent.id}/`),
          ]
        : [],
    );
  const all = [...project.connections.map((connection) => ({ connection, owner: "" })), ...walk(project.subagents, "")];
  // A shared connection is one definition in lib/, so it is listed once with everyone who uses it.
  const owned = all.filter(({ connection }) => !connection.shared);
  const shared = project.library.connections.map((definition) => ({
    definition,
    users: all.filter(({ connection }) => connection.shared === definition.id).map(({ owner }) => owner.split("/").pop() || project.agent.name),
  }));

  return (
    <div className="page">
      <Reveal>
        <header className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Connections</h1>
            <p className="page-description">
              Remote MCP servers and OpenAPI services, one file each under{" "}
              <code className="mono">{directory}</code>. Credentials stay with Vercel Connect or the
              deployment&apos;s environment; nothing secret is written to the project or to EveLab.
            </p>
          </div>
        </header>
      </Reveal>

      {shared.length > 0 && (
        <Stagger className="section">
          <h2 className="section-title">Shared</h2>
          {shared.map(({ definition, users }) => {
            const path = `${agentPath(project.root, "lib/connections/")}${definition.file}`;
            return (
              <StaggerItem key={definition.id}>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-mono">
                      <ConnectionBrand name={definition.id} url={endpoint(definition)} />
                      {definition.id}
                    </CardTitle>
                    <CardDescription>{definition.description || "No description"}</CardDescription>
                    <CardAction className="flex items-center gap-4">
                      <Button asChild variant="ghost">
                        <Link href={`/projects/${id}/files?path=${encodeURIComponent(path)}`}>Edit</Link>
                      </Button>
                      <form action={deleteEntityAction}>
                        <input type="hidden" name="projectId" value={id} />
                        <input type="hidden" name="ref" value={`connection:#${definition.id}`} />
                        <ConfirmSubmit
                          title={`Remove ${definition.id}?`}
                          description={`Deletes ${path} and the re-export in ${users.length} ${users.length === 1 ? "agent" : "agents"}.`}
                          confirmLabel="Remove"
                        >
                          Remove
                        </ConfirmSubmit>
                      </form>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{definition.kind === "openapi" ? "OpenAPI" : definition.kind === "mcp" ? "MCP" : "Connection"}</Badge>
                    <Badge variant="secondary">
                      {AUTH_LABELS[definition.auth]}
                      {definition.connector ? `: ${definition.connector}` : ""}
                    </Badge>
                    <Badge variant="outline">
                      Used by {users.length > 0 ? users.join(", ") : "no agent yet"}
                    </Badge>
                    {endpoint(definition) && <span className="hint mono truncate">{endpoint(definition)}</span>}
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      {owned.length === 0 && shared.length === 0 ? (
        <Reveal delay={0.06}>
          <EmptyState icon={IconLink} title="No connections yet.">
            Add a hosted MCP server such as Linear, or an OpenAPI document. Eve discovers the tools when
            the agent runs.
          </EmptyState>
        </Reveal>
      ) : (
        <Stagger className="section">
          {shared.length > 0 && owned.length > 0 && <h2 className="section-title">Defined in place</h2>}
          {owned.map(({ connection, owner }) => {
            const path = owner
              ? `${agentPath(project.root, `subagents/${owner.split("/").join("/subagents/")}/connections/`)}${connection.file}`
              : `${directory}${connection.file}`;
            const ref = owner ? `connection:${owner}/${connection.id}` : `connection:${connection.id}`;
            return (
              <StaggerItem key={ref}>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-mono">
                      <ConnectionBrand name={connection.id} url={endpoint(connection)} />
                      {connection.id}
                    </CardTitle>
                    <CardDescription>{connection.description || "No description"}</CardDescription>
                    <CardAction className="flex items-center gap-4">
                      <Button asChild variant="ghost">
                        <Link href={`/projects/${id}/files?path=${encodeURIComponent(path)}`}>Edit</Link>
                      </Button>
                      <form action={deleteEntityAction}>
                        <input type="hidden" name="projectId" value={id} />
                        <input type="hidden" name="ref" value={ref} />
                        <ConfirmSubmit title={`Remove ${connection.id}?`} description={`Deletes ${path}.`} confirmLabel="Remove">
                          Remove
                        </ConfirmSubmit>
                      </form>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{connection.kind === "openapi" ? "OpenAPI" : connection.kind === "mcp" ? "MCP" : "Connection"}</Badge>
                    <Badge variant="secondary">
                      {AUTH_LABELS[connection.auth]}
                      {connection.connector ? `: ${connection.connector}` : ""}
                    </Badge>
                    {owner && <Badge variant="secondary">In {owner.split("/").pop()}</Badge>}
                    {connection.filter && (
                      <Badge variant="secondary">
                        {connection.filter.mode === "allow" ? "Only" : "All but"} {connection.filter.names.join(", ")}
                      </Badge>
                    )}
                    {endpoint(connection) && <span className="hint mono truncate">{endpoint(connection)}</span>}
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      <Reveal delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>Add a connection</CardTitle>
            <CardDescription>
              Pick a service. EveLab writes {directory}&lt;name&gt;.ts the way{" "}
              <code className="mono">eve add connection/&lt;name&gt;</code> does, with Vercel Connect holding the credential.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectionCatalog
              projectId={id}
              existing={[...all.map(({ connection }) => connection.id), ...project.library.connections.map((definition) => definition.id)]}
            />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
