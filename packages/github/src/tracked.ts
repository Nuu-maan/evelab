import ignore from "ignore";
import type { ProjectFile } from "@evelab/eve-project";

const ENV_FILE = /(^|\/)\.env(\.[^/]+)?$/;
const ENV_TEMPLATE = /(^|\/)\.env\.(example|sample|template)$/;

/**
 * Local environment files never leave the machine, whatever `.gitignore` says.
 * EveLab does not hold secrets, and it must not publish the user's either.
 */
export function isSecretPath(path: string): boolean {
  return ENV_FILE.test(path) && !ENV_TEMPLATE.test(path);
}

/**
 * The files that belong in the repository: everything except secrets and what
 * the project's root `.gitignore` excludes.
 */
export function trackedFiles(files: ProjectFile[]): ProjectFile[] {
  const rules = files.find((file) => file.path === ".gitignore")?.content ?? "";
  const matcher = ignore().add(rules);
  return files.filter((file) => !isSecretPath(file.path) && !matcher.ignores(file.path));
}
