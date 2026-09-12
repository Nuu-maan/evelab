"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { connectRepositoryAction, createRepositoryAction } from "@/lib/actions";
import type { RepositoryOption } from "@/lib/source-types";
import "@/app/source.css";

export function ConnectRepository({
  projectId,
  suggestedName,
  repositories,
  listError,
  canCreate,
}: {
  projectId: string;
  suggestedName: string;
  repositories: RepositoryOption[];
  listError?: string;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [repository, setRepository] = useState("");
  const [branch, setBranch] = useState("");
  const [name, setName] = useState(suggestedName);
  const [isPrivate, setIsPrivate] = useState(true);
  const [message, setMessage] = useState("Initial commit from EveLab");
  const [busy, setBusy] = useState<"connect" | "create" | undefined>();
  const [error, setError] = useState<{ form: "connect" | "create"; text: string } | undefined>();

  const defaultBranch = repositories.find((option) => option.fullName === repository)?.defaultBranch;

  const connect = async () => {
    setBusy("connect");
    setError(undefined);
    const result = await connectRepositoryAction({ projectId, repository, branch: branch || undefined });
    setBusy(undefined);
    if (!result.ok) setError({ form: "connect", text: result.message });
    else router.refresh();
  };

  const create = async () => {
    setBusy("create");
    setError(undefined);
    const result = await createRepositoryAction({ projectId, name, isPrivate, message });
    setBusy(undefined);
    if (!result.ok) setError({ form: "create", text: result.message });
    else router.refresh();
  };

  return (
    <div className="grid-2 source-connect">
      <section className="panel" aria-label="Connect a repository">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void connect();
          }}
        >
          <div className="modal-body">
            <div className="section">
              <h2 className="section-title">Connect a repository</h2>
              <p className="page-description">
                Its branch becomes the starting point. Anything that differs in this project shows up
                as a change you can review and commit.
              </p>
            </div>
            <div className="field">
              <label className="label" htmlFor="connect-repository">
                Repository
              </label>
              <input
                className="input mono"
                id="connect-repository"
                list="connect-repository-options"
                placeholder="owner/name"
                value={repository}
                onChange={(event) => setRepository(event.target.value)}
                required
              />
              <datalist id="connect-repository-options">
                {repositories.map((option) => (
                  <option key={option.fullName} value={option.fullName}>
                    {option.private ? "Private" : "Public"}
                  </option>
                ))}
              </datalist>
              {listError && <p className="error-text">{listError}</p>}
            </div>
            <div className="field">
              <label className="label" htmlFor="connect-branch">
                Branch
              </label>
              <input
                className="input mono"
                id="connect-branch"
                placeholder={defaultBranch ?? "Default branch"}
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
              />
            </div>
            {error?.form === "connect" && <p className="error-text">{error.text}</p>}
          </div>
          <div className="modal-foot">
            <button className="button" data-variant="primary" type="submit" disabled={!repository || Boolean(busy)}>
              {busy === "connect" ? "Connecting" : "Connect"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel" aria-label="Create a repository">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <div className="modal-body">
            <div className="section">
              <h2 className="section-title">Create a repository</h2>
              <p className="page-description">
                A new repository on your account with this project as its first commit. Files your
                .gitignore excludes, and every .env file, stay here.
              </p>
            </div>
            <div className="field">
              <label className="label" htmlFor="create-name">
                Repository name
              </label>
              <input
                className="input mono"
                id="create-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                disabled={!canCreate}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="create-message">
                Commit message
              </label>
              <input
                className="input"
                id="create-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
                disabled={!canCreate}
              />
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(event) => setIsPrivate(event.target.checked)}
                disabled={!canCreate}
              />
              Private repository
            </label>
            {!canCreate && (
              <p className="helper">Creating personal repositories needs GITHUB_TOKEN rather than a GitHub App.</p>
            )}
            {error?.form === "create" && <p className="error-text">{error.text}</p>}
          </div>
          <div className="modal-foot">
            <button
              className="button"
              data-variant="primary"
              type="submit"
              disabled={!canCreate || !name || !message || Boolean(busy)}
            >
              {busy === "create" ? "Creating" : "Create repository and push"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
