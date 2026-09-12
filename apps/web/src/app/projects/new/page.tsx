import Link from "next/link";
import { createProjectAction } from "@/lib/actions";
import { listModels } from "@/lib/models";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const models = await listModels();

  return (
    <main className="main">
      <div className="page" style={{ maxWidth: 560 }}>
        <header>
          <h1 className="page-title">Create Eve project</h1>
          <p className="page-description">
            EveLab writes a real Eve project: <code className="mono">agent.ts</code>,{" "}
            <code className="mono">instructions.md</code> and the directories you fill in as you go.
          </p>
        </header>

        <form action={createProjectAction} className="section">
          <div className="field">
            <label className="label" htmlFor="name">
              Name
            </label>
            <input className="input" id="name" name="name" required maxLength={80} autoFocus />
          </div>

          <div className="field">
            <label className="label" htmlFor="description">
              Description
            </label>
            <input className="input" id="description" name="description" maxLength={280} />
            <p className="helper">One sentence on what the agent is for. Optional.</p>
          </div>

          <div className="field">
            <label className="label" htmlFor="modelId">
              Model
            </label>
            <select className="select" id="modelId" name="modelId" defaultValue={models[0]?.id}>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.provider} · {model.label}
                </option>
              ))}
            </select>
            <p className="helper">Written to agent.ts as the model id. Change it any time.</p>
          </div>

          <div className="row">
            <button className="button" data-variant="primary" type="submit">
              Create project
            </button>
            <Link className="button" data-variant="ghost" href="/projects">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
