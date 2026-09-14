import "server-only";
import { cache } from "react";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import {
  getCanvasGraph,
  type CanvasGraph,
  generateProject,
  parseProject,
  renderProjectScaffold,
  type ModelProvider,
  type Reasoning,
  validateProject,
  type EveProject,
  type ProjectFile,
} from "@evelab/eve-project";
import { emitProjectFilesChanged, type FileChange } from "@/lib/project-events";
import { ENV_EXAMPLE_PATH, ENV_MARKER, README_MARKER, README_PATH, renderEnvExample, renderReadme } from "@/lib/project-docs";

/**
 * File-backed project storage.
 *
 * The canonical form of a project is a directory of real Eve files, so a user
 * can `cd` into it, run `eve dev`, and commit it without EveLab. Postgres (see
 * packages/db) holds metadata only.
 */

const IGNORED = new Set(["node_modules", ".git", ".next", ".turbo", "dist", ".eve", ".output", ".vercel"]);
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function workspaceRoot(): string {
  return resolve(process.env.EVELAB_WORKSPACE ?? join(process.cwd(), "../../.evelab/workspace"));
}

export function projectRoot(id: string): string {
  if (!ID_PATTERN.test(id)) throw new Error(`Invalid project id: ${id}`);
  return join(workspaceRoot(), id);
}

/** Resolves a project-relative path, refusing anything that escapes the project. */
export function resolveInProject(id: string, path: string): string {
  const root = projectRoot(id);
  const absolute = resolve(root, path);
  const inside = relative(root, absolute);
  if (inside.startsWith("..") || inside.startsWith(sep) || resolve(absolute) !== absolute) {
    throw new Error(`Path escapes the project: ${path}`);
  }
  return absolute;
}

export interface ProjectSummary {
  id: string;
  name: string;
  model: string;
  toolCount: number;
  skillCount: number;
  subagentCount: number;
  connectionCount: number;
  channelCount: number;
  fileCount: number;
  /** When any file in the project last changed, in milliseconds. */
  updatedAt: number;
  /** The canvas graph, for the picture on the project card. */
  graph: CanvasGraph;
}

/** The model as a person reads it: the gateway id, or a note when code computes it. */
export function modelLabel(project: EveProject): string {
  const { model, hasConfig } = project.agent;
  if (model?.id) return model.id;
  if (model?.expression) return "Set in code";
  return hasConfig ? "" : "Eve default";
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const root = workspaceRoot();
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });

  const summaries = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && ID_PATTERN.test(entry.name))
      .map(async (entry) => {
        const [project, files] = await Promise.all([readProject(entry.name), fileStats(projectRoot(entry.name))]);
        const graph = getCanvasGraph(project);
        const countOf = (kind: string) => graph.nodes.filter((node) => node.kind === kind).length;
        return {
          id: entry.name,
          name: project.agent.name,
          model: modelLabel(project),
          toolCount: project.tools.length,
          skillCount: project.skills.length,
          subagentCount: project.subagents.length,
          connectionCount: countOf("connection"),
          channelCount: countOf("channel"),
          fileCount: files.count,
          updatedAt: files.updatedAt,
          graph,
        };
      }),
  );

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

/** How many files a project holds and when the newest of them changed. */
async function fileStats(directory: string): Promise<{ count: number; updatedAt: number }> {
  let count = 0;
  let updatedAt = 0;
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      if (IGNORED.has(entry.name)) return;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        const inner = await fileStats(absolute);
        count += inner.count;
        updatedAt = Math.max(updatedAt, inner.updatedAt);
      } else if (entry.isFile()) {
        count += 1;
        updatedAt = Math.max(updatedAt, (await stat(absolute)).mtimeMs);
      }
    }),
  );
  return { count, updatedAt };
}

export async function projectExists(id: string): Promise<boolean> {
  return existsSync(projectRoot(id));
}

async function readFiles(directory: string, base = directory): Promise<ProjectFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: ProjectFile[] = [];

  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readFiles(absolute, base)));
    } else if (entry.isFile()) {
      files.push({
        path: relative(base, absolute).split(sep).join("/"),
        content: await readFile(absolute, "utf8"),
      });
    }
  }

  return files;
}

