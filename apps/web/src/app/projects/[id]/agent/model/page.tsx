import Link from "next/link";
import { agentPath } from "@evelab/eve-project";
import { Button } from "@/components/ui/button";
import { SettingCard } from "@/components/setting-card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateModelAction } from "@/lib/actions";
import { describeModel, listModels } from "@/lib/models";
import { getProject } from "@/lib/workspace";

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
  const [project, models] = await Promise.all([getProject(id), listModels()]);
  const { model, reasoning } = project.agent;
  const configPath = agentPath(project.root, "agent.ts");
  const configHref = `/projects/${id}/files?path=${encodeURIComponent(configPath)}`;
  const current = models.find((candidate) => candidate.id === model?.id);
  const known = !model?.id || Boolean(current);
  const details = current ? describeModel(current) : undefined;

  if (model?.expression) {
    return (
      <div className="settings-stack">
        <SettingCard
          title="Model"
          description="This agent builds its model in code, so evelab shows it and leaves it alone."
          footer={
            <>
              Defined in <code className="mono">{configPath}</code>.
            </>
          }
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={configHref}>Edit {configPath}</Link>
            </Button>
          }
        >
          <pre className="setting-preview">model: {model.expression}</pre>
        </SettingCard>
      </div>
    );
  }

  return (
    <form action={updateModelAction} className="settings-stack">
      <input type="hidden" name="id" value={id} />
      <SettingCard
        title="Model"
        description="The AI Gateway model the agent calls, and how much it reasons before answering."
        footer={
          <>
            Written to <code className="mono">{configPath}</code>.
          </>
        }
        action={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href={configHref}>View {configPath}</Link>
            </Button>
            <Button type="submit" size="sm">
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
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
                ? `${details ? `${current?.label}: ${details}.` : "An AI Gateway model id."}`
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
            <FieldDescription>Where the provider supports it.</FieldDescription>
          </Field>
        </div>
      </SettingCard>
    </form>
  );
}
