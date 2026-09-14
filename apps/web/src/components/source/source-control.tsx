"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowUpRight,
  IconCheckCircle,
  IconChevronDown,
  IconChevronUp,
  IconCrossCircle,
  IconFileText,
  IconGitBranch,
  IconInformation,
  IconLockClosed,
  IconLogoGithub,
  IconMoreVertical,
  IconRotateCounterClockwise,
  IconRoute,
} from "@/components/icons";
import { ConfirmDialog } from "@/components/confirm";
import { CodeDiffEditor, languageFor } from "@/components/editor";
import { FileIcon } from "@/components/files/file-icon";
import { Icon } from "@/components/icon";
import { Shortcut } from "@/components/shortcut";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  commitAction,
  disconnectRepositoryAction,
  discardChangeAction,
  publishToOwnRepositoryAction,
  pullAction,
} from "@/lib/actions";
import type { ChangeKind, SourceSummary } from "@/lib/source-types";
import "@/app/source.css";

const LETTER: Record<ChangeKind, string> = { added: "A", modified: "M", deleted: "D" };
const KIND_LABEL: Record<ChangeKind, string> = { added: "Added", modified: "Modified", deleted: "Deleted" };

type Notice = { tone: "ready" | "error"; text: string; paths?: string[] };

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

/**
 * Source control for a project linked to a GitHub repository: where it stands against GitHub,
 * what changed, and the one next step. A repository these credentials cannot push to is shown
 * as read only, with publishing to the person's own account as the way forward.
 */
