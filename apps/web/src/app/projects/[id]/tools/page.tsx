import Link from "next/link";
import { IconWrench } from "@/components/icons";
import { ConfirmSubmit } from "@/components/confirm";
import { EmptyState } from "@/components/empty-state";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createToolAction, deleteToolAction } from "@/lib/actions";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ToolsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);

  return (
    <div className="page">
      <Reveal>
        <header className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Tools</h1>
            <p className="page-description">
              What your agent can do. One file per tool under <code className="mono">tools/</code>:
              EveLab scaffolds it, then the source is yours.
            </p>
          </div>
          <div className="page-actions">
            <Button asChild variant="outline">
              <Link href={`/projects/${id}/canvas`}>Add on the canvas</Link>
            </Button>
          </div>
        </header>
      </Reveal>

      {project.tools.length === 0 ? (
        <Reveal delay={0.06}>
          <EmptyState icon={IconWrench} title="Your agent has no tools.">
            Create a TypeScript tool below, or drag one onto the canvas. MCP server import is not built
            yet.
          </EmptyState>
        </Reveal>
      ) : (
        <Stagger className="section">
          {project.tools.map((tool) => (
            <StaggerItem key={tool.id}>
              <Card size="sm">
                <CardHeader>
                  <CardTitle className="font-mono">{tool.name}</CardTitle>
                  <CardDescription>{tool.description || "No description"}</CardDescription>
                  <CardAction className="flex items-center gap-2">
                    <Badge variant="secondary">{tool.origin}</Badge>
                    <Button asChild variant="ghost">
                      <Link href={`/projects/${id}/files?path=tools/${tool.id}.ts`}>Edit</Link>
                    </Button>
                    <form action={deleteToolAction}>
                      <input type="hidden" name="projectId" value={id} />
                      <input type="hidden" name="toolId" value={tool.id} />
                      <ConfirmSubmit
                        title={`Remove ${tool.name}?`}
                        description={`Deletes tools/${tool.id}.ts. Commit first if you might want it back.`}
                        confirmLabel="Remove"
                      >
                        Remove
                      </ConfirmSubmit>
                    </form>
                  </CardAction>
                </CardHeader>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <Reveal delay={0.1}>
        <Card>
          <form action={createToolAction} className="contents">
            <CardHeader>
              <CardTitle>Create TypeScript tool</CardTitle>
              <CardDescription>Writes one file under tools/ and opens it in Files.</CardDescription>
            </CardHeader>
            <CardContent>
              <input type="hidden" name="projectId" value={id} />
              <input type="hidden" name="openSource" value="true" />
              <div className="grid-2">
                <Field>
                  <FieldLabel htmlFor="toolId">Tool name</FieldLabel>
                  <Input
                    className="font-mono"
                    id="toolId"
                    name="toolId"
                    placeholder="search-docs"
                    pattern="[a-z0-9][a-z0-9-]*"
                    required
                  />
                  <FieldDescription>Lowercase and dashes. Becomes tools/&lt;name&gt;.ts.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Input id="description" name="description" maxLength={280} />
                  <FieldDescription>The model reads this to decide when to call it.</FieldDescription>
                </Field>
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit">Create and open source</Button>
            </CardFooter>
          </form>
        </Card>
      </Reveal>
    </div>
  );
}
