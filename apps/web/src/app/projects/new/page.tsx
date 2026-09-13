import Link from "next/link";
import { PlainShell } from "@/components/plain-shell";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProjectAction } from "@/lib/actions";
import { DEFAULT_MODEL_ID, listModels } from "@/lib/models";
import { requireAccount } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  await requireAccount();
  const models = await listModels();

  return (
    <PlainShell>
      <main className="main" id="main">
        <div className="page page-narrow">
          <Reveal>
            <header className="page-header">
              <div className="page-heading">
                <h1 className="page-title">Create Eve project</h1>
                <p className="page-description">
                  EveLab writes what <code className="mono">eve init</code> writes:{" "}
                  <code className="mono">package.json</code>, <code className="mono">agent/agent.ts</code>,{" "}
                  <code className="mono">agent/instructions.md</code> and the default eve channel. Tools,
                  skills and the rest follow as you add them.
                </p>
              </div>
              <div className="page-actions">
                <Button asChild variant="ghost">
                  <Link href="/projects/import">Import from GitHub</Link>
                </Button>
              </div>
            </header>
          </Reveal>

          <Reveal delay={0.06}>
            <Card>
              <form action={createProjectAction} className="contents">
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="name">Name</FieldLabel>
                      <Input id="name" name="name" required maxLength={80} autoFocus />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="description">Description</FieldLabel>
                      <Input id="description" name="description" maxLength={280} />
                      <FieldDescription>One sentence on what the agent is for. Optional.</FieldDescription>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="modelId">Model</FieldLabel>
                      <Select name="modelId" defaultValue={models.some((model) => model.id === DEFAULT_MODEL_ID) ? DEFAULT_MODEL_ID : models[0]?.id}>
                        <SelectTrigger id="modelId" className="w-full">
                          <SelectValue placeholder="Choose a model" />
                        </SelectTrigger>
                        <SelectContent>
                          {models.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.provider} · {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldDescription>Written to agent/agent.ts, the same file eve init creates. Change it any time.</FieldDescription>
                    </Field>
                  </FieldGroup>
                </CardContent>

                <CardFooter className="justify-end gap-2">
                  <Button asChild variant="ghost">
                    <Link href="/projects">Cancel</Link>
                  </Button>
                  <Button type="submit">Create project</Button>
                </CardFooter>
              </form>
            </Card>
          </Reveal>
        </div>
      </main>
    </PlainShell>
  );
}
