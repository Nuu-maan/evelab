"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpRight, GitBranch, Undo2 } from "lucide-react";
import { CodeDiffEditor, languageFor } from "@/components/editor";
import { FileIcon } from "@/components/files/file-icon";
import { Shortcut } from "@/components/shortcut";
import { commitAction, discardChangeAction, pullAction } from "@/lib/actions";
import type { ChangeKind, SourceSummary } from "@/lib/source-types";
import "@/app/source.css";

const LETTER: Record<ChangeKind, string> = { added: "A", modified: "M", deleted: "D" };

type Notice = { tone: "ready" | "modified" | "error"; text: string; paths?: string[] };

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function since(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function SourceControl({
  projectId,
  summary,
  configured,
}: {
  projectId: string;
  summary: SourceSummary;
  configured: boolean;
}) {
  const router = useRouter();
  const { changes } = summary;
  const [selectedPath, setSelectedPath] = useState(changes[0]?.path);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | undefined>();
  const [notice, setNotice] = useState<Notice | undefined>();

  useEffect(() => {
    if (!changes.some((change) => change.path === selectedPath)) setSelectedPath(changes[0]?.path);
  }, [changes, selectedPath]);

  const selected = useMemo(
    () => changes.find((change) => change.path === selectedPath),
    [changes, selectedPath],
  );

  const blockedByRemote = summary.remoteMoved === true;
  const canCommit = configured && changes.length > 0 && message.trim().length > 0 && !busy && !blockedByRemote;

  const commit = async () => {
    if (!canCommit) return;
    setBusy("commit");
    setNotice(undefined);
    const result = await commitAction({ projectId, message });
    setBusy(undefined);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      return;
    }
    setMessage("");
    setNotice({ tone: "ready", text: `Committed ${plural(result.files, "file")} as ${result.commit.slice(0, 7)}.` });
    router.refresh();
  };

  const pull = async () => {
    setBusy("pull");
    setNotice(undefined);
    const response = await pullAction({ projectId });
    setBusy(undefined);
    if (!response.ok) {
      setNotice({ tone: "error", text: response.message });
      return;
    }
    const { result } = response;
    if (result.status === "up-to-date") setNotice({ tone: "ready", text: "Already up to date with GitHub." });
    if (result.status === "pulled") {
      const parts = [plural(result.written, "file")];
      if (result.removed > 0) parts.push(`removed ${plural(result.removed, "file")}`);
      setNotice({ tone: "ready", text: `Pulled ${parts.join(", ")}.` });
    }
    if (result.status === "conflicts") {
      setNotice({
        tone: "error",
        text: "Nothing was pulled. These files changed here and on GitHub. Discard or copy your version, then pull again.",
        paths: result.conflicts,
      });
    }
    router.refresh();
  };

  const discard = async (path: string, kind: ChangeKind) => {
    const question =
      kind === "added"
        ? `Delete ${path}? It is not on GitHub, so this cannot be undone.`
        : `Discard your changes to ${path}?`;
    if (!confirm(question)) return;
    setBusy(path);
    const result = await discardChangeAction({ projectId, path });
    setBusy(undefined);
    if (!result.ok) setNotice({ tone: "error", text: result.message });
    router.refresh();
  };

  const onMessageKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void commit();
    }
  };

  return (
    <div className="source">
      <section className="panel source-repo" aria-label="Repository">
        <span className="source-repo-icon" aria-hidden="true">
          <GitBranch strokeWidth={1.5} />
        </span>
        <div className="source-repo-text">
          <a className="source-repo-name" href={summary.url} target="_blank" rel="noreferrer noopener">
            {summary.repository}
            <ArrowUpRight aria-hidden="true" strokeWidth={1.5} />
          </a>
          <p className="source-repo-meta">
            <span className="badge">{summary.branch}</span>
            <span className="mono">{summary.commit ? summary.commit.slice(0, 7) : "No commits yet"}</span>
            <span suppressHydrationWarning>Synced {since(summary.syncedAt)}</span>
          </p>
        </div>
        <div className="source-repo-remote">
          {summary.remoteError ? (
            <span className="status" data-tone="error">
              {summary.remoteError}
            </span>
          ) : summary.remoteMoved ? (
            <span className="status" data-tone="modified">
              New commits on GitHub
            </span>
          ) : summary.remoteMoved === false ? (
            <span className="status" data-tone="ready">
              Up to date with GitHub
            </span>
          ) : null}
          <button
            className="button"
            type="button"
            onClick={() => void pull()}
            disabled={!configured || Boolean(busy)}
          >
            <ArrowDown aria-hidden="true" strokeWidth={1.5} />
            {busy === "pull" ? "Pulling" : "Pull"}
          </button>
        </div>
      </section>

      {!configured && (
        <p className="notice">
          GitHub is not configured, so EveLab can show changes but cannot commit or pull. Set
          GITHUB_TOKEN and restart.
        </p>
      )}

      {notice && (
        <div className="source-notice" data-tone={notice.tone} role="status">
          <p>{notice.text}</p>
          {notice.paths && (
            <ul>
              {notice.paths.map((path) => (
                <li className="mono" key={path}>
                  {path}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section className="panel source-workbench">
        <div className="source-side">
          <form
            className="source-commit"
            onSubmit={(event) => {
              event.preventDefault();
              void commit();
            }}
          >
            <textarea
              className="textarea"
              aria-label="Commit message"
              placeholder="Describe what changed"
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={onMessageKey}
            />
            <div className="row">
              <button className="button" data-variant="primary" type="submit" disabled={!canCommit}>
                <ArrowUp aria-hidden="true" strokeWidth={1.5} />
                {busy === "commit" ? "Committing" : "Commit and push"}
              </button>
              <Shortcut keys="Enter" />
            </div>
            {blockedByRemote && <p className="helper">Pull first: GitHub has commits this project does not.</p>}
          </form>

          <div className="source-changes-head">
            <span>Changes</span>
            <span className="badge">{changes.length}</span>
          </div>

          {changes.length === 0 ? (
            <p className="source-empty">
              No local changes. The project matches{" "}
              {summary.commit ? <span className="mono">{summary.commit.slice(0, 7)}</span> : "GitHub"}.
            </p>
          ) : (
            <ul className="source-list" aria-label="Changes">
              {changes.map((change) => {
                const slash = change.path.lastIndexOf("/");
                const name = change.path.slice(slash + 1);
                const directory = slash === -1 ? "" : change.path.slice(0, slash);
                return (
                  <li className="source-row" key={change.path} aria-current={change.path === selectedPath || undefined}>
                    <button
                      className="source-row-main"
                      type="button"
                      onClick={() => setSelectedPath(change.path)}
                      title={change.path}
                    >
                      <FileIcon name={name} />
                      <span className="source-row-name" data-change={change.kind}>
                        {name}
                      </span>
                      <span className="source-row-directory">{directory}</span>
                    </button>
                    <button
                      className="button source-row-discard"
                      data-variant="ghost"
                      data-size="icon-small"
                      type="button"
                      aria-label={`Discard changes to ${change.path}`}
                      title="Discard changes"
                      disabled={Boolean(busy)}
                      onClick={() => void discard(change.path, change.kind)}
                    >
                      <Undo2 aria-hidden="true" strokeWidth={1.5} />
                    </button>
                    <span className="source-letter" data-change={change.kind} title={change.kind}>
                      {LETTER[change.kind]}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="source-diff">
          {selected ? (
            <>
              <div className="editor-bar">
                <span className="source-diff-path">
                  <FileIcon name={selected.path} />
                  <span className="mono">{selected.path}</span>
                </span>
                <span className="source-letter" data-change={selected.kind}>
                  {selected.kind}
                </span>
              </div>
              <div className="editor-host">
                <CodeDiffEditor
                  original={selected.original}
                  modified={selected.modified}
                  language={languageFor(selected.path)}
                />
              </div>
            </>
          ) : (
            <p className="source-diff-empty">Select a change to see what is different from GitHub.</p>
          )}
        </div>
      </section>
    </div>
  );
}
