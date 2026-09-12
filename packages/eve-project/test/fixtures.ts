import { readdirSync, readFileSync } from "node:fs";
import { join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectFile } from "../src/types.js";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "fixtures");

export function loadFixture(name: string): ProjectFile[] {
  const base = join(root, name);
  const files: ProjectFile[] = [];

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else {
        files.push({
          path: relative(base, absolute).split(/[\\/]/).join(posix.sep),
          content: readFileSync(absolute, "utf8"),
        });
      }
    }
  };

  walk(base);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
