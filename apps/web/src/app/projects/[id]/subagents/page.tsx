import Link from "next/link";
import { agentPath } from "@evelab/eve-project";
import { IconUsers } from "@/components/icons";
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
import { createSubagentAction, deleteEntityAction } from "@/lib/actions";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default async function SubagentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);
  const directory = agentPath(project.root, "subagents/");

  return (
    <div className="page">
      <Reveal>
        <header className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Subagents</h1>
            <p className="page-description">
              Who your agent can delegate to. Each subagent is a directory under{" "}
              <code className="mono">{directory}</code> with its own agent.ts, instructions, tools and skills.
              It inherits nothing from the parent.
            </p>
          </div>
          <div className="page-actions">
            <Button asChild variant="outline">
              <Link href={`/projects/${id}/canvas`}>Open canvas</Link>
            </Button>
          </div>
        </header>
      </Reveal>

      {project.subagents.length === 0 ? (
        <Reveal delay={0.06}>
          <EmptyState icon={IconUsers} title="No subagents.">
            Create one when your agent needs specialised work with its own tools or model.
          </EmptyState>
        </Reveal>
      ) : (
        <Stagger className="section">
          {project.subagents.map((subagent) => {
            const local = subagent.kind === "local";
            const path = local ? `${directory}${subagent.id}/agent.ts` : `${directory}${subagent.id}.ts`;
            return (
              <StaggerItem key={subagent.id}>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="font-mono">{subagent.id}</CardTitle>
                    <CardDescription>{subagent.description || "No description"}</CardDescription>
                    <CardAction className="flex items-center gap-2">
                      <Button asChild variant="ghost">
                        <Link href={`/projects/${id}/files?path=${encodeURIComponent(path)}`}>Edit</Link>
                      </Button>
                      <form action={deleteEntityAction}>
                        <input type="hidden" name="projectId" value={id} />
                        <input type="hidden" name="ref" value={`subagent:${subagent.id}`} />
                        <ConfirmSubmit
                          title={`Delete ${subagent.id}?`}
                          description={
                            local
                              ? `Deletes ${directory}${subagent.id}/ with everything it owns.`
                              : `Deletes ${path}.`
                          }
                          confirmLabel="Delete"
                        >
                          Delete
                        </ConfirmSubmit>
                      </form>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    {local ? (
                      <>
                        <Badge variant="secondary" className="font-mono">
                          {subagent.model?.id || (subagent.model?.expression ? "model in code" : "default model")}
                        </Badge>
                        <Badge variant="secondary">{plural(subagent.tools.length, "tool")}</Badge>
                        <Badge variant="secondary">{plural(subagent.skills.length, "skill")}</Badge>
                        <Badge variant="secondary">{plural(subagent.connections.length, "connection")}</Badge>
                      </>
                    ) : (
                      <Badge variant="secondary">Remote agent</Badge>
                    )}
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      <Reveal delay={0.1}>
        <Card>
          <form action={createSubagentAction} className="contents">
            <CardHeader>
              <CardTitle>Create subagent</CardTitle>
              <CardDescription>Writes {directory}&lt;name&gt;/agent.ts and instructions.md.</CardDescription>
            </CardHeader>
            <CardContent>
              <input type="hidden" name="projectId" value={id} />
              <div className="grid-2">
                <Field>
                  <FieldLabel htmlFor="subagentId">Name</FieldLabel>
                  <Input
                    className="font-mono"
                    id="subagentId"
                    name="subagentId"
                    placeholder="researcher"
                    pattern="[A-Za-z0-9][A-Za-z0-9_\-]*"
                    required
                  />
                  <FieldDescription>The parent calls it by this name.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="modelId">Model</FieldLabel>
                  <Input
                    className="font-mono"
                    id="modelId"
                    name="modelId"
                    placeholder={project.agent.model?.id || DEFAULT_MODEL_ID}
                  />
                  <FieldDescription>Leave empty for Eve&apos;s default model.</FieldDescription>
                </Field>
              </div>
              <Field className="mt-4">
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Input id="description" name="description" maxLength={500} required />
                <FieldDescription>Required. The parent agent reads this to decide when to delegate.</FieldDescription>
              </Field>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit">Create subagent</Button>
            </CardFooter>
          </form>
        </Card>
      </Reveal>
    </div>
  );
}
