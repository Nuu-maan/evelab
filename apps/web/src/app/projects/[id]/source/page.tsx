import { IconLogoGithub } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
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
        <p className="page-description">Review what changed, commit it to GitHub, and pull what changed there.</p>
      </div>
    </header>
  );

  if (!summary && !mode) {
    return (
      <div className="page">
        {header}
        <EmptyState icon={IconLogoGithub} title="GitHub is not configured.">
          Set GITHUB_TOKEN to a token with read and write access to repository contents, then restart
          EveLab. The token is read on the server only and never stored.
        </EmptyState>
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
          canCreate={mode === "token" || mode === "user"}
        />
      </div>
    );
  }

  return (
    <div className="page page-wide">
      {header}
      <SourceControl
        projectId={id}
        summary={summary}
        configured={Boolean(mode)}
        canPublish={mode === "token" || mode === "user"}
        suggestedName={id}
      />
    </div>
  );
}
