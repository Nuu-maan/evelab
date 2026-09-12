import type { ProjectFile } from "@evelab/eve-project";
import { gitBlobSha } from "./blob.js";
import { trackedFiles } from "./tracked.js";

export interface SyncedFile {
  /** Git blob id of the content. */
  sha: string;
  /** Git file mode, such as "100644" or "100755", kept so a commit never changes it. */
  mode: string;
  content: string;
}

/**
 * The last state EveLab and GitHub agreed on: a commit and the text files in it.
 * Local edits are measured against this, and a pull merges against it.
 */
export interface SyncBase {
  /** Commit id, or "" for a repository that has no commits yet. */
  commit: string;
  files: Record<string, SyncedFile>;
}

export type ChangeKind = "added" | "modified" | "deleted";

export interface FileChange {
  path: string;
  kind: ChangeKind;
}

export interface GitStatus {
  /** Local changes since the last sync. None of them are on GitHub yet. */
  changes: FileChange[];
  /** The branch's current commit on GitHub, when it could be read. */
  remoteHead?: string;
  /** True when GitHub has commits EveLab has not pulled. */
  remoteMoved: boolean;
}

export function computeChanges(local: ProjectFile[], base: SyncBase): FileChange[] {
  const changes: FileChange[] = [];
  const present = new Set(local.map((file) => file.path));

  for (const file of trackedFiles(local)) {
    const synced = base.files[file.path];
    if (!synced) changes.push({ path: file.path, kind: "added" });
    else if (gitBlobSha(file.content) !== synced.sha) changes.push({ path: file.path, kind: "modified" });
  }

  // A synced file that is now ignored locally still exists; only a missing one is a deletion.
  for (const path of Object.keys(base.files)) {
    if (!present.has(path)) changes.push({ path, kind: "deleted" });
  }

  return changes.sort((a, b) => a.path.localeCompare(b.path));
}

export function computeStatus(local: ProjectFile[], base: SyncBase, remoteHead?: string): GitStatus {
  return {
    changes: computeChanges(local, base),
    remoteHead,
    remoteMoved: remoteHead !== undefined && remoteHead !== base.commit,
  };
}

/** The base after local content was committed as `commit`. */
export function advanceBase(
  base: SyncBase,
  commit: string,
  local: ProjectFile[],
  changes: FileChange[],
): SyncBase {
  const files = { ...base.files };
  const contents = new Map(local.map((file) => [file.path, file.content]));
  for (const change of changes) {
    if (change.kind === "deleted") {
      delete files[change.path];
      continue;
    }
    const content = contents.get(change.path) ?? "";
    files[change.path] = {
      sha: gitBlobSha(content),
      mode: base.files[change.path]?.mode ?? "100644",
      content,
    };
  }
  return { commit, files };
}
