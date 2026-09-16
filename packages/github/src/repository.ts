import { z } from "zod";
import type { ProjectFile } from "@evelab/eve-project";
import { GitHubError, RemoteMovedError, type GitHubClient } from "./client";
import { encodePath, isSafeRepoPath, type RepositoryRef } from "./names";
import { advanceBase, type FileChange, type SyncBase, type SyncedFile } from "./status";

const sha = z.string().regex(/^[0-9a-f]{40}$/);

const repositorySchema = z.object({
  full_name: z.string(),
  default_branch: z.string(),
  private: z.boolean(),
  html_url: z.string().url(),
  permissions: z.object({ push: z.boolean().optional() }).optional(),
});

export interface RepositorySummary {
  fullName: string;
  defaultBranch: string;
  private: boolean;
  url: string;
  canPush: boolean;
}

function summarize(repository: z.infer<typeof repositorySchema>): RepositorySummary {
  return {
    fullName: repository.full_name,
    defaultBranch: repository.default_branch,
    private: repository.private,
    url: repository.html_url,
    canPush: repository.permissions?.push ?? false,
  };
}

function repoPath(repo: RepositoryRef, suffix = ""): string {
  return `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}${suffix}`;
}

export async function listRepositories(client: GitHubClient): Promise<RepositorySummary[]> {
  if (client.auth === "app") {
    const result = await client.request(
      "GET /installation/repositories",
      { per_page: 100 },
      z.object({ repositories: z.array(repositorySchema) }),
    );
    return result.repositories.map(summarize);
  }
  const repositories = await client.request(
    "GET /user/repos",
    { per_page: 100, sort: "updated" },
    z.array(repositorySchema),
  );
  return repositories.map(summarize);
}

export async function getRepository(client: GitHubClient, repo: RepositoryRef): Promise<RepositorySummary> {
  return summarize(await client.request(`GET ${repoPath(repo)}`, {}, repositorySchema));
}

/** Creates an empty repository for the authenticated user. */
export async function createRepository(
  client: GitHubClient,
  name: string,
  isPrivate: boolean,
): Promise<RepositorySummary> {
  if (client.auth !== "token") {
    throw new GitHubError("Creating a personal repository needs a personal access token.");
  }
  return summarize(
    await client.request(
      "POST /user/repos",
      { name, private: isPrivate, auto_init: false },
      repositorySchema,
    ),
  );
}

/** The branch's commit on GitHub, or undefined when the branch or the whole history does not exist yet. */
export async function getBranchHead(
  client: GitHubClient,
  repo: RepositoryRef,
  branch: string,
): Promise<string | undefined> {
  try {
    const ref = await client.request(
      `GET ${repoPath(repo, `/git/ref/heads/${encodePath(branch)}`)}`,
      {},
      z.object({ object: z.object({ sha }) }),
    );
    return ref.object.sha;
  } catch (error) {
    if (error instanceof GitHubError && (error.status === 404 || error.status === 409)) return undefined;
    throw error;
  }
}

export interface TreeLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

export const DEFAULT_TREE_LIMITS: TreeLimits = {
  maxFiles: 1000,
  maxFileBytes: 1024 * 1024,
  maxTotalBytes: 10 * 1024 * 1024,
};

export interface RepositorySnapshot extends SyncBase {
  /** Everything that was not imported, and why. Shown to the user. */
  warnings: string[];
}

async function mapLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

function decodeText(buffer: Buffer): string | undefined {
  if (buffer.includes(0)) return undefined;
  const text = buffer.toString("utf8");
  return Buffer.from(text, "utf8").equals(buffer) ? text : undefined;
}

/**
 * Reads the text files of a commit. The tree is untrusted: unsafe paths,
 * symlinks, submodules, binaries and oversized files are skipped with a warning,
 * and the file count and total size are bounded.
 */
