import type { Metadata } from "next";
import { NewProjectWizard } from "@/components/new-project-wizard";
import { PlainShell } from "@/components/plain-shell";
import { Reveal } from "@/components/motion";
import { DEFAULT_MODEL_ID, listModels } from "@/lib/models";
import { requireAccount } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New project" };

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
                  The same questions <code className="mono">eve init</code> asks, and the same files it writes.
                </p>
              </div>
            </header>
          </Reveal>

          <Reveal delay={0.06}>
            <NewProjectWizard
              models={models}
              defaultModel={models.some((model) => model.id === DEFAULT_MODEL_ID) ? DEFAULT_MODEL_ID : (models[0]?.id ?? DEFAULT_MODEL_ID)}
            />
          </Reveal>
        </div>
      </main>
    </PlainShell>
  );
}
