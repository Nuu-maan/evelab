import "server-only";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import {
  generateProject,
  parseProject,
  renderAgentTemplate,
  validateProject,
  type EveProject,
  type ProjectFile,
} from "@evelab/eve-project";

/**
 * File-backed project storage.
 *
 * The canonical form of a project is a directory of real Eve files, so a user
 * can `cd` into it, run Eve, and commit it without EveLab. Postgres (see
 * packages/db) is for metadata only and is not wired up yet.
 */

const IGNORED = new Set(["node_modules", ".git", ".next", ".turbo", "dist"]);
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function workspaceRoot(): string {
  return resolve(process.env.EVELAB_WORKSPACE ?? join(process.cwd(), "../../.evelab/workspace"));
}

function projectRoot(id: string): string {
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
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const root = workspaceRoot();
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });

  const summaries = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && ID_PATTERN.test(entry.name))
      .map(async (entry) => {
        const project = await readProject(entry.name);
        return {
          id: entry.name,
          name: project.agent.name,
          model: project.agent.model.id,
          toolCount: project.tools.length,
          skillCount: project.skills.length,
          subagentCount: project.subagents.length,
        };
      }),
  );

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
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
  return parseProject(await readProjectFiles(id)).project;
}

/** Writes the model back out, deleting files the model no longer contains. */
export async function writeProject(id: string, project: EveProject): Promise<void> {
  const next = generateProject(project);
  const previous = await readProjectFiles(id);
  const nextPaths = new Set(next.map((file) => file.path));

  for (const file of previous) {
    if (!nextPaths.has(file.path)) await rm(resolveInProject(id, file.path), { force: true });
  }

  for (const file of next) {
    const previousContent = previous.find((candidate) => candidate.path === file.path)?.content;
    if (previousContent === file.content) continue;
    const absolute = resolveInProject(id, file.path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, file.content, "utf8");
  }
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
}

export async function deleteProjectFile(id: string, path: string): Promise<void> {
  await rm(resolveInProject(id, path), { force: true });
}

/** True for paths EveLab never reads into a project: dependencies, build output, Git internals. */
export function isIgnoredPath(path: string): boolean {
  return path.split("/").some((segment) => IGNORED.has(segment));
}

/**
 * Creates a project from files that were already read and shown to the user,
 * such as an imported repository. A failed write leaves nothing behind.
 */
export async function createProjectFromFiles(nameHint: string, files: ProjectFile[]): Promise<string> {
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
}

export async function createProject(input: CreateProjectInput): Promise<string> {
  let id = slugify(input.name);
  let suffix = 2;
  while (isTaken(id)) id = `${slugify(input.name)}-${suffix++}`;

  const instructions = `# ${input.name}\n\nDescribe what this agent should do, what it must never do, and how it should\nreply.\n`;
  const project: EveProject = {
    agent: {
      name: input.name,
      description: input.description,
      model: { id: input.modelId, raw: {} },
      instructionsPath: "instructions.md",
      instructions,
      raw: {},
    },
    tools: [],
    skills: [],
    subagents: [],
    files: [],
  };

  const files = [
    ...generateProject(project),
    {
      path: "package.json",
      content: `${JSON.stringify(
        { name: id, private: true, type: "module" },
        null,
        2,
      )}\n`,
    },
    { path: ".gitignore", content: "node_modules\n.env\n" },
  ];

  await mkdir(projectRoot(id), { recursive: true });
  for (const file of files) {
    const absolute = resolveInProject(id, file.path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, file.content, "utf8");
  }

  return id;
}

export async function deleteProject(id: string): Promise<void> {
  await rm(projectRoot(id), { recursive: true, force: true });
}

export { renderAgentTemplate, validateProject };
