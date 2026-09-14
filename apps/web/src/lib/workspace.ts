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
import { and, eq, getDb, isNotNull, projectEntries, sql } from "@evelab/db";
import { emitProjectFilesChanged, type FileChange } from "@/lib/project-events";
import { ENV_EXAMPLE_PATH, ENV_MARKER, README_MARKER, README_PATH, renderEnvExample, renderReadme } from "@/lib/project-docs";

/**
 * Project storage.
 *
 * The canonical form of a project is a directory of real Eve files, so a user
 * can `cd` into it, run `eve dev`, and commit it without EveLab. That is how
 * projects live locally. A deployment whose disk cannot keep files, such as
 * Vercel Functions, keeps the same files as rows in Postgres instead; nothing
 * above this module can tell the difference.
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

/** A project-relative path, checked and normalised the same way as on disk, with forward slashes. */
function entryPath(id: string, path: string): string {
  return relative(projectRoot(id), resolveInProject(id, path)).split(sep).join("/");
}

/**
 * Where projects are kept. `EVELAB_STORAGE` decides when set; otherwise a
 * Vercel deployment with a database uses it, because its disk is read-only and
 * short-lived, and everything else uses the workspace directory.
 */
export function storageMode(): "fs" | "database" {
  const configured = process.env.EVELAB_STORAGE;
  if (configured === "fs" || configured === "database") return configured;
  return process.env.VERCEL && process.env.DATABASE_URL ? "database" : "fs";
}

/** Where a project lives, as a person would look for it. */
export function projectLocation(id: string): string {
  return storageMode() === "database" ? `${id} in the EveLab database` : projectRoot(id);
}

interface ProjectStorage {
  listIds(): Promise<string[]>;
  exists(id: string): Promise<boolean>;
  readFiles(id: string): Promise<ProjectFile[]>;
  stats(id: string): Promise<{ count: number; updatedAt: number }>;
  readDirectories(id: string): Promise<string[]>;
  /** Rejects when the file does not exist. */
  readFile(id: string, path: string): Promise<string>;
  readBytes(id: string, path: string): Promise<Uint8Array>;
  /** Whether a file or folder exists at the path. */
  hasPath(id: string, path: string): Promise<boolean>;
  writeFile(id: string, path: string, content: string): Promise<void>;
  removeFile(id: string, path: string): Promise<void>;
  createFolder(id: string, path: string): Promise<void>;
  move(id: string, from: string, to: string): Promise<void>;
  removeTree(id: string, path: string): Promise<void>;
  /** Writes every file of a new project, or nothing at all. */
  createProject(id: string, files: ProjectFile[]): Promise<void>;
  deleteProject(id: string): Promise<void>;
}

/* ---------- On disk ---------- */

async function readFilesIn(directory: string, base = directory): Promise<ProjectFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: ProjectFile[] = [];
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readFilesIn(absolute, base)));
    } else if (entry.isFile()) {
      files.push({ path: relative(base, absolute).split(sep).join("/"), content: await readFile(absolute, "utf8") });
    }
  }
  return files;
}

/** How many files a directory holds and when the newest of them changed. */
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

async function readDirectoriesIn(directory: string, base = directory): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORED.has(entry.name)) continue;
    const absolute = join(directory, entry.name);
    found.push(relative(base, absolute).split(sep).join("/"), ...(await readDirectoriesIn(absolute, base)));
  }
  return found;
}

const diskStorage: ProjectStorage = {
  async listIds() {
    const root = workspaceRoot();
    if (!existsSync(root)) return [];
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && ID_PATTERN.test(entry.name)).map((entry) => entry.name);
  },
  async exists(id) {
    return existsSync(projectRoot(id));
  },
  readFiles: (id) => readFilesIn(projectRoot(id)),
  stats: (id) => fileStats(projectRoot(id)),
  readDirectories: (id) => readDirectoriesIn(projectRoot(id)),
  readFile: (id, path) => readFile(resolveInProject(id, path), "utf8"),
  async readBytes(id, path) {
    return new Uint8Array(await readFile(resolveInProject(id, path)));
  },
  async hasPath(id, path) {
    return existsSync(resolveInProject(id, path));
  },
  async writeFile(id, path, content) {
    const absolute = resolveInProject(id, path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content, "utf8");
  },
  async removeFile(id, path) {
    await rm(resolveInProject(id, path), { force: true });
  },
  async createFolder(id, path) {
    await mkdir(resolveInProject(id, path), { recursive: true });
  },
  async move(id, from, to) {
    const target = resolveInProject(id, to);
    await mkdir(dirname(target), { recursive: true });
    await rename(resolveInProject(id, from), target);
  },
  async removeTree(id, path) {
    await rm(resolveInProject(id, path), { recursive: true, force: true });
  },
  async createProject(id, files) {
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
  },
  async deleteProject(id) {
    await rm(projectRoot(id), { recursive: true, force: true });
  },
};

