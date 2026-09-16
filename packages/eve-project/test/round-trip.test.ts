import { describe, expect, it } from "vitest";
import { generateProject, parseProject, validateProject } from "../src/index";
import { loadFixture } from "./fixtures";

const FIXTURES = ["basic-agent", "full-agent", "flat-agent"];

describe("round trip", () => {
  for (const name of FIXTURES) {
    it(`${name} survives parse -> generate byte for byte`, () => {
      const files = loadFixture(name);
      expect(generateProject(parseProject(files).project)).toEqual(files);
    });

    it(`${name} parses back to the same model`, () => {
      const files = loadFixture(name);
      const first = parseProject(files).project;
      const second = parseProject(generateProject(first)).project;
      expect(second).toEqual(first);
    });

    it(`${name} validates without errors`, () => {
      const { project } = parseProject(loadFixture(name));
      expect(validateProject(project).filter((issue) => issue.level === "error")).toEqual([]);
    });
  }

  it("passes through every file evelab does not model", () => {
    const files = loadFixture("full-agent");
    const generated = new Map(generateProject(parseProject(files).project).map((file) => [file.path, file.content]));
    for (const path of ["package.json", "README.md", "agent/lib/format.ts", "agent/hooks/audit.ts", "evals/smoke.eval.ts"]) {
      expect(generated.get(path)).toBe(files.find((file) => file.path === path)?.content);
    }
  });

  it("keeps files in a subagent directory that are not agent slots", () => {
    const files = [...loadFixture("full-agent"), { path: "agent/subagents/researcher/lib/sources.ts", content: "export const sources = [];\n" }];
    const generated = generateProject(parseProject(files).project);
    expect(generated.find((file) => file.path === "agent/subagents/researcher/lib/sources.ts")?.content).toBe(
      "export const sources = [];\n",
    );
  });

  it("leaves a skill directory without SKILL.md as plain files", () => {
    const files = [...loadFixture("basic-agent"), { path: "agent/skills/draft/notes.md", content: "wip\n" }];
    const { project, warnings } = parseProject(files);
    expect(project.skills).toEqual([]);
    expect(warnings.map((warning) => warning.path)).toContain("agent/skills/draft/");
    expect(generateProject(project)).toEqual([...files].sort((a, b) => a.path.localeCompare(b.path)));
  });
});
