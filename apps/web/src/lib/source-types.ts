/**
 * Source control shapes shared between the server bridge and client components.
 * Kept apart so the client never imports the server-only module.
 */

import type { ParseWarning, ValidationIssue } from "@evelab/eve-project";

export type ChangeKind = "added" | "modified" | "deleted";

export interface ChangeDetail {
  path: string;
  kind: ChangeKind;
  /** Content at the last synced commit; empty for an added file. */
  original: string;
  /** Content on disk; empty for a deleted file. */
  modified: string;
}

export interface SourceSummary {
  repository: string;
  branch: string;
  url: string;
  /** Last synced commit, or "" for a repository with no commits yet. */
  commit: string;
  syncedAt: string;
  changes: ChangeDetail[];
  /** Undefined when GitHub was not asked, or did not answer. */
  remoteMoved?: boolean;
  remoteError?: string;
  /** Whether these credentials may push to the repository. Undefined when GitHub was not asked or does not say. */
  canPush?: boolean;
}

export interface RepositoryOption {
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

export interface ImportPreview {
  repository: string;
  branch: string;
  commit: string;
  agentName?: string;
  files: { path: string; bytes: number }[];
  /** Files that were not read, and why. */
  warnings: string[];
  parseWarnings: ParseWarning[];
  issues: ValidationIssue[];
  /** Set when the branch is not an Eve project, which blocks the import. */
  blocker?: string;
}

export type PullResult =
  | { status: "up-to-date" }
  | { status: "pulled"; written: number; removed: number; warnings: string[] }
  | { status: "conflicts"; conflicts: string[] };
