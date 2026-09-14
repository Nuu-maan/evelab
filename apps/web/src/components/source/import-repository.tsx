"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconWarning } from "@/components/icons";
import { FileIcon } from "@/components/files/file-icon";
import { Icon } from "@/components/icon";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
  initialRepository,
}: {
  repositories: RepositoryOption[];
  listError?: string;
  /** Prefilled from a link, such as a template's Import button. */
  initialRepository?: string;
}) {
  const router = useRouter();
  const [repository, setRepository] = useState(initialRepository ?? "");
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
      router.push(`/projects/${result.projectId}/canvas`);
      return;
    }
    setBusy(undefined);
    setError(result.message);
  };

  const errors = preview?.issues.filter((issue) => issue.level === "error") ?? [];
  const warnings = preview?.issues.filter((issue) => issue.level === "warning") ?? [];

  return (
    <div className="section" style={{ gap: "var(--space-4)" }}>
      <Card>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            void read();
          }}
        >
          <CardContent className="flex flex-col gap-4">
            <div className="grid-2">
              <Field>
                <FieldLabel htmlFor="import-repository">Repository</FieldLabel>
                <Input
                  className="font-mono"
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
                {listError && <FieldError>{listError}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="import-branch">Branch</FieldLabel>
                <Input
                  className="font-mono"
                  id="import-branch"
                  placeholder="Default branch"
                  value={branch}
                  onChange={(event) => {
                    setBranch(event.target.value);
                    setPreview(undefined);
                  }}
                />
              </Field>
            </div>
            <FieldDescription>
              EveLab reads the branch and shows what it found. Nothing is written until you import.
            </FieldDescription>
            {error && <FieldError>{error}</FieldError>}
          </CardContent>
          <CardFooter className="justify-end">
            <Button variant={preview ? "outline" : "default"} type="submit" disabled={!repository || Boolean(busy)}>
              {busy === "read" ? "Reading" : "Read repository"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {preview && (
        <Card role="region" aria-label="Review import" className="import-review">
          <CardHeader>
            <CardTitle>{preview.agentName ?? preview.repository}</CardTitle>
            <CardDescription>
              <span className="mono">{preview.repository}</span> on{" "}
              <span className="mono">{preview.branch}</span> at{" "}
              <span className="mono">{preview.commit.slice(0, 7)}</span>, {preview.files.length}{" "}
              {preview.files.length === 1 ? "file" : "files"}.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            {preview.blocker && <FieldError>{preview.blocker}</FieldError>}

            {errors.length + warnings.length + preview.parseWarnings.length > 0 && (
              <div className="section">
                <p className="label">What EveLab noticed</p>
                <ul className="list">
                  {[...errors, ...warnings].map((issue, index) => (
                    <li className="list-item" key={`${issue.at}-${index}`}>
                      <span className={issue.level === "error" ? "error-text" : "list-item-detail"}>
                        {issue.message}
                      </span>
                      <code className="mono hint">{issue.at}</code>
                    </li>
                  ))}
                  {preview.parseWarnings.map((warning, index) => (
                    <li className="list-item" key={`${warning.path}-${index}`}>
                      <span className="list-item-detail">{warning.message}</span>
                      <code className="mono hint">{warning.path}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.warnings.length > 0 && (
              <div className="section">
                <p className="label">Not imported</p>
                {preview.warnings.map((warning) => (
                  <Alert key={warning}>
                    <Icon icon={IconWarning} className="text-warning" />
                    <AlertTitle className="font-normal">{warning}</AlertTitle>
                  </Alert>
                ))}
              </div>
            )}

            <div className="section">
              <p className="label">Files</p>
              <ul className="import-files">
                {preview.files.map((file) => (
                  <li className="import-file" key={file.path}>
                    <FileIcon name={file.path} />
                    <span className="mono">{file.path}</span>
                    <span className="import-file-size">{size(file.bytes)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>

          <CardFooter className="justify-end">
            <Button
              type="button"
              disabled={Boolean(preview.blocker) || Boolean(busy)}
              onClick={() => void importProject()}
            >
              {busy === "import" ? "Importing" : "Import project"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
