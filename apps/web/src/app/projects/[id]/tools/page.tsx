import Link from "next/link";
import { agentPath, type ToolKind } from "@evelab/eve-project";
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
import { createToolAction, deleteEntityAction } from "@/lib/actions";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<ToolKind, string> = {
  tool: "defineTool",
  workflow: "Workflow",
  provided: "Built-in",
  disabled: "Disabled built-in",
  dynamic: "Dynamic",
  other: "Module",
};

export default async function ToolsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);
  const directory = agentPath(project.root, "tools/");

  return (
    <div className="page">
      <Reveal>
        <header className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Tools</h1>
            <p className="page-description">
              What your agent can do. One file per tool under <code className="mono">{directory}</code>,
              named after the file: EveLab scaffolds it, then the source is yours.
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
            Create a TypeScript tool below. For a remote MCP server or OpenAPI service, add a connection
            instead: its tools appear to the model without any code.
          </EmptyState>
        </Reveal>
      ) : (
        <Stagger className="section">
          {project.tools.map((tool) => {
            const path = `${directory}${tool.file}`;
            return (
              <StaggerItem key={tool.id}>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="font-mono">{tool.id}</CardTitle>
                    <CardDescription>{tool.description || "No description"}</CardDescription>
                    <CardAction className="flex items-center gap-2">
                      <Badge variant="secondary">{KIND_LABELS[tool.kind]}</Badge>
                      <Button asChild variant="ghost">
                        <Link href={`/projects/${id}/files?path=${encodeURIComponent(path)}`}>Edit</Link>
                      </Button>
                      <form action={deleteEntityAction}>
                        <input type="hidden" name="projectId" value={id} />
                        <input type="hidden" name="ref" value={`tool:${tool.id}`} />
                        <ConfirmSubmit
                          title={`Remove ${tool.id}?`}
                          description={`Deletes ${path}. Commit first if you might want it back.`}
                          confirmLabel="Remove"
                        >
                          Remove
                        </ConfirmSubmit>
                      </form>
                    </CardAction>
                  </CardHeader>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      <Reveal delay={0.1}>
        <Card>
          <form action={createToolAction} className="contents">
            <CardHeader>
              <CardTitle>Create TypeScript tool</CardTitle>
              <CardDescription>Writes one defineTool file and opens it in Files.</CardDescription>
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
                    placeholder="search_docs"
                    pattern="[A-Za-z0-9][A-Za-z0-9_\-]*"
                    required
                  />
                  <FieldDescription>Letters, digits, - and _. Becomes {directory}&lt;name&gt;.ts.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Input id="description" name="description" maxLength={500} />
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