export async function readProjectFiles(id: string): Promise<ProjectFile[]> {
  const files = await readFiles(projectRoot(id));
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readProject(id: string): Promise<EveProject> {
  return parseProject(await readProjectFiles(id), { fallbackName: id }).project;
}

/**
 * The project and its files for rendering, read from disk once per request
 * however many layouts and pages ask. Server actions keep using readProject and
 * readProjectFiles, so a read after a write inside an action is never served
 * from this cache.
 */
export const getProjectFiles = cache(readProjectFiles);

/** A file operation the person asked for that cannot be done as asked, with a message to show them. */
export class ProjectPathError extends Error {}

async function readDirectories(directory: string, base = directory): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORED.has(entry.name)) continue;
    const absolute = join(directory, entry.name);
    found.push(relative(base, absolute).split(sep).join("/"), ...(await readDirectories(absolute, base)));
  }
  return found;
}

/** Every folder in a project, empty ones included, so the explorer can show a folder before it holds a file. */
export async function readProjectDirectories(id: string): Promise<string[]> {
  return (await readDirectories(projectRoot(id))).sort();
}

export const getProjectDirectories = cache(readProjectDirectories);
export const getProject = cache(async (id: string): Promise<EveProject> => {
  return parseProject(await getProjectFiles(id), { fallbackName: id }).project;
});

/** Just ids and names, for the project switcher, sharing each read with the page being rendered. */
export const listProjectNames = cache(async (): Promise<{ id: string; name: string }[]> => {
  const root = workspaceRoot();
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const ids = entries.filter((entry) => entry.isDirectory() && ID_PATTERN.test(entry.name)).map((entry) => entry.name);
  const projects = await Promise.all(ids.map(async (id) => ({ id, name: (await getProject(id)).agent.name })));
  return projects.sort((a, b) => a.name.localeCompare(b.name));
});

/** Writes the model back out, deleting files the model no longer contains. */
export async function writeProject(id: string, project: EveProject): Promise<void> {
  const next = generateProject(project);
  const previous = await readProjectFiles(id);
  const nextPaths = new Set(next.map((file) => file.path));
  const changes: FileChange[] = [];

  for (const file of previous) {
    if (nextPaths.has(file.path)) continue;
    await rm(resolveInProject(id, file.path), { force: true });
    changes.push({ path: file.path });
  }

  for (const file of next) {
    const previousContent = previous.find((candidate) => candidate.path === file.path)?.content;
    if (previousContent === file.content) continue;
    const absolute = resolveInProject(id, file.path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, file.content, "utf8");
    changes.push({ path: file.path, content: file.content });
  }
  emitProjectFilesChanged(id, changes);
  await syncProjectDocs(id);
}

/**
 * Keeps README.md and .env.example in step with the source. A file whose
 * marker line was deleted belongs to its author and is never overwritten.
 */
export async function syncProjectDocs(id: string, options: { onlyMissing?: boolean } = {}): Promise<void> {
  const docs = [
    { path: README_PATH, marker: README_MARKER, render: renderReadme },
    { path: ENV_EXAMPLE_PATH, marker: ENV_MARKER, render: renderEnvExample },
  ];
  const current = await Promise.all(
    docs.map((doc) => readFile(resolveInProject(id, doc.path), "utf8").catch(() => undefined)),
  );
  if (options.onlyMissing && current.every((content) => content !== undefined)) return;

  const project = await readProject(id);
  const changes: FileChange[] = [];
  for (const [index, doc] of docs.entries()) {
    const existing = current[index];
    if (existing !== undefined && (options.onlyMissing || !existing.includes(doc.marker))) continue;
    const content = doc.render(project);
    if (existing === content) continue;
    await writeFile(resolveInProject(id, doc.path), content, "utf8");
    changes.push({ path: doc.path, content });
  }
  if (changes.length > 0) emitProjectFilesChanged(id, changes);
}

export async function readProjectFile(id: string, path: string): Promise<string> {
  return readFile(resolveInProject(id, path), "utf8");
}

export async function writeProjectFile(
  id: string,
  path: string,
  content: string,
): Promise<void> {
  const absolute = resolveInProject(id, path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, content, "utf8");
  emitProjectFilesChanged(id, [{ path, content }]);
  if (path !== README_PATH && path !== ENV_EXAMPLE_PATH) await syncProjectDocs(id);
}

/** An empty file, refusing to replace anything already at that path. */
export async function createProjectFile(id: string, path: string): Promise<void> {
  if (existsSync(resolveInProject(id, path))) throw new ProjectPathError(`${path} already exists.`);
  await writeProjectFile(id, path, "");
}

export async function createProjectFolder(id: string, path: string): Promise<void> {
  const absolute = resolveInProject(id, path);
  if (existsSync(absolute)) throw new ProjectPathError(`${path} already exists.`);
  await mkdir(absolute, { recursive: true });
}

