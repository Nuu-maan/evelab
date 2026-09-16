import "server-only";
import { z } from "zod";
import { getAccount, githubAccess, isAuthEnabled } from "@/lib/session";
import { stateStore } from "@/lib/state-store";
import { looksLikeEveProject, parseProject, validateProject, type ProjectFile } from "@evelab/eve-project";
import {
  commitFiles,
  computeChanges,
  createGitHubClient,
  createRepository,
  getBranchHead,
  getInstallationClient,
  getRepository,
  GitHubError,
  isSecretPath,
  isValidBranchName,
  isValidRepositoryName,
  listRepositories,
  parseRepositoryName,
  planPull,
  readRepositoryTree,
  trackedFiles,
  type GitHubClient,
  type RepositorySnapshot,
  type SyncBase,
} from "@evelab/github";
import type {
  ImportPreview,
  PullResult,
  RepositoryOption,
  SourceSummary,
} from "@/lib/source-types";
import {
  createProjectFromFiles,
  deleteProjectFile,
  isIgnoredPath,
  readProjectFiles,
  writeProjectFile,
} from "@/lib/workspace";

/**
 * The bridge between a workspace project and its GitHub repository.
 *
 * The sync record is evelab's note of the last commit it agreed on with GitHub,
 * with the text of the files in that commit. It lives next to the workspace,
 * like canvas layouts, so the project directory stays exactly what is in Git.
 * Commits are created on GitHub directly, so committing is also pushing.
 */

export class SourceControlError extends Error {}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

const gitStateSchema = z.object({
  repository: z.string().refine(isValidRepositoryName),
  branch: z.string().refine(isValidBranchName),
  url: z.string().url(),
  syncedAt: z.string(),
  base: z.object({
    commit: z.string().regex(/^([0-9a-f]{40})?$/),
    files: z.record(z.object({ sha: z.string(), mode: z.string(), content: z.string() })),
  }),
});

type GitState = z.infer<typeof gitStateSchema>;

/** The sync record's key in evelab's state store: beside the workspace on disk, or in the database on Vercel. */
function stateKey(projectId: string): string {
  if (!ID_PATTERN.test(projectId)) throw new Error(`Invalid project id: ${projectId}`);
  return `git/${projectId}.json`;
}