export function SourceControl({
  projectId,
  summary,
  configured,
  canPublish,
  suggestedName,
}: {
  projectId: string;
  summary: SourceSummary;
  configured: boolean;
  canPublish: boolean;
  suggestedName: string;
}) {
  const router = useRouter();
  const { changes } = summary;
  const [selectedPath, setSelectedPath] = useState(changes[0]?.path);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | undefined>();
  const [notice, setNotice] = useState<Notice | undefined>();
  const [discarding, setDiscarding] = useState<{ path: string; kind: ChangeKind } | undefined>();
  const [disconnecting, setDisconnecting] = useState(false);
  const [publishName, setPublishName] = useState(suggestedName);
  const [publishPrivate, setPublishPrivate] = useState(true);

  useEffect(() => {
    if (!changes.some((change) => change.path === selectedPath)) setSelectedPath(changes[0]?.path);
  }, [changes, selectedPath]);

  const selectedIndex = useMemo(() => changes.findIndex((change) => change.path === selectedPath), [changes, selectedPath]);
  const selected = selectedIndex === -1 ? undefined : changes[selectedIndex];
  const tally = useMemo(() => {
    const counts: Record<ChangeKind, number> = { added: 0, modified: 0, deleted: 0 };
    for (const change of changes) counts[change.kind] += 1;
    return counts;
  }, [changes]);

  const owner = summary.repository.split("/")[0] ?? summary.repository;
  const readOnly = summary.canPush === false;
  const blockedByRemote = summary.remoteMoved === true;
  const canCommit = configured && !readOnly && changes.length > 0 && message.trim().length > 0 && !busy && !blockedByRemote;

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
    setNotice({ tone: "ready", text: `Committed ${plural(result.files, "file")} as ${result.commit.slice(0, 7)} and pushed to ${summary.branch}.` });
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

  const publish = async () => {
    setBusy("publish");
    setNotice(undefined);
    const result = await publishToOwnRepositoryAction({
      projectId,
      name: publishName,
      isPrivate: publishPrivate,
      message: `Start from ${summary.repository}`,
    });
    setBusy(undefined);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.message });
      // A repository may have been created before the failure, so show where the project is linked now.
      router.refresh();
      return;
    }
    setNotice({ tone: "ready", text: `Published to ${result.repository} with ${plural(result.files, "file")}.` });
    router.refresh();
  };

  const discard = async (path: string) => {
    setBusy(path);
    const result = await discardChangeAction({ projectId, path });
    setBusy(undefined);
    if (!result.ok) setNotice({ tone: "error", text: result.message });
    router.refresh();
  };

  const disconnect = async () => {
    const form = new FormData();
    form.set("projectId", projectId);
    await disconnectRepositoryAction(form);
    router.refresh();
  };

  const onMessageKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void commit();
    }
  };

  const status = summary.remoteError ? (
    <span className="status" data-tone="error">
      {summary.remoteError}
    </span>
  ) : readOnly ? (
    <span className="source-readonly">
      <Icon icon={IconLockClosed} size={13} />
      Read only
    </span>
  ) : summary.remoteMoved ? (
    <span className="status" data-tone="modified">
      New commits on GitHub
    </span>
  ) : summary.remoteMoved === false ? (
    <span className="status" data-tone="ready">
      Up to date
    </span>
  ) : null;

  return (
    <div className="source">
      <section className="source-bar" aria-label="Repository">
        <span className="source-bar-icon" aria-hidden="true">
          <Icon icon={IconLogoGithub} size={20} />
        </span>
        <div className="source-bar-text">
          <a className="source-bar-name" href={summary.url} target="_blank" rel="noreferrer noopener">
            <span>{summary.repository}</span>
            <Icon icon={IconArrowUpRight} size={13} />
          </a>
          <p className="source-bar-meta">
            <span className="source-chip">
              <Icon icon={IconGitBranch} size={12} />
              {summary.branch}
            </span>
            <span className="mono">{summary.commit ? summary.commit.slice(0, 7) : "No commits yet"}</span>
            <span suppressHydrationWarning>Synced {since(summary.syncedAt)}</span>
          </p>
        </div>
        <div className="source-bar-end">
          {status}
          <Button
            variant={blockedByRemote ? "default" : "outline"}
            size="sm"
            type="button"
            onClick={() => void pull()}
            disabled={!configured || Boolean(busy)}
          >
            <Icon icon={IconArrowDown} />
            {busy === "pull" ? "Pulling" : "Pull"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" type="button" aria-label="Repository options">
                <Icon icon={IconMoreVertical} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={summary.url} target="_blank" rel="noreferrer noopener">
                  <Icon icon={IconArrowUpRight} />
                  Open on GitHub
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDisconnecting(true)}>
                Disconnect repository
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>

      {!configured && (
        <Alert>
          <Icon icon={IconInformation} />
          <AlertTitle className="font-normal">Sign in with GitHub to commit and pull. Changes still show here.</AlertTitle>
        </Alert>
      )}

      {notice && (
        <Alert role="status" variant={notice.tone === "error" ? "destructive" : "default"}>
          <Icon icon={notice.tone === "error" ? IconCrossCircle : IconCheckCircle} className={notice.tone === "error" ? undefined : "text-success"} />
          <AlertTitle className="font-normal text-foreground">{notice.text}</AlertTitle>
          {notice.paths && (
            <AlertDescription>
              <ul className="list-disc ps-4">
                {notice.paths.map((path) => (
                  <li className="mono" key={path}>
                    {path}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}

      {readOnly && (
        <section className="source-publish" aria-label="Publish to your GitHub">
          <div className="source-publish-text">
            <h2>
              <Icon icon={IconLockClosed} size={15} />
              This repository belongs to {owner}
            </h2>
            <p>You can pull from it, but not push. Publish the project to your own GitHub to commit your changes.</p>
          </div>
          {canPublish ? (
            <form
              className="source-publish-form"
              onSubmit={(event) => {
                event.preventDefault();
                void publish();
              }}
            >
              <label className="source-publish-field">
                <span>Repository name</span>
                <Input className="font-mono" value={publishName} onChange={(event) => setPublishName(event.target.value)} required />
              </label>
              <label className="source-publish-check">
                <Checkbox checked={publishPrivate} onCheckedChange={(checked) => setPublishPrivate(checked === true)} />
                Private
              </label>
              <Button type="submit" disabled={!publishName || Boolean(busy)}>
                <Icon icon={IconArrowUp} />
                {busy === "publish" ? "Publishing" : "Publish to my GitHub"}
              </Button>
            </form>
          ) : (
            <p className="hint">Publishing needs a signed-in GitHub account.</p>
          )}
        </section>
      )}

      {changes.length === 0 ? (
        <section className="source-clean" aria-label="No changes">
          <span className="source-clean-icon" aria-hidden="true">
            <Icon icon={IconCheckCircle} size={22} />
          </span>
          <h2>Everything is committed</h2>
          <p>
            This project matches {summary.commit ? <span className="mono">{summary.commit.slice(0, 7)}</span> : "GitHub"} on{" "}
            <span className="mono">{summary.branch}</span>. Change something on the canvas or in Files and it shows up here.
          </p>
          <div className="row">
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${projectId}/canvas`}>
                <Icon icon={IconRoute} />
                Open canvas
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${projectId}/files`}>
                <Icon icon={IconFileText} />
                Open files
              </Link>
            </Button>
          </div>
        </section>
      ) : (
        <div className="source-workbench">
          <aside className="source-side" aria-label="Changes">
            <div className="source-side-head">
              <span>Changes</span>
              <span className="source-count">{changes.length}</span>
              <span className="source-tally">
                {(["added", "modified", "deleted"] as const)
                  .filter((kind) => tally[kind] > 0)
                  .map((kind) => (
                    <span key={kind} data-change={kind} title={`${tally[kind]} ${KIND_LABEL[kind].toLowerCase()}`}>
                      {tally[kind]} {LETTER[kind]}
                    </span>
                  ))}
              </span>
            </div>

            <ul className="source-list">
              {changes.map((change) => {
                const slash = change.path.lastIndexOf("/");
                const name = change.path.slice(slash + 1);
                const directory = slash === -1 ? "" : change.path.slice(0, slash);
                return (
                  <li className="source-row" key={change.path} aria-current={change.path === selectedPath || undefined}>
                    <button className="source-row-main" type="button" onClick={() => setSelectedPath(change.path)} title={change.path}>
                      <FileIcon name={name} />
                      <span className="source-row-name" data-change={change.kind}>
                        {name}
                      </span>
                      <span className="source-row-directory">{directory}</span>
                    </button>
                    <span className="source-letter" data-change={change.kind} title={KIND_LABEL[change.kind]}>
                      {LETTER[change.kind]}
                    </span>
                  </li>
                );
              })}
            </ul>

            <form
              className="source-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void commit();
              }}
            >
              {readOnly ? (
                <p className="source-composer-note">
                  <Icon icon={IconLockClosed} size={14} />
                  Read only. Publish to your GitHub to commit these changes.
                </p>
              ) : (
                <>
                  <Textarea
                    className="min-h-[72px] resize-none bg-background"
                    aria-label="Commit message"
                    placeholder="Describe what changed"
                    rows={3}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={onMessageKey}
                  />
                  <Button type="submit" disabled={!canCommit} className="w-full">
                    <Icon icon={IconArrowUp} />
                    {busy === "commit" ? "Committing" : `Commit ${plural(changes.length, "file")} and push`}
                  </Button>
                  <p className="source-composer-hint">
                    {blockedByRemote ? (
                      "Pull first: GitHub has commits this project does not."
                    ) : (
                      <>
                        <Shortcut keys="Enter" className="max-sm:hidden" />
                        <span>Commits straight to {summary.branch} on GitHub.</span>
                      </>
                    )}
                  </p>
                </>
              )}
            </form>
          </aside>

          <section className="source-diff" aria-label="Difference from GitHub">
            {selected ? (
              <>
                <div className="source-diff-head">
                  <span className="source-diff-path">
                    <FileIcon name={selected.path} />
                    <span className="mono">{selected.path}</span>
                  </span>
                  <span className="source-kind" data-change={selected.kind}>
                    {KIND_LABEL[selected.kind]}
                  </span>
                  <div className="source-diff-actions">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          type="button"
                          aria-label="Previous change"
                          disabled={selectedIndex <= 0}
                          onClick={() => setSelectedPath(changes[selectedIndex - 1]?.path)}
                        >
                          <Icon icon={IconChevronUp} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Previous change</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          type="button"
                          aria-label="Next change"
                          disabled={selectedIndex >= changes.length - 1}
                          onClick={() => setSelectedPath(changes[selectedIndex + 1]?.path)}
                        >
                          <Icon icon={IconChevronDown} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Next change</TooltipContent>
                    </Tooltip>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => setDiscarding({ path: selected.path, kind: selected.kind })}
                    >
                      <Icon icon={IconRotateCounterClockwise} />
                      Discard
                    </Button>
                  </div>
                </div>
                <div className="editor-host">
                  <CodeDiffEditor original={selected.original} modified={selected.modified} language={languageFor(selected.path)} />
                </div>
              </>
            ) : (
              <p className="source-diff-empty">Select a change to see what is different from GitHub.</p>
            )}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={discarding !== undefined}
        onOpenChange={(open) => !open && setDiscarding(undefined)}
        title={discarding?.kind === "added" ? "Delete this file?" : "Discard your changes?"}
        description={
          discarding?.kind === "added" ? (
            <>
              <span className="mono">{discarding.path}</span> is not on GitHub, so this cannot be undone.
            </>
          ) : (
            <>
              <span className="mono">{discarding?.path}</span> goes back to the version on GitHub.
            </>
          )
        }
        confirmLabel={discarding?.kind === "added" ? "Delete file" : "Discard"}
        onConfirm={() => {
          if (discarding) void discard(discarding.path);
          setDiscarding(undefined);
        }}
      />

      <ConfirmDialog
        open={disconnecting}
        onOpenChange={setDisconnecting}
        title={`Disconnect ${summary.repository}?`}
        description="The project stays exactly as it is and nothing changes on GitHub. You can connect a repository again later."
        confirmLabel="Disconnect"
        onConfirm={() => {
          setDisconnecting(false);
          void disconnect();
        }}
      />
    </div>
  );
}
