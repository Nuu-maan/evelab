"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileIcon } from "@/components/files/file-icon";
import { importRepositoryAction, previewImportAction } from "@/lib/actions";
import type { ImportPreview, RepositoryOption } from "@/lib/source-types";
import "@/app/source.css";

function size(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Import is two steps, like skill import: read the branch and show everything
 * EveLab found and skipped, then write the exact commit that was reviewed.
 */
export function ImportRepository({
  repositories,
  listError,
}: {
  repositories: RepositoryOption[];
  listError?: string;
}) {
  const router = useRouter();
  const [repository, setRepository] = useState("");
  const [branch, setBranch] = useState("");
  const [preview, setPreview] = useState<ImportPreview | undefined>();
  const [busy, setBusy] = useState<"read" | "import" | undefined>();
  const [error, setError] = useState<string | undefined>();

  const read = async () => {
    setBusy("read");
    setError(undefined);
    setPreview(undefined);
    const result = await previewImportAction({ repository, branch: branch || undefined });
    setBusy(undefined);
    if (result.ok) setPreview(result.preview);
    else setError(result.message);
  };

  const importProject = async () => {
    if (!preview) return;
    setBusy("import");
    setError(undefined);
    const result = await importRepositoryAction({
      repository: preview.repository,
      branch: preview.branch,
      commit: preview.commit,
    });
    if (result.ok) {
      router.push(`/projects/${result.projectId}`);
      return;
    }
    setBusy(undefined);
    setError(result.message);
  };

  const errors = preview?.issues.filter((issue) => issue.level === "error") ?? [];
  const warnings = preview?.issues.filter((issue) => issue.level === "warning") ?? [];

  return (
    <div className="section" style={{ gap: "var(--space-4)" }}>
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          void read();
        }}
      >
        <div className="modal-body">
          <div className="grid-2">
            <div className="field">
              <label className="label" htmlFor="import-repository">
                Repository
              </label>
              <input
                className="input mono"
                id="import-repository"
                list="import-repository-options"
                placeholder="owner/name"
                value={repository}
                onChange={(event) => {
                  setRepository(event.target.value);
                  setPreview(undefined);
                }}
                required
                autoFocus
              />
              <datalist id="import-repository-options">
                {repositories.map((option) => (
                  <option key={option.fullName} value={option.fullName} />
                ))}
              </datalist>
              {listError && <p className="error-text">{listError}</p>}
            </div>
            <div className="field">
              <label className="label" htmlFor="import-branch">
                Branch
              </label>
              <input
                className="input mono"
                id="import-branch"
                placeholder="Default branch"
                value={branch}
                onChange={(event) => {
                  setBranch(event.target.value);
                  setPreview(undefined);
                }}
              />
            </div>
          </div>
          <p className="helper">
            EveLab reads the branch and shows what it found. Nothing is written until you import.
          </p>
          {error && <p className="error-text">{error}</p>}
        </div>
        <div className="modal-foot">
          <button className="button" data-variant={preview ? undefined : "primary"} type="submit" disabled={!repository || Boolean(busy)}>
            {busy === "read" ? "Reading" : "Read repository"}
          </button>
        </div>
      </form>

      {preview && (
        <section className="panel import-review" aria-label="Review import">
          <div className="modal-body">
            <div className="section">
              <h2 className="section-title">{preview.agentName ?? preview.repository}</h2>
              <p className="page-description">
                <span className="mono">{preview.repository}</span> on{" "}
                <span className="mono">{preview.branch}</span> at{" "}
                <span className="mono">{preview.commit.slice(0, 7)}</span>, {preview.files.length}{" "}
                {preview.files.length === 1 ? "file" : "files"}.
              </p>
            </div>

            {preview.blocker && <p className="error-text">{preview.blocker}</p>}

            {errors.length + warnings.length + preview.parseWarnings.length > 0 && (
              <div className="section">
                <p className="label">What EveLab noticed</p>
                <ul className="list">
                  {[...errors, ...warnings].map((issue, index) => (
                    <li className="list-item" key={`${issue.at}-${index}`}>
                      <span className={issue.level === "error" ? "error-text" : "list-item-detail"}>
                        {issue.message}
                      </span>
                      <code className="mono palette-hint">{issue.at}</code>
                    </li>
                  ))}
                  {preview.parseWarnings.map((warning, index) => (
                    <li className="list-item" key={`${warning.path}-${index}`}>
                      <span className="list-item-detail">{warning.message}</span>
                      <code className="mono palette-hint">{warning.path}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.warnings.length > 0 && (
              <div className="section">
                <p className="label">Not imported</p>
                <ul className="list">
                  {preview.warnings.map((warning) => (
                    <li className="notice" key={warning}>
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="section">
              <p className="label">Files</p>
              <ul className="panel import-files">
                {preview.files.map((file) => (
                  <li className="import-file" key={file.path}>
                    <FileIcon name={file.path} />
                    <span className="mono">{file.path}</span>
                    <span className="import-file-size">{size(file.bytes)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="modal-foot">
            <button
              className="button"
              data-variant="primary"
              type="button"
              disabled={Boolean(preview.blocker) || Boolean(busy)}
              onClick={() => void importProject()}
            >
              {busy === "import" ? "Importing" : "Import project"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
