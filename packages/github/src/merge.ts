import type { ProjectFile } from "@evelab/eve-project";
import { gitBlobSha } from "./blob";
import type { SyncBase } from "./status";

export interface PullPlan {
  /** Files to write locally with GitHub's content. */
  write: ProjectFile[];
  /** Local files to delete because GitHub deleted them. */
  remove: string[];
  /** Changed on both sides in different ways. A pull with conflicts writes nothing. */
  conflicts: string[];
  /** The base once the plan is applied. */
  base: SyncBase;
}

/**
 * A three-way merge per file, with no line-level merging.
 *
 * A file GitHub changed is taken when the local copy is untouched since the
 * last sync. A file only changed locally stays as it is, still a local change.
 * Anything changed on both sides differently is a conflict, and the caller
 * refuses the whole pull rather than guessing.
 */
export function planPull(local: ProjectFile[], base: SyncBase, remote: SyncBase): PullPlan {
  const localSha = new Map(local.map((file) => [file.path, gitBlobSha(file.content)]));
  const paths = new Set([...Object.keys(base.files), ...Object.keys(remote.files)]);
  const plan: PullPlan = { write: [], remove: [], conflicts: [], base: remote };

  for (const path of [...paths].sort()) {
    const ours = localSha.get(path);
    const theirs = remote.files[path];
    const ancestor = base.files[path]?.sha;

    if (theirs?.sha === ancestor) continue;
    if (ours === ancestor) {
      if (theirs) plan.write.push({ path, content: theirs.content });
      else plan.remove.push(path);
      continue;
    }
    if (ours === theirs?.sha) continue;
    plan.conflicts.push(path);
  }

  return plan;
}
