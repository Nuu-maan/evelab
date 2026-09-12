import Link from "next/link";
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
    <div className="section" style={{ maxWidth: 560, marginInline: "auto", width: "100%" }}>
      <form action={updateModelAction} className="section">
        <input type="hidden" name="id" value={id} />

        <div className="field">
          <label className="label" htmlFor="modelId">
            Model
          </label>
          <input
            className="input"
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
          <p className="helper">
            {known
              ? "Written to agent.ts verbatim."
              : "Not in the known catalogue. It is still written verbatim, so a valid gateway id works."}
          </p>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="label" htmlFor="temperature">
              Temperature
            </label>
            <input
              className="input"
              id="temperature"
              name="temperature"
              type="number"
              min={0}
              max={2}
              step={0.1}
              defaultValue={model.temperature ?? ""}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="maxOutputTokens">
              Max output tokens
            </label>
            <input
              className="input"
              id="maxOutputTokens"
              name="maxOutputTokens"
              type="number"
              min={1}
              step={1}
              defaultValue={model.maxOutputTokens ?? ""}
            />
          </div>
        </div>

        <div className="row">
          <button className="button" data-variant="primary" type="submit">
            Save
          </button>
          <Link className="button" data-variant="ghost" href={`/projects/${id}/files?path=agent.ts`}>
            View generated agent.ts
          </Link>
        </div>
      </form>

      {Object.keys(model.raw).length > 0 && (
        <section className="section">
          <h2 className="section-title">Options kept from your source</h2>
          <p className="helper">
            EveLab has no control for these yet, so they are preserved exactly as written and
            re-emitted on save.
          </p>
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
