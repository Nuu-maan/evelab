import Link from "next/link";
import { agentPath } from "@evelab/eve-project";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateModelAction } from "@/lib/actions";
import { listModels } from "@/lib/models";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const REASONING = [
  { value: "provider-default", label: "Provider default" },
  { value: "none", label: "None" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
];

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, models] = await Promise.all([readProject(id), listModels()]);
  const { model, reasoning } = project.agent;
  const configPath = agentPath(project.root, "agent.ts");
  const configHref = `/projects/${id}/files?path=${encodeURIComponent(configPath)}`;
  const known = !model?.id || models.some((candidate) => candidate.id === model.id);

  if (model?.expression) {
    return (
      <div className="section" style={{ maxWidth: 600, width: "100%" }}>
        <p className="page-description">
          This agent builds its model in code, so EveLab shows it and leaves it alone:
        </p>
        <pre className="code mono">model: {model.expression}</pre>
        <Button asChild variant="outline" className="self-start">
          <Link href={configHref}>Edit {configPath}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="section" style={{ maxWidth: 600, width: "100%" }}>
      <form action={updateModelAction} className="section">
        <input type="hidden" name="id" value={id} />

        <Field>
          <FieldLabel htmlFor="modelId">Model</FieldLabel>
          <Input
            id="modelId"
            name="modelId"
            className="font-mono"
            list="model-options"
            defaultValue={model?.id ?? ""}
            placeholder="openai/gpt-5.6-luna-fast"
            required
          />
          <datalist id="model-options">
            {models.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </datalist>
          <FieldDescription>
            {known
              ? `An AI Gateway model id, written to ${configPath}. ${models.length} models in the catalog.`
              : "Not in the AI Gateway catalog. It is still written verbatim, so check the id."}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="reasoning">Reasoning</FieldLabel>
          <Select name="reasoning" defaultValue={reasoning ?? "provider-default"}>
            <SelectTrigger id="reasoning" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REASONING.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>How much the model thinks before it answers, where the provider supports it.</FieldDescription>
        </Field>

        <div className="row">
          <Button type="submit">Save</Button>
          <Button asChild variant="ghost">
            <Link href={configHref}>View {configPath}</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