/* ---------- In Postgres ---------- */

function database() {
  const db = getDb();
  if (!db) throw new Error("Projects are stored in the database, but DATABASE_URL is not set.");
  return db;
}

/** The entry at a path and everything inside it. */
function under(path: string) {
  return sql`(${projectEntries.path} = ${path} or starts_with(${projectEntries.path}, ${`${path}/`}))`;
}

const INSERT_CHUNK = 200;

const databaseStorage: ProjectStorage = {
  async listIds() {
    const rows = await database().selectDistinct({ id: projectEntries.projectId }).from(projectEntries);
    return rows.map((row) => row.id).filter((id) => ID_PATTERN.test(id));
  },
  async exists(id) {
    const rows = await database()
      .select({ id: projectEntries.projectId })
      .from(projectEntries)
      .where(eq(projectEntries.projectId, id))
      .limit(1);
    return rows.length > 0;
  },
  async readFiles(id) {
    const rows = await database()
      .select({ path: projectEntries.path, content: projectEntries.content })
      .from(projectEntries)
      .where(and(eq(projectEntries.projectId, id), isNotNull(projectEntries.content)));
    return rows.map((row) => ({ path: row.path, content: row.content ?? "" }));
  },
  async stats(id) {
    const [row] = await database()
      .select({ count: sql<number>`count(*)::int`, updatedAt: sql<string | null>`max(${projectEntries.updatedAt})` })
      .from(projectEntries)
      .where(and(eq(projectEntries.projectId, id), isNotNull(projectEntries.content)));
    return { count: row?.count ?? 0, updatedAt: row?.updatedAt ? new Date(row.updatedAt).getTime() : 0 };
  },
  async readDirectories(id) {
    const rows = await database()
      .select({ path: projectEntries.path, content: projectEntries.content })
      .from(projectEntries)
      .where(eq(projectEntries.projectId, id));
    const folders = new Set<string>();
    for (const row of rows) {
      const parts = row.path.split("/");
      // A folder row is itself a folder; a file only implies the folders above it.
      const depth = row.content === null ? parts.length : parts.length - 1;
      for (let index = 1; index <= depth; index++) folders.add(parts.slice(0, index).join("/"));
    }
    return [...folders];
  },
  async readFile(id, path) {
    const key = entryPath(id, path);
    const [row] = await database()
      .select({ content: projectEntries.content })
      .from(projectEntries)
      .where(and(eq(projectEntries.projectId, id), eq(projectEntries.path, key)))
      .limit(1);
    if (row?.content === undefined || row.content === null) {
      throw Object.assign(new Error(`${key} does not exist.`), { code: "ENOENT" });
    }
    return row.content;
  },
  async readBytes(id, path) {
    return new TextEncoder().encode(await databaseStorage.readFile(id, path));
  },
  async hasPath(id, path) {
    const rows = await database()
      .select({ path: projectEntries.path })
      .from(projectEntries)
      .where(and(eq(projectEntries.projectId, id), under(entryPath(id, path))))
      .limit(1);
    return rows.length > 0;
  },
  async writeFile(id, path, content) {
    const now = new Date();
    await database()
      .insert(projectEntries)
      .values({ projectId: id, path: entryPath(id, path), content, updatedAt: now })
      .onConflictDoUpdate({ target: [projectEntries.projectId, projectEntries.path], set: { content, updatedAt: now } });
  },
  async removeFile(id, path) {
    await database()
      .delete(projectEntries)
      .where(and(eq(projectEntries.projectId, id), eq(projectEntries.path, entryPath(id, path))));
  },
  async createFolder(id, path) {
    await database().insert(projectEntries).values({ projectId: id, path: entryPath(id, path), content: null }).onConflictDoNothing();
  },
  async move(id, from, to) {
    const source = entryPath(id, from);
    const target = entryPath(id, to);
    const now = new Date();
    await database().transaction(async (tx) => {
      const rows = await tx
        .select({ path: projectEntries.path, content: projectEntries.content })
        .from(projectEntries)
        .where(and(eq(projectEntries.projectId, id), under(source)));
      if (rows.length === 0) return;
      await tx.delete(projectEntries).where(and(eq(projectEntries.projectId, id), under(source)));
      for (let index = 0; index < rows.length; index += INSERT_CHUNK) {
        await tx.insert(projectEntries).values(
          rows.slice(index, index + INSERT_CHUNK).map((row) => ({
            projectId: id,
            path: `${target}${row.path.slice(source.length)}`,
            content: row.content,
            updatedAt: now,
          })),
        );
      }
    });
  },
  async removeTree(id, path) {
    await database()
      .delete(projectEntries)
      .where(and(eq(projectEntries.projectId, id), under(entryPath(id, path))));
  },
  async createProject(id, files) {
    const now = new Date();
    await database().transaction(async (tx) => {
      for (let index = 0; index < files.length; index += INSERT_CHUNK) {
        await tx.insert(projectEntries).values(
          files
            .slice(index, index + INSERT_CHUNK)
            .map((file) => ({ projectId: id, path: entryPath(id, file.path), content: file.content, updatedAt: now })),
        );
      }
    });
  },
  async deleteProject(id) {
    await database().delete(projectEntries).where(eq(projectEntries.projectId, id));
  },
};

