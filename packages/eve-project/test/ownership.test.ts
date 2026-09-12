import { describe, expect, it } from "vitest";
import {
  applyOwnershipChange,
  generateProject,
  OwnershipError,
  parseProject,
  type ProjectFile,
} from "../src/index.js";
import { loadFixture } from "./fixtures.js";

function load() {
  const files = loadFixture("subagent-agent");
  return { files, project: parseProject(files).project };
}

function changedPaths(before: ProjectFile[], after: ProjectFile[]): string[] {
  const original = new Map(before.map((file) => [file.path, file.content]));
  return after
    .filter((file) => original.get(file.path) !== file.content)
    .map((file) => file.path)
    .sort();
}

describe("ownership", () => {
  it("moves a tool between subagents and rewrites only their two files", () => {
    const { files, project } = load();
    const next = applyOwnershipChange(project, {
      remove: { owner: "subagent:researcher", capability: "tool:browse" },
      add: { owner: "subagent:reviewer", capability: "tool:browse" },
    });

    expect(next.subagents.find((subagent) => subagent.id === "researcher")?.tools).toEqual([]);
    expect(next.subagents.find((subagent) => subagent.id === "reviewer")?.tools).toEqual(["browse"]);
    expect(changedPaths(files, generateProject(next))).toEqual([
      "subagents/researcher.md",
      "subagents/reviewer.md",
    ]);
  });

  it("hands a capability to the agent by clearing every subagent claim", () => {
    const { project } = load();
    const next = applyOwnershipChange(project, {
      add: { owner: "agent", capability: "skill:web-research" },
    });
    for (const subagent of next.subagents) expect(subagent.skills).not.toContain("web-research");
  });

  it("releases a capability when an edge is dropped off a subagent", () => {
    const { project } = load();
    const next = applyOwnershipChange(project, {
      remove: { owner: "subagent:researcher", capability: "skill:web-research" },
    });
    expect(next.subagents.find((subagent) => subagent.id === "researcher")?.skills).toEqual([]);
  });

  it("treats reconnecting an edge to where it was as no change", () => {
    const { files, project } = load();
    const link = { owner: "subagent:researcher", capability: "tool:browse" };
    const next = applyOwnershipChange(project, { remove: link, add: link });
    expect(generateProject(next)).toEqual(files);
  });

  it("does not mutate the project it is given", () => {
    const { project } = load();
    const before = structuredClone(project);
    applyOwnershipChange(project, { add: { owner: "agent", capability: "tool:browse" } });
    expect(project).toEqual(before);
  });

  it("rejects owners and capabilities that do not exist", () => {
    const { project } = load();
    expect(() =>
      applyOwnershipChange(project, { add: { owner: "subagent:ghost", capability: "tool:browse" } }),
    ).toThrow(OwnershipError);
    expect(() =>
      applyOwnershipChange(project, { add: { owner: "subagent:reviewer", capability: "tool:nope" } }),
    ).toThrow(OwnershipError);
    expect(() =>
      applyOwnershipChange(project, { add: { owner: "tool:browse", capability: "skill:web-research" } }),
    ).toThrow(OwnershipError);
  });
});
