import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateModelAction } from "@/lib/actions";
import { listModels } from "@/lib/models";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, models] = await Promise.all([readProject(id), listModels()]);
  const { model } = project.agent;
  const known = models.some((candidate) => candidate.id === model.id);

  return (
    <div className="section" style={{ maxWidth: 600, width: "100%" }}>
      <form action={updateModelAction} className="section">
        <input type="hidden" name="id" value={id} />

        <Field>
            <FieldLabel htmlFor="modelId">Model</FieldLabel>
          <Input
            id="modelId"
            name="modelId"
            list="model-options"
            defaultValue={model.id}
            required
          />
          <datalist id="model-options">
            {models.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.provider} · {candidate.label}
              </option>
            ))}
          </datalist>
          <FieldDescription>
            {known
              ? "Written to agent.ts verbatim."
              : "Not in the known catalogue. It is still written verbatim, so a valid gateway id works."}
          </FieldDescription>
        </Field>

        <div className="grid-2">
          <Field>
            <FieldLabel htmlFor="temperature">Temperature</FieldLabel>
            <Input
              id="temperature"
              name="temperature"
              type="number"
              min={0}
              max={2}
              step={0.1}
              defaultValue={model.temperature ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="maxOutputTokens">Max output tokens</FieldLabel>
            <Input
              id="maxOutputTokens"
              name="maxOutputTokens"
              type="number"
              min={1}
              step={1}
              defaultValue={model.maxOutputTokens ?? ""}
            />
          </Field>
        </div>

        <div className="row">
          <Button type="submit">Save</Button>
          <Button asChild variant="ghost">
            <Link href={`/projects/${id}/files?path=agent.ts`}>View generated agent.ts</Link>
          </Button>
        </div>
      </form>

      {Object.keys(model.raw).length > 0 && (
        <section className="section">
          <h2 className="section-title">Options kept from your source</h2>
          <FieldDescription>
            EveLab has no control for these yet, so they are preserved exactly as written and
            re-emitted on save.
          </FieldDescription>
          <pre className="code mono">
            {Object.entries(model.raw)
              .map(([key, value]) => `${key}: ${value}`)
              .join("\n")}
          </pre>
        </section>
      )}
    </div>
  );
}
