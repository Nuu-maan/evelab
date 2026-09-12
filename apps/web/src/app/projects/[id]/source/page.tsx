import { ConnectRepository } from "@/components/source/connect-repository";
import { SourceControl } from "@/components/source/source-control";
import {
  getSourceSummary,
  listAccessibleRepositories,
  sourceControlMessage,
  sourceControlMode,
} from "@/lib/git";
import type { RepositoryOption } from "@/lib/source-types";

export const dynamic = "force-dynamic";

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mode = sourceControlMode();
  const summary = await getSourceSummary(id, { fresh: true });

  const header = (
    <header className="page-header">
      <div className="page-heading">
        <h1 className="page-title">Source control</h1>
        <p className="page-description">
          Commit this project to GitHub and pull changes made there. Nothing is committed until you
          write a message and ask for it.
        </p>
      </div>
    </header>
  );

  if (!summary && !mode) {
    return (
      <div className="page">
        {header}
        <div className="empty">
          <p className="empty-title">GitHub is not configured.</p>
          <p className="empty-body">
            Set GITHUB_TOKEN to a token with read and write access to repository contents, then
            restart EveLab. The token is read on the server only and never stored.
          </p>
        </div>
      </div>
    );
  }

  if (!summary) {
    let repositories: RepositoryOption[] = [];
    let listError: string | undefined;
    try {
      repositories = await listAccessibleRepositories();
    } catch (error) {
      listError = sourceControlMessage(error) ?? "Could not list your repositories.";
    }
    return (
      <div className="page">
        {header}
        <ConnectRepository
          projectId={id}
          suggestedName={id}
          repositories={repositories}
          listError={listError}
          canCreate={mode === "token"}
        />
      </div>
    );
  }

  return (
    <div className="page page-wide">
      {header}
      <SourceControl projectId={id} summary={summary} configured={Boolean(mode)} />
    </div>
  );
}
