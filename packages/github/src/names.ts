import { z } from "zod";

/**
 * Every name that reaches the GitHub API or the filesystem is validated here
 * first. Repository names and paths come from user input and from GitHub
 * itself, and both are untrusted.
 */

export interface RepositoryRef {
  owner: string;
  name: string;
  /** "owner/name". */
  fullName: string;
}

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

export function isValidRepositoryName(input: string): boolean {
  const parts = input.split("/");
  if (parts.length !== 2) return false;
  const [owner, name] = parts as [string, string];
  return OWNER.test(owner) && NAME.test(name) && name !== "." && name !== ".." && !name.endsWith(".git");
}

export const repositoryNameSchema = z
  .string()
  .trim()
  .refine(isValidRepositoryName, { message: "Use owner/name, like vercel/eve-agent" });

export function parseRepositoryName(input: string): RepositoryRef {
  const fullName = repositoryNameSchema.parse(input);
  const [owner, name] = fullName.split("/") as [string, string];
  return { owner, name, fullName };
}

/** A new repository's name, without the owner. */
export const newRepositoryNameSchema = z
  .string()
  .trim()
  .regex(NAME, { message: "Letters, digits, dots, dashes and underscores" })
  .refine((name) => name !== "." && name !== ".." && !name.endsWith(".git"), {
    message: "That name is reserved",
  });

/** The rules of `git check-ref-format`, for branch names. */
export function isValidBranchName(name: string): boolean {
  if (name.length === 0 || name.length > 200) return false;
  if (/[\x00-\x20~^:?*[\\\x7f]/.test(name)) return false;
  if (name.startsWith("/") || name.endsWith("/") || name.endsWith(".") || name.endsWith(".lock")) {
    return false;
  }
  if (name.includes("..") || name.includes("//") || name.includes("@{") || name === "@") return false;
  return name.split("/").every((part) => part.length > 0 && !part.startsWith("."));
}

export const branchNameSchema = z
  .string()
  .trim()
  .refine(isValidBranchName, { message: "Not a valid branch name" });

/**
 * A path from a repository that evelab may write into a project directory.
 * Plain relative paths only: no traversal, no absolute paths, no backslashes,
 * and nothing inside a `.git` directory.
 */
export function isSafeRepoPath(path: string): boolean {
  if (!path || path.length > 400) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  return path
    .split("/")
    .every((segment) => segment.length > 0 && segment !== "." && segment !== ".." && segment !== ".git");
}

/** Encodes a path for a GitHub URL, keeping the slashes that separate segments. */
export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
