import { describe, expect, it } from "vitest";
import { ancestorsOf, buildFileTree, visibleRows } from "../src/components/files/tree";

const PATHS = [
  "tools/b.ts",
  "agent.ts",
  "skills/pdf-forms/SKILL.md",
  "README.md",
  "tools/a10.ts",
  "tools/a2.ts",
  ".env.example",
];

describe("file tree", () => {
  it("lists directories first, then files, in natural order", () => {
    const tree = buildFileTree(PATHS);
    expect(tree.map((node) => node.name)).toEqual([
      "skills/pdf-forms",
      "tools",
      ".env.example",
      "agent.ts",
      "README.md",
    ]);
    expect(tree[1]!.children.map((node) => node.name)).toEqual(["a2.ts", "a10.ts", "b.ts"]);
  });

  it("compacts a directory chain into one row keyed by its deepest path", () => {
    const [skills] = buildFileTree(PATHS);
    expect(skills).toMatchObject({ name: "skills/pdf-forms", path: "skills/pdf-forms", kind: "directory" });
    expect(skills!.children.map((node) => node.path)).toEqual(["skills/pdf-forms/SKILL.md"]);
  });

  it("names every directory above a file", () => {
    expect(ancestorsOf("skills/pdf-forms/scripts/run.sh")).toEqual([
      "skills",
      "skills/pdf-forms",
      "skills/pdf-forms/scripts",
    ]);
    expect(ancestorsOf("agent.ts")).toEqual([]);
  });

  it("shows children only for expanded directories", () => {
    const tree = buildFileTree(PATHS);
    expect(visibleRows(tree, new Set())).toHaveLength(5);
    const rows = visibleRows(tree, new Set(["tools"]));
    expect(rows.map((row) => [row.node.name, row.depth])).toEqual([
      ["skills/pdf-forms", 0],
      ["tools", 0],
      ["a2.ts", 1],
      ["a10.ts", 1],
      ["b.ts", 1],
      [".env.example", 0],
      ["agent.ts", 0],
      ["README.md", 0],
    ]);
  });
});