function storage(): ProjectStorage {
  return storageMode() === "database" ? databaseStorage : diskStorage;
}

/* ---------- Projects ---------- */

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

/** Project ids to read, narrowed to the ones a visitor may see when that is known. */
async function projectIds(visible?: Set<string>): Promise<string[]> {
  const ids = await storage().listIds();
  return visible ? ids.filter((id) => visible.has(id)) : ids;
}

/** Summaries of every project, or only of the given ones, so nobody else's files are read. */
export async function listProjects(visible?: Set<string>): Promise<ProjectSummary[]> {
  const ids = await projectIds(visible);
  const summaries = await Promise.all(
    ids.map(async (id) => {
      const [project, files] = await Promise.all([readProject(id), storage().stats(id)]);
      const graph = getCanvasGraph(project);
      const countOf = (kind: string) => graph.nodes.filter((node) => node.kind === kind).length;
      return {
        id,
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

export async function projectExists(id: string): Promise<boolean> {
  return storage().exists(id);
}

export async function readProjectFiles(id: string): Promise<ProjectFile[]> {
  const files = await storage().readFiles(id);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readProject(id: string): Promise<EveProject> {
  return parseProject(await readProjectFiles(id), { fallbackName: id }).project;
}

/**
 * The project and its files for rendering, read once per request however many
 * layouts and pages ask. Server actions keep using readProject and
 * readProjectFiles, so a read after a write inside an action is never served
 * from this cache.
 */
export const getProjectFiles = cache(readProjectFiles);

/** A file operation the person asked for that cannot be done as asked, with a message to show them. */
export class ProjectPathError extends Error {}

/** Every folder in a project, empty ones included, so the explorer can show a folder before it holds a file. */
export async function readProjectDirectories(id: string): Promise<string[]> {
  return (await storage().readDirectories(id)).sort();
}

export const getProjectDirectories = cache(readProjectDirectories);
export const getProject = cache(async (id: string): Promise<EveProject> => {
  return parseProject(await getProjectFiles(id), { fallbackName: id }).project;
});

/** Just ids and names, for the project switcher, sharing each read with the page being rendered. */
export const listProjectNames = cache(async (visible?: Set<string>): Promise<{ id: string; name: string }[]> => {
  const ids = await projectIds(visible);
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
    await storage().removeFile(id, file.path);
    changes.push({ path: file.path });
  }

  for (const file of next) {
    const previousContent = previous.find((candidate) => candidate.path === file.path)?.content;
    if (previousContent === file.content) continue;
    await storage().writeFile(id, file.path, file.content);
    changes.push({ path: file.path, content: file.content });
  }
  emitProjectFilesChanged(id, changes);
  await syncProjectDocs(id);
}

/**
 * Keeps README.md and .env.example in step with the source. A file whose
 * marker line was deleted belongs to its author and is never overwritten.
 */
export async function syncProjectDocs(id: string, options: { onlyMissing?: boolean; create?: boolean } = {}): Promise<void> {
  const docs = [
    { path: README_PATH, marker: README_MARKER, render: renderReadme },
    { path: ENV_EXAMPLE_PATH, marker: ENV_MARKER, render: renderEnvExample },
  ];
  const current = await Promise.all(docs.map((doc) => storage().readFile(id, doc.path).catch(() => undefined)));
  if (options.onlyMissing && current.every((content) => content !== undefined)) return;

  const project = await readProject(id);
  const changes: FileChange[] = [];
  for (const [index, doc] of docs.entries()) {
    const existing = current[index];
    // A missing README or .env.example is only written when asked, so an imported repository never grows files it did not have.
    if (existing === undefined && !options.create) continue;
    if (existing !== undefined && (options.onlyMissing || !existing.includes(doc.marker))) continue;
    const content = doc.render(project);
    if (existing === content) continue;
    await storage().writeFile(id, doc.path, content);
    changes.push({ path: doc.path, content });
  }
  if (changes.length > 0) emitProjectFilesChanged(id, changes);
}

export async function readProjectFile(id: string, path: string): Promise<string> {
  return storage().readFile(id, path);
}

/** A file's bytes, so images and other binary files survive an export from disk. */
export async function readProjectFileBytes(id: string, path: string): Promise<Uint8Array> {
  return storage().readBytes(id, path);
}

export async function writeProjectFile(id: string, path: string, content: string): Promise<void> {
  await storage().writeFile(id, path, content);
  emitProjectFilesChanged(id, [{ path, content }]);
  if (path !== README_PATH && path !== ENV_EXAMPLE_PATH) await syncProjectDocs(id);
}

/** An empty file, refusing to replace anything already at that path. */
export async function createProjectFile(id: string, path: string): Promise<void> {
  if (await storage().hasPath(id, path)) throw new ProjectPathError(`${path} already exists.`);
  await writeProjectFile(id, path, "");
}

export async function createProjectFolder(id: string, path: string): Promise<void> {
  if (await storage().hasPath(id, path)) throw new ProjectPathError(`${path} already exists.`);
  await storage().createFolder(id, path);
}

/** Moves a file or a whole folder. The runtime hears it as the old paths deleted and the new ones written. */
export async function renameProjectPath(id: string, from: string, to: string): Promise<void> {
  if (!(await storage().hasPath(id, from))) throw new ProjectPathError(`${from} no longer exists.`);
  if (await storage().hasPath(id, to)) throw new ProjectPathError(`${to} already exists.`);
  const moved = (await readProjectFiles(id)).filter((file) => file.path === from || file.path.startsWith(`${from}/`));
  await storage().move(id, from, to);
  emitProjectFilesChanged(id, [
    ...moved.map((file) => ({ path: file.path })),
    ...moved.map((file) => ({ path: `${to}${file.path.slice(from.length)}`, content: file.content })),
  ]);
  await syncProjectDocs(id);
}

/** Removes a file or a folder with everything in it. */
export async function deleteProjectPath(id: string, path: string): Promise<void> {
  if (!(await storage().hasPath(id, path))) throw new ProjectPathError(`${path} no longer exists.`);
  const removed = (await readProjectFiles(id)).filter((file) => file.path === path || file.path.startsWith(`${path}/`));
  await storage().removeTree(id, path);
  emitProjectFilesChanged(id, removed.map((file) => ({ path: file.path })));
  // Deleting the generated README or .env.example is a choice; regenerating them straight away would undo it.
  if (path !== README_PATH && path !== ENV_EXAMPLE_PATH) await syncProjectDocs(id);
}

export async function deleteProjectFile(id: string, path: string): Promise<void> {
  await storage().removeFile(id, path);
  emitProjectFilesChanged(id, [{ path }]);
}

/** True for paths EveLab never reads into a project: dependencies, build output, Git internals. */
export function isIgnoredPath(path: string): boolean {
  return path.split("/").some((segment) => IGNORED.has(segment));
}

/** Writes files into a fresh project. A failed write leaves nothing behind. */
async function writeNewProject(nameHint: string, files: ProjectFile[]): Promise<string> {
  let id = slugify(nameHint);
  let suffix = 2;
  while (await isTaken(id)) id = `${slugify(nameHint)}-${suffix++}`;
  await storage().createProject(id, files);
  return id;
}

/** Creates a project from files that were already read and shown to the user, such as an imported repository. */
export async function createProjectFromFiles(nameHint: string, files: ProjectFile[]): Promise<string> {
  return writeNewProject(nameHint, files);
}

// Project ids are URL segments, so they must not shadow the routes beside them.
const RESERVED_IDS = new Set(["new", "import"]);

async function isTaken(id: string): Promise<boolean> {
  return RESERVED_IDS.has(id) || (await storage().exists(id));
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
  while (await isTaken(id)) id = `${slugify(input.name)}-${suffix++}`;

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
  await syncProjectDocs(created, { create: true });
  return created;
}

export async function deleteProject(id: string): Promise<void> {
  await storage().deleteProject(id);
}

export { validateProject };
