import "server-only";
import { z } from "zod";
import type { SkillCandidate, SkillCandidateFile } from "./skill-types.js";

/**
 * Skill import from GitHub.
 *
 * Importing code is not the same as executing it, and it is not the same as
 * trusting it either. This module only fetches and describes a candidate skill.
 * Nothing is written to a project until the user confirms what they have read.
 */

export type { SkillCandidate, SkillCandidateFile } from "./skill-types.js";

const MAX_FILES = 60;
const MAX_DEPTH = 3;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;

const EXECUTABLE_EXTENSIONS = new Set([
  ".sh",
  ".bash",
  ".zsh",
  ".py",
  ".rb",
  ".pl",
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
]);

export class SkillImportError extends Error {}

interface Target {
  owner: string;
  repo: string;
  ref?: string;
  path: string;
}

/**
 * Accepts the URL shapes people actually paste:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/tree/main/skills/web-research
 *   https://github.com/owner/repo/blob/main/skills/web-research/SKILL.md
 */
export function parseGitHubUrl(input: string): Target {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new SkillImportError("That is not a valid URL.");
  }

  if (url.protocol !== "https:") throw new SkillImportError("Use an https URL.");
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new SkillImportError("Only github.com URLs are supported today.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const [owner, repo, kind, ref, ...rest] = segments;
  if (!owner || !repo) throw new SkillImportError("The URL needs an owner and a repository.");

  let path = rest.join("/");
  if (kind && kind !== "tree" && kind !== "blob") {
    throw new SkillImportError("Link to a repository, a tree, or a SKILL.md file.");
  }
  if (kind === "blob" && path.endsWith("SKILL.md")) {
    path = path.slice(0, -"SKILL.md".length).replace(/\/$/, "");
  }
  if (path.split("/").includes("..")) throw new SkillImportError("Unsafe path in URL.");

  return { owner, repo: repo.replace(/\.git$/, ""), ref, path };
}

const contentsEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "dir", "symlink", "submodule"]),
  size: z.number().optional(),
  download_url: z.string().nullable().optional(),
});

const contentsSchema = z.union([contentsEntrySchema, z.array(contentsEntrySchema)]);

async function github(path: string, ref?: string): Promise<unknown> {
  const url = new URL(`https://api.github.com/${path}`);
  if (ref) url.searchParams.set("ref", ref);

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const response = await fetch(url, { headers, cache: "no-store" });
  if (response.status === 404) throw new SkillImportError("Not found on GitHub.");
  if (response.status === 403) {
    throw new SkillImportError("GitHub rate limit reached. Set GITHUB_TOKEN and try again.");
  }
  if (!response.ok) throw new SkillImportError(`GitHub returned ${response.status}.`);
  return response.json();
}

function isExecutable(path: string): boolean {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? false : EXECUTABLE_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

/** Reads a skill directory and reports what it contains, without installing it. */
export async function fetchSkillCandidate(input: string): Promise<SkillCandidate> {
  const target = parseGitHubUrl(input);
  const base = `repos/${target.owner}/${target.repo}/contents`;
  const directory = target.path ? `${base}/${target.path}` : base;

  const listing = contentsSchema.parse(await github(directory, target.ref));
  const entries = Array.isArray(listing) ? listing : [listing];

  if (!entries.some((entry) => entry.name === "SKILL.md")) {
    throw new SkillImportError("No SKILL.md here. Link to the directory that contains it.");
  }

  const warnings: string[] = [];
  const files: SkillCandidateFile[] = [];
  const budget = { bytes: 0 };

  await collect(entries, "", { target, files, warnings, budget, depth: 0 });

  const markdown = files.find((file) => file.path === "SKILL.md");
  if (!markdown) throw new SkillImportError("SKILL.md could not be read.");

  const executableCount = files.filter((file) => file.executable).length;
  if (executableCount > 0) {
    warnings.unshift(
      `${executableCount} file${executableCount === 1 ? "" : "s"} can run code. Read them before installing.`,
    );
  }

  const frontmatter = readFrontmatterFields(markdown.content);
  const fallbackId = (target.path.split("/").pop() || target.repo).toLowerCase();

  return {
    id: slugifySkillId(frontmatter.name ?? fallbackId),
    name: frontmatter.name ?? fallbackId,
    description: frontmatter.description ?? "",
    source: input.trim(),
    files,
    warnings,
  };
}

interface CollectContext {
  target: Target;
  files: SkillCandidateFile[];
  warnings: string[];
  budget: { bytes: number };
  depth: number;
}

/**
 * Walks the skill directory, including subdirectories like scripts/ that real
 * skills ship. Depth, file count and total size are all bounded, and any path
 * that is not a plain relative path is refused rather than rewritten.
 */
async function collect(
  entries: z.infer<typeof contentsEntrySchema>[],
  prefix: string,
  context: CollectContext,
): Promise<void> {
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (!isSafeRelativePath(path)) {
      context.warnings.push(`Skipped "${path}": unsafe path.`);
      continue;
    }
    if (context.files.length >= MAX_FILES) {
      context.warnings.push(`Only the first ${MAX_FILES} files were read.`);
      return;
    }

    if (entry.type === "dir") {
      if (context.depth + 1 > MAX_DEPTH) {
        context.warnings.push(`"${path}" is nested deeper than ${MAX_DEPTH} levels and was skipped.`);
        continue;
      }
      const listing = contentsSchema.parse(
        await github(
          `repos/${context.target.owner}/${context.target.repo}/contents/${joinRepoPath(context.target.path, path)}`,
          context.target.ref,
        ),
      );
      await collect(Array.isArray(listing) ? listing : [listing], path, {
        ...context,
        depth: context.depth + 1,
      });
      continue;
    }

    if (entry.type !== "file") {
      // A symlink or submodule can point anywhere, including outside the repo.
      context.warnings.push(`Skipped ${entry.type} "${path}".`);
      continue;
    }
    if ((entry.size ?? 0) > MAX_FILE_BYTES) {
      context.warnings.push(`"${path}" is larger than 256 KB and was skipped.`);
      continue;
    }
    if (!entry.download_url) {
      context.warnings.push(`"${path}" has no downloadable content.`);
      continue;
    }

    const response = await fetch(entry.download_url, { cache: "no-store" });
    if (!response.ok) {
      context.warnings.push(`Could not read "${path}".`);
      continue;
    }
    const content = await response.text();
    context.budget.bytes += content.length;
    if (context.budget.bytes > MAX_TOTAL_BYTES) {
      throw new SkillImportError("That skill is larger than 1 MB in total.");
    }

    context.files.push({ path, content, executable: isExecutable(path) });
  }
}

export function isSafeRelativePath(path: string): boolean {
  if (!path || path.length > 200) return false;
  if (path.startsWith("/") || path.startsWith(".") || path.includes("\\")) return false;
  const segments = path.split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== ".." && !segment.startsWith("."),
  );
}

function joinRepoPath(base: string, relative: string): string {
  return base ? `${base}/${relative}` : relative;
}

function readFrontmatterFields(markdown: string): { name?: string; description?: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match) return {};
  const fields: { name?: string; description?: string } = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key === "name") fields.name = value;
    if (key === "description") fields.description = value;
  }
  return fields;
}

export function slugifySkillId(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "skill"
  );
}
