import Link from "next/link";
import { PlainShell } from "@/components/plain-shell";
import { Reveal } from "@/components/motion";
import { createProjectAction } from "@/lib/actions";
import { listModels } from "@/lib/models";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
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
                EveLab writes <code className="mono">agent.ts</code> and{" "}
                <code className="mono">instructions.md</code> now, and the rest of the directories
                as you fill them in.
              </p>
            </div>
            <div className="page-actions">
              <Link className="button" data-variant="ghost" href="/projects/import">
                Import from GitHub
              </Link>
            </div>
          </header>
        </Reveal>

        <Reveal delay={0.06}>
          <form action={createProjectAction} className="panel">
            <div className="modal-body">
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
            </div>

            <div className="modal-foot">
              <Link className="button" data-variant="ghost" href="/projects">
                Cancel
              </Link>
              <button className="button" data-variant="primary" type="submit">
                Create project
              </button>
            </div>
          </form>
        </Reveal>
      </div>
      </main>
    </PlainShell>
  );
}
