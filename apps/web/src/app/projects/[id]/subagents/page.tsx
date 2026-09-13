import Link from "next/link";
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
import { createSubagentAction, deleteSubagentAction } from "@/lib/actions";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default async function SubagentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);

  return (
    <div className="page">
      <Reveal>
        <header className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Subagents</h1>
            <p className="page-description">
              Who your agent can delegate to. One markdown file per subagent under{" "}
              <code className="mono">subagents/</code>; the canvas shows the same thing as a graph.
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
            Create one when your agent needs specialised work.
          </EmptyState>
        </Reveal>
      ) : (
        <Stagger className="section">
          {project.subagents.map((subagent) => (
            <StaggerItem key={subagent.id}>
              <Card size="sm">
                <CardHeader>
                  <CardTitle>{subagent.name}</CardTitle>
                  <CardDescription>{subagent.description || "No description"}</CardDescription>
                  <CardAction className="flex items-center gap-2">
                    <Button asChild variant="ghost">
                      <Link href={`/projects/${id}/files?path=subagents/${subagent.id}.md`}>Edit</Link>
                    </Button>
                    <form action={deleteSubagentAction}>
                      <input type="hidden" name="projectId" value={id} />
                      <input type="hidden" name="subagentId" value={subagent.id} />
                      <ConfirmSubmit
                        title={`Delete ${subagent.name}?`}
                        description={`Deletes subagents/${subagent.id}.md. Tools and skills it owned go back to the agent.`}
                        confirmLabel="Delete"
                      >
                        Delete
                      </ConfirmSubmit>
                    </form>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-mono">
                    {subagent.model?.id ?? "inherits model"}
                  </Badge>
                  <Badge variant="secondary">{plural(subagent.tools.length, "tool")}</Badge>
                  <Badge variant="secondary">{plural(subagent.skills.length, "skill")}</Badge>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <Reveal delay={0.1}>
        <Card>
          <form action={createSubagentAction} className="contents">
            <CardHeader>
              <CardTitle>Create subagent</CardTitle>
              <CardDescription>Writes one markdown file under subagents/.</CardDescription>
            </CardHeader>
            <CardContent>
              <input type="hidden" name="projectId" value={id} />
              <div className="grid-2">
                <Field>
                  <FieldLabel htmlFor="subagentId">Id</FieldLabel>
                  <Input
                    className="font-mono"
                    id="subagentId"
                    name="subagentId"
                    placeholder="researcher"
                    pattern="[a-z0-9][a-z0-9-]*"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input id="name" name="name" placeholder="Researcher" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Input id="description" name="description" maxLength={280} />
                  <FieldDescription>The parent agent reads this to decide when to delegate.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="modelId">Model</FieldLabel>
                  <Input
                    className="font-mono"
                    id="modelId"
                    name="modelId"
                    placeholder={project.agent.model.id}
                  />
                  <FieldDescription>Leave empty to inherit the main agent&apos;s model.</FieldDescription>
                </Field>
              </div>
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