export async function readGitState(projectId: string): Promise<GitState | undefined> {
  try {
    const content = await stateStore().read(stateKey(projectId));
    if (!content) return undefined;
    const parsed = gitStateSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

async function writeGitState(projectId: string, state: GitState): Promise<void> {
  await stateStore().write(stateKey(projectId), `${JSON.stringify(gitStateSchema.parse(state))}\n`);
}

async function requireState(projectId: string): Promise<GitState> {
  const state = await readGitState(projectId);
  if (!state) throw new SourceControlError("This project is not connected to a repository.");
  return state;
}

/** Forgets the repository. Nothing changes on GitHub or in the project files. */
export async function disconnectRepository(projectId: string): Promise<void> {
  await stateStore().remove(stateKey(projectId));
}

/**
 * How evelab reaches GitHub, or undefined when it has not been configured.
 * A GitHub App wins when one is set up. With sign-in on, everyone else uses
 * their own GitHub login, so each person sees and changes only what they can.
 */
export function sourceControlMode(): "app" | "user" | "token" | undefined {
  const env = process.env;
  if (env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY && env.GITHUB_APP_INSTALLATION_ID) return "app";
  if (isAuthEnabled()) return "user";
  if (env.GITHUB_TOKEN) return "token";
  return undefined;
}

async function client(): Promise<GitHubClient> {
  const mode = sourceControlMode();
  const env = process.env;
  if (mode === "app") return getInstallationClient(env.GITHUB_APP_INSTALLATION_ID ?? "");
  if (mode === "user") {
    const account = await getAccount();
    if (!account) throw new SourceControlError("Sign in with GitHub to use your repositories.");
    const access = await githubAccess(account.id);
    if (!access?.canUseRepositories) {
      throw new SourceControlError("evelab needs access to your repositories. Sign out, then sign in with GitHub again to allow it.");
    }
    return createGitHubClient({ kind: "token", token: access.token }, { baseUrl: env.GITHUB_API_URL });
  }
  if (mode === "token") {
    return createGitHubClient({ kind: "token", token: env.GITHUB_TOKEN ?? "" }, { baseUrl: env.GITHUB_API_URL });
  }
  throw new SourceControlError("GitHub is not configured. Set GITHUB_TOKEN and restart evelab.");
}

/** The message to show for a failure, or undefined for an unexpected error that should surface. */
export function sourceControlMessage(error: unknown): string | undefined {
  if (error instanceof SourceControlError || error instanceof GitHubError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "That input is not valid.";
  return undefined;
}

/** Why a file in a repository does not become a project file. */
function skipReason(path: string): string | undefined {
  if (isSecretPath(path)) return "environment files are never imported";
  if (isIgnoredPath(path)) return "dependencies and build output are not part of a project";
  return undefined;
}

function baseOf(snapshot: RepositorySnapshot): SyncBase {
  return { commit: snapshot.commit, files: snapshot.files };
}

function filesOf(base: SyncBase): ProjectFile[] {
  return Object.entries(base.files)
    .map(([path, file]) => ({ path, content: file.content }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

// GitHub's head for a branch, remembered briefly so page navigation never waits on the network.
const heads = new Map<string, { head: string | undefined; at: number }>();
const HEAD_TTL_MS = 60_000;

async function fetchHead(github: GitHubClient, state: GitState): Promise<string | undefined> {
  const head = await getBranchHead(github, parseRepositoryName(state.repository), state.branch);
  heads.set(`${state.repository}#${state.branch}`, { head, at: Date.now() });
  return head;
}

/**
 * Local changes against the last sync. With `fresh`, GitHub is asked whether the
 * branch moved; otherwise only a recent cached answer is used.
 */
export async function getSourceSummary(
  projectId: string,
  options: { fresh?: boolean } = {},
): Promise<SourceSummary | undefined> {
  const state = await readGitState(projectId);
  if (!state) return undefined;

  const local = await readProjectFiles(projectId);
  const contents = new Map(local.map((file) => [file.path, file.content]));
  const summary: SourceSummary = {
    repository: state.repository,
    branch: state.branch,
    url: state.url,
    commit: state.base.commit,
    syncedAt: state.syncedAt,
    changes: computeChanges(local, state.base).map((change) => ({
      ...change,
      original: state.base.files[change.path]?.content ?? "",
      modified: contents.get(change.path) ?? "",
    })),
  };

  if (options.fresh && sourceControlMode()) {
    try {
      const github = await client();
      // A GitHub App installation does not report per-repository permissions, so only a token is asked.
      const [head, info] = await Promise.all([
        fetchHead(github, state),
        github.auth === "token" ? getRepository(github, parseRepositoryName(state.repository)) : Promise.resolve(undefined),
      ]);
      summary.remoteMoved = (head ?? "") !== state.base.commit;
      if (info) summary.canPush = info.canPush;
    } catch (error) {
      summary.remoteError = sourceControlMessage(error) ?? "Could not reach GitHub.";
    }
  } else {
    const cached = heads.get(`${state.repository}#${state.branch}`);
    if (cached && Date.now() - cached.at < HEAD_TTL_MS) {
      summary.remoteMoved = (cached.head ?? "") !== state.base.commit;
    }
  }

  return summary;
}

export async function listAccessibleRepositories(): Promise<RepositoryOption[]> {
  const repositories = await listRepositories(await client());
  return repositories.map(({ fullName, defaultBranch, private: isPrivate }) => ({
    fullName,
    defaultBranch,
    private: isPrivate,
  }));
}

async function readBranch(repository: string, branch: string | undefined) {
  const ref = parseRepositoryName(repository);
  const github = await client();
  const info = await getRepository(github, ref);
  const name = branch?.trim() || info.defaultBranch;
  if (!isValidBranchName(name)) throw new SourceControlError("That is not a valid branch name.");
  const head = await getBranchHead(github, ref, name);
  if (!head) throw new SourceControlError(`${ref.fullName} has no commits on ${name}.`);
  const snapshot = await readRepositoryTree(github, ref, head, { skip: skipReason });
  return { ref, info, branch: name, snapshot };
}

const NOT_EVE =
  "This branch has no agent/agent.ts or agent/instructions.md (or the same at the root), so it is not an Eve project.";

const isEveProject = (files: ProjectFile[]) => looksLikeEveProject(files.map((file) => file.path));

/** Reads a branch and describes the project it would become. Writes nothing. */
export async function previewImport(repository: string, branch?: string): Promise<ImportPreview> {
  const { ref, branch: name, snapshot } = await readBranch(repository, branch);
  const files = filesOf(snapshot);
  const { project, warnings } = parseProject(files, { fallbackName: ref.name });
  const hasAgent = isEveProject(files);

  return {
    repository: ref.fullName,
    branch: name,
    commit: snapshot.commit,
    agentName: hasAgent ? project.agent.name : undefined,
    files: files.map((file) => ({ path: file.path, bytes: Buffer.byteLength(file.content) })),
    warnings: snapshot.warnings,
    parseWarnings: warnings,
    issues: hasAgent ? validateProject(project) : [],
    blocker: hasAgent ? undefined : NOT_EVE,
  };
}

/** Imports the commit the user reviewed, and nothing newer. Returns the project id. */
export async function importRepository(repository: string, branch: string, commit: string): Promise<string> {
  const { ref, info, branch: name, snapshot } = await readBranch(repository, branch);
  if (snapshot.commit !== commit) {
    throw new SourceControlError("The branch changed on GitHub after you reviewed it. Read it again.");
  }
  const files = filesOf(snapshot);
  if (!isEveProject(files)) throw new SourceControlError(NOT_EVE);

  const id = await createProjectFromFiles(ref.name, files);
  await writeGitState(id, {
    repository: ref.fullName,
    branch: name,
    url: info.url,
    syncedAt: new Date().toISOString(),
    base: baseOf(snapshot),
  });
  return id;
}

/**
 * Links an existing project to an existing repository. GitHub's branch becomes
 * the base, so anything that differs locally shows up as a change to commit.
 */
export async function connectRepository(
  projectId: string,
  repository: string,
  branch?: string,
): Promise<{ warnings: string[] }> {
  if (await readGitState(projectId)) throw new SourceControlError("This project already has a repository.");
  const ref = parseRepositoryName(repository);
  const github = await client();
  const info = await getRepository(github, ref);
  if (github.auth === "token" && !info.canPush) {
    throw new SourceControlError(`These credentials cannot push to ${ref.fullName}.`);
  }

  const name = branch?.trim() || info.defaultBranch;
  if (!isValidBranchName(name)) throw new SourceControlError("That is not a valid branch name.");
  const head = await getBranchHead(github, ref, name);
  if (!head && name !== info.defaultBranch) {
    throw new SourceControlError(`${ref.fullName} has no branch named ${name}.`);
  }

  const snapshot = head
    ? await readRepositoryTree(github, ref, head, { skip: skipReason })
    : { commit: "", files: {}, warnings: [] };

  await writeGitState(projectId, {
    repository: ref.fullName,
    branch: name,
    url: info.url,
    syncedAt: new Date().toISOString(),
    base: baseOf(snapshot),
  });
  return { warnings: snapshot.warnings };
}

/** Commits every local change and moves the branch on GitHub to it. */
export async function commitProject(projectId: string, message: string): Promise<{ commit: string; files: number }> {
  const state = await requireState(projectId);
  const local = await readProjectFiles(projectId);
  const changes = computeChanges(local, state.base);
  if (changes.length === 0) throw new SourceControlError("There are no changes to commit.");

  const github = await client();
  const base = await commitFiles(github, parseRepositoryName(state.repository), {
    branch: state.branch,
    message,
    base: state.base,
    local: trackedFiles(local),
    changes,
  });
  await writeGitState(projectId, { ...state, base, syncedAt: new Date().toISOString() });
  heads.set(`${state.repository}#${state.branch}`, { head: base.commit, at: Date.now() });
  return { commit: base.commit, files: changes.length };
}

export async function publishToNewRepository(
  projectId: string,
  name: string,
  isPrivate: boolean,
  message: string,
): Promise<{ commit: string; files: number; repository: string }> {
  if (await readGitState(projectId)) throw new SourceControlError("This project already has a repository.");
  const created = await createRepository(await client(), name, isPrivate);
  await writeGitState(projectId, {
    repository: created.fullName,
    branch: created.defaultBranch || "main",
    url: created.url,
    syncedAt: new Date().toISOString(),
    base: { commit: "", files: {} },
  });
  return { ...(await commitProject(projectId, message)), repository: created.fullName };
}

/**
 * Moves a project onto a new repository on the person's own account, for a project that came from
 * a repository they cannot push to. If the new repository cannot be created, the old link comes back.
 */
export async function publishToOwnRepository(
  projectId: string,
  name: string,
  isPrivate: boolean,
  message: string,
): Promise<{ commit: string; files: number; repository: string }> {
  const previous = await requireState(projectId);
  await disconnectRepository(projectId);
  try {
    return await publishToNewRepository(projectId, name, isPrivate, message);
  } catch (error) {
    if (!(await readGitState(projectId))) await writeGitState(projectId, previous);
    throw error;
  }
}

/**
 * Brings GitHub's new commits into the project. Files changed on both sides are
 * conflicts, and a pull with any conflict writes nothing at all.
 */
export async function pullProject(projectId: string): Promise<PullResult> {
  const state = await requireState(projectId);
  const github = await client();
  const head = await fetchHead(github, state);
  if (!head) throw new SourceControlError(`${state.branch} no longer exists on GitHub.`);
  if (head === state.base.commit) return { status: "up-to-date" };

  const remote = await readRepositoryTree(github, parseRepositoryName(state.repository), head, {
    skip: skipReason,
  });
  const plan = planPull(await readProjectFiles(projectId), state.base, baseOf(remote));
  if (plan.conflicts.length > 0) return { status: "conflicts", conflicts: plan.conflicts };

  for (const file of plan.write) await writeProjectFile(projectId, file.path, file.content);
  for (const path of plan.remove) await deleteProjectFile(projectId, path);
  await writeGitState(projectId, { ...state, base: plan.base, syncedAt: new Date().toISOString() });

  return { status: "pulled", written: plan.write.length, removed: plan.remove.length, warnings: remote.warnings };
}

/** Puts one file back the way it was at the last sync. */
export async function discardChange(projectId: string, path: string): Promise<void> {
  const state = await requireState(projectId);
  const change = computeChanges(await readProjectFiles(projectId), state.base).find(
    (candidate) => candidate.path === path,
  );
  if (!change) throw new SourceControlError(`${path} has no changes to discard.`);
  if (change.kind === "added") await deleteProjectFile(projectId, path);
  else await writeProjectFile(projectId, path, state.base.files[path]?.content ?? "");
}