/** Moves a file or a whole folder. The runtime hears it as the old paths deleted and the new ones written. */
export async function renameProjectPath(id: string, from: string, to: string): Promise<void> {
  const source = resolveInProject(id, from);
  const target = resolveInProject(id, to);
  if (!existsSync(source)) throw new ProjectPathError(`${from} no longer exists.`);
  if (existsSync(target)) throw new ProjectPathError(`${to} already exists.`);
  const moved = (await readProjectFiles(id)).filter((file) => file.path === from || file.path.startsWith(`${from}/`));
  await mkdir(dirname(target), { recursive: true });
  await rename(source, target);
  emitProjectFilesChanged(id, [
    ...moved.map((file) => ({ path: file.path })),
    ...moved.map((file) => ({ path: `${to}${file.path.slice(from.length)}`, content: file.content })),
  ]);
  await syncProjectDocs(id);
}

/** Removes a file or a folder with everything in it. */
export async function deleteProjectPath(id: string, path: string): Promise<void> {
  const absolute = resolveInProject(id, path);
  if (!existsSync(absolute)) throw new ProjectPathError(`${path} no longer exists.`);
  const removed = (await readProjectFiles(id)).filter((file) => file.path === path || file.path.startsWith(`${path}/`));
  await rm(absolute, { recursive: true, force: true });
  emitProjectFilesChanged(id, removed.map((file) => ({ path: file.path })));
  // Deleting the generated README or .env.example is a choice; regenerating them straight away would undo it.
  if (path !== README_PATH && path !== ENV_EXAMPLE_PATH) await syncProjectDocs(id);
}

export async function deleteProjectFile(id: string, path: string): Promise<void> {
  await rm(resolveInProject(id, path), { force: true });
  emitProjectFilesChanged(id, [{ path }]);
}

/** True for paths EveLab never reads into a project: dependencies, build output, Git internals. */
export function isIgnoredPath(path: string): boolean {
  return path.split("/").some((segment) => IGNORED.has(segment));
}

/** Writes files into a fresh project directory. A failed write leaves nothing behind. */
async function writeNewProject(nameHint: string, files: ProjectFile[]): Promise<string> {
  let id = slugify(nameHint);
  let suffix = 2;
  while (isTaken(id)) id = `${slugify(nameHint)}-${suffix++}`;

  await mkdir(projectRoot(id), { recursive: true });
  try {
    for (const file of files) {
      const absolute = resolveInProject(id, file.path);
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, file.content, "utf8");
    }
  } catch (error) {
    await rm(projectRoot(id), { recursive: true, force: true });
    throw error;
  }
  return id;
}

/** Creates a project from files that were already read and shown to the user, such as an imported repository. */
export async function createProjectFromFiles(nameHint: string, files: ProjectFile[]): Promise<string> {
  const id = await writeNewProject(nameHint, files);
  await syncProjectDocs(id);
  return id;
}

// Project ids are URL segments, so they must not shadow the routes beside them.
const RESERVED_IDS = new Set(["new", "import"]);

function isTaken(id: string): boolean {
  return RESERVED_IDS.has(id) || existsSync(projectRoot(id));
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || `project-${Date.now().toString(36)}`;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  modelId: string;
  provider?: ModelProvider;
  reasoning?: Reasoning;
}

/**
 * Creates the project `eve init` would: the same package.json, tsconfig,
 * agent/agent.ts, instructions and eve channel. Eve names the agent after the
 * package, so the name becomes the package name.
 */
export async function createProject(input: CreateProjectInput): Promise<string> {
  let id = slugify(input.name);
  let suffix = 2;
  while (isTaken(id)) id = `${slugify(input.name)}-${suffix++}`;

  const identity = input.description ? `You are ${input.name}. ${input.description}` : `You are ${input.name}, a helpful assistant.`;
  const scaffold = renderProjectScaffold({
    packageName: id,
    model: input.modelId,
    provider: input.provider,
    reasoning: input.reasoning,
    instructions: `# Identity\n\n${identity}\n`,
  });
  const { project } = parseProject(scaffold, { fallbackName: id });
  project.agent.description = input.description;
  const created = await writeNewProject(id, generateProject(project));
  await syncProjectDocs(created);
  return created;
}

export async function deleteProject(id: string): Promise<void> {
  await rm(projectRoot(id), { recursive: true, force: true });
}

export { validateProject };
