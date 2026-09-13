import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateAgentAction } from "@/lib/actions";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AgentGeneralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);

  return (
    <Card style={{ maxWidth: 600 }}>
      <form action={updateAgentAction} className="contents">
        <CardContent>
          <input type="hidden" name="id" value={id} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" className="font-mono" value={project.agent.name} readOnly />
              <FieldDescription>Eve names the agent after package.json, so rename it there.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Input
                id="description"
                name="description"
                defaultValue={project.agent.description ?? ""}
                maxLength={280}
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit">Save</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