export async function readRepositoryTree(
  client: GitHubClient,
  repo: RepositoryRef,
  commit: string,
  options: { limits?: TreeLimits; skip?: (path: string) => string | undefined } = {},
): Promise<RepositorySnapshot> {
  const limits = options.limits ?? DEFAULT_TREE_LIMITS;
  const { tree: root } = await client.request(
    `GET ${repoPath(repo, `/git/commits/${commit}`)}`,
    {},
    z.object({ sha, tree: z.object({ sha }) }),
  );
  const listing = await client.request(
    `GET ${repoPath(repo, `/git/trees/${root.sha}`)}`,
    { recursive: "1" },
    z.object({
      truncated: z.boolean(),
      tree: z.array(
        z.object({ path: z.string(), mode: z.string(), type: z.string(), sha, size: z.number().optional() }),
      ),
    }),
  );
  if (listing.truncated) throw new GitHubError("The repository is too large to read in one go.");

  const warnings: string[] = [];
  const wanted: { path: string; mode: string; sha: string }[] = [];
  let bytes = 0;

  for (const entry of listing.tree) {
    if (entry.type === "tree") continue;
    if (!isSafeRepoPath(entry.path)) {
      warnings.push(`Skipped "${entry.path}": unsafe path.`);
    } else if (entry.type === "commit") {
      warnings.push(`Skipped submodule "${entry.path}".`);
    } else if (entry.mode === "120000") {
      warnings.push(`Skipped symlink "${entry.path}".`);
    } else if (entry.type !== "blob") {
      warnings.push(`Skipped "${entry.path}".`);
    } else if ((entry.size ?? 0) > limits.maxFileBytes) {
      warnings.push(`Skipped "${entry.path}": larger than ${Math.round(limits.maxFileBytes / 1024)} KB.`);
    } else {
      const reason = options.skip?.(entry.path);
      if (reason) {
        warnings.push(`Skipped "${entry.path}": ${reason}.`);
        continue;
      }
      bytes += entry.size ?? 0;
      wanted.push({ path: entry.path, mode: entry.mode, sha: entry.sha });
    }
  }

  if (wanted.length > limits.maxFiles) {
    throw new GitHubError(`The repository has more than ${limits.maxFiles} files.`);
  }
  if (bytes > limits.maxTotalBytes) {
    throw new GitHubError(`The repository is larger than ${Math.round(limits.maxTotalBytes / 1024 / 1024)} MB.`);
  }

  const blobs = await mapLimit(wanted, 8, (entry) =>
    client.request(
      `GET ${repoPath(repo, `/git/blobs/${entry.sha}`)}`,
      {},
      z.object({ content: z.string(), encoding: z.string() }),
    ),
  );

  const files: Record<string, SyncedFile> = {};
  wanted.forEach((entry, index) => {
    const blob = blobs[index]!;
    const buffer =
      blob.encoding === "base64"
        ? Buffer.from(blob.content.replace(/\s/g, ""), "base64")
        : Buffer.from(blob.content, "utf8");
    const content = decodeText(buffer);
    if (content === undefined) {
      warnings.push(`Skipped "${entry.path}": not a text file.`);
      return;
    }
    files[entry.path] = { sha: entry.sha, mode: entry.mode, content };
  });

  return { commit, files, warnings };
}

const createdSchema = z.object({ sha });

/**
 * Commits local changes on top of the base and moves the branch to it.
 *
 * The branch only moves forward: if GitHub has commits evelab has not seen,
 * this refuses rather than overwriting them. Returns the new base.
 */
export async function commitFiles(
  client: GitHubClient,
  repo: RepositoryRef,
  input: { branch: string; message: string; base: SyncBase; local: ProjectFile[]; changes: FileChange[] },
): Promise<SyncBase> {
  const { branch, message, base, local, changes } = input;
  if (changes.length === 0) throw new GitHubError("There is nothing to commit.");

  const head = await getBranchHead(client, repo, branch);
  if ((head ?? "") !== base.commit) throw new RemoteMovedError();

  const contents = new Map(local.map((file) => [file.path, file.content]));
  const entries = changes.map((change) => {
    const mode = base.files[change.path]?.mode ?? "100644";
    return change.kind === "deleted"
      ? { path: change.path, mode, type: "blob", sha: null }
      : { path: change.path, mode, type: "blob", content: contents.get(change.path) ?? "" };
  });

  const ref = `/git/refs/heads/${encodePath(branch)}`;
  let commit: string;

  if (head) {
    const { tree } = await client.request(
      `GET ${repoPath(repo, `/git/commits/${head}`)}`,
      {},
      z.object({ tree: z.object({ sha }) }),
    );
    const next = await client.request(
      `POST ${repoPath(repo, "/git/trees")}`,
      { base_tree: tree.sha, tree: entries },
      createdSchema,
    );
    ({ sha: commit } = await client.request(
      `POST ${repoPath(repo, "/git/commits")}`,
      { message, tree: next.sha, parents: [head] },
      createdSchema,
    ));
    try {
      await client.request(`PATCH ${repoPath(repo, ref)}`, { sha: commit, force: false }, z.unknown());
    } catch (error) {
      if (error instanceof GitHubError && error.status === 422) throw new RemoteMovedError();
      throw error;
    }
  } else {
    // GitHub's Git database API does not work on a repository with no commits.
    // Create one file through the contents API to bring the repository to life,
    // then replace that bootstrap commit with a single root commit of everything.
    const first = changes.find((change) => change.kind !== "deleted");
    if (!first) throw new GitHubError("There is nothing to commit.");
    const firstContent = contents.get(first.path) ?? "";
    await client.request(
      `PUT ${repoPath(repo, `/contents/${encodePath(first.path)}`)}`,
      { message, content: Buffer.from(firstContent, "utf8").toString("base64"), branch },
      z.unknown(),
    );
    const next = await client.request(
      `POST ${repoPath(repo, "/git/trees")}`,
      { tree: entries.filter((entry) => "content" in entry) },
      createdSchema,
    );
    ({ sha: commit } = await client.request(
      `POST ${repoPath(repo, "/git/commits")}`,
      { message, tree: next.sha, parents: [] },
      createdSchema,
    ));
    await client.request(`PATCH ${repoPath(repo, ref)}`, { sha: commit, force: true }, z.unknown());
  }

  return advanceBase(base, commit, local, changes);
}
