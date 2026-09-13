import Link from "next/link";
import { IconLogoGithub } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { PlainShell } from "@/components/plain-shell";
import { Reveal } from "@/components/motion";
import { ImportRepository } from "@/components/source/import-repository";
import { Button } from "@/components/ui/button";
import { listAccessibleRepositories, sourceControlMessage, sourceControlMode } from "@/lib/git";
import { requireAccount } from "@/lib/session";
import type { RepositoryOption } from "@/lib/source-types";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireAccount();
  const mode = sourceControlMode();
  let repositories: RepositoryOption[] = [];
  let listError: string | undefined;
  if (mode) {
    try {
      repositories = await listAccessibleRepositories();
    } catch (error) {
      listError = sourceControlMessage(error) ?? "Could not list your repositories.";
    }
  }

  return (
    <PlainShell>
      <main className="main" id="main">
        <div className="page" style={{ maxWidth: 800 }}>
          <Reveal>
            <header className="page-header">
              <div className="page-heading">
                <h1 className="page-title">Import from GitHub</h1>
                <p className="page-description">
                  Open an existing Eve project. EveLab reads it without running anything, shows you
                  what it found, and stays connected so you can commit and pull.
                </p>
              </div>
              <div className="page-actions">
                <Button asChild variant="ghost">
                  <Link href="/projects/new">Start from scratch</Link>
                </Button>
              </div>
            </header>
          </Reveal>

          <Reveal delay={0.06}>
            {mode ? (
              <ImportRepository repositories={repositories} listError={listError} />
            ) : (
              <EmptyState icon={IconLogoGithub} title="GitHub is not configured.">
                Set GITHUB_TOKEN to a token that can read the repository, then restart EveLab. The token
                is read on the server only and never stored.
              </EmptyState>
            )}
          </Reveal>
        </div>
      </main>
    </PlainShell>
  );
}
