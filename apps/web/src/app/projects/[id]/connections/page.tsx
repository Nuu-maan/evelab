import Link from "next/link";
import { agentPath, type Connection } from "@evelab/eve-project";
import { IconLink } from "@/components/icons";
import { ConfirmSubmit } from "@/components/confirm";
import { ConnectionForm } from "@/components/connection-form";
import { EmptyState } from "@/components/empty-state";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteEntityAction } from "@/lib/actions";
import { readProject } from "@/lib/workspace";

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

export default async function ConnectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);
  const directory = agentPath(project.root, "connections/");
  const owned = [
    ...project.connections.map((connection) => ({ connection, owner: "" })),
    ...project.subagents.flatMap((subagent) =>
      subagent.connections.map((connection) => ({ connection, owner: subagent.id })),
    ),
  ];

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

      {owned.length === 0 ? (
        <Reveal delay={0.06}>
          <EmptyState icon={IconLink} title="No connections yet.">
            Add a hosted MCP server such as Linear, or an OpenAPI document. Eve discovers the tools when
            the agent runs.
          </EmptyState>
        </Reveal>
      ) : (
        <Stagger className="section">
          {owned.map(({ connection, owner }) => {
            const path = owner
              ? `${agentPath(project.root, `subagents/${owner}/connections/`)}${connection.file}`
              : `${directory}${connection.file}`;
            const ref = owner ? `connection:${owner}/${connection.id}` : `connection:${connection.id}`;
            return (
              <StaggerItem key={ref}>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="font-mono">{connection.id}</CardTitle>
                    <CardDescription>{connection.description || "No description"}</CardDescription>
                    <CardAction className="flex items-center gap-2">
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
                    {owner && <Badge variant="secondary">Owned by {owner}</Badge>}
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
              Writes {directory}&lt;name&gt;.ts with defineMcpClientConnection or defineOpenAPIConnection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectionForm projectId={id} />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
