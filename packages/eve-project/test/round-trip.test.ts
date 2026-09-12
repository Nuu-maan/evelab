import { describe, expect, it } from "vitest";
import { generateProject, parseProject, validateProject } from "../src/index.js";
import { loadFixture } from "./fixtures.js";

describe("round trip", () => {
  for (const name of ["basic-agent", "subagent-agent"]) {
    it(`${name} survives parse -> generate byte for byte`, () => {
      const files = loadFixture(name);
      const { project } = parseProject(files);
      expect(generateProject(project)).toEqual(files);
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

  it("keeps files EveLab does not own", () => {
    const files = loadFixture("basic-agent");
    const { project } = parseProject(files);
    const generated = generateProject(project);
    expect(generated.find((file) => file.path === "package.json")?.content).toBe(
      files.find((file) => file.path === "package.json")?.content,
    );
  });
});
