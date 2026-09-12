import { describe, expect, it } from "vitest";
import {
  getCanvasGraph,
  getProjectGraph,
  parseProject,
  validateProject,
} from "../src/index.js";
import { loadFixture } from "./fixtures.js";

describe("parseProject", () => {
  it("reads a string model", () => {
    const { project } = parseProject(loadFixture("basic-agent"));
    expect(project.agent.name).toBe("Support Triage");
    expect(project.agent.model).toEqual({ id: "openai/gpt-5.6", raw: {} });
    expect(project.agent.instructions).toContain("Never promise a refund.");
  });

  it("reads an options-object model and keeps unmodelled keys", () => {
    const { project } = parseProject(loadFixture("subagent-agent"));
    expect(project.agent.model.id).toBe("openai/gpt-5.6");
    expect(project.agent.model.temperature).toBe(0.3);
    expect(project.agent.model.raw).toEqual({ gateway: "gateway" });
    expect(project.agent.raw.tools).toBe("[browse]");
  });

  it("reads tools, skills and subagents", () => {
    const { project } = parseProject(loadFixture("subagent-agent"));
    expect(project.tools.map((tool) => tool.id)).toEqual(["browse"]);
    expect(project.tools[0]?.description).toBe("Fetches a URL and returns readable text.");
    expect(project.skills.map((skill) => skill.name)).toEqual(["Web research"]);
    expect(project.subagents.map((subagent) => subagent.id)).toEqual(["researcher", "reviewer"]);
    expect(project.subagents[0]?.tools).toEqual(["browse"]);
    expect(project.subagents[0]?.instructions.trim()).toBe(
      "Collect at least three independent sources before answering.",
    );
  });

  it("builds a parent to subagent graph", () => {
    const { project } = parseProject(loadFixture("subagent-agent"));
    const graph = getProjectGraph(project);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toEqual([
      { source: "agent", target: "researcher" },
      { source: "agent", target: "reviewer" },
    ]);
  });

  it("warns instead of throwing on an unrecognisable agent module", () => {
    const { project, warnings } = parseProject([
      { path: "agent.ts", content: "const agent = 1;\n" },
    ]);
    expect(warnings[0]?.path).toBe("agent.ts");
    expect(project.agent.name).toBe("Untitled agent");
  });

  it("rejects traversing file paths", () => {
    const { project } = parseProject(loadFixture("basic-agent"));
    project.files.push({ path: "../outside.ts", content: "" });
    expect(validateProject(project).some((issue) => issue.level === "error")).toBe(true);
  });
});

describe("getCanvasGraph", () => {
  it("hangs a capability off the subagent that owns it", () => {
    const { project } = parseProject(loadFixture("subagent-agent"));
    const graph = getCanvasGraph(project);

    expect(graph.nodes.map((node) => node.id)).toEqual([
      "agent",
      "subagent:researcher",
      "subagent:reviewer",
      "tool:browse",
      "skill:web-research",
    ]);
    expect(graph.edges).toContainEqual({ source: "subagent:researcher", target: "tool:browse" });
    expect(graph.edges).not.toContainEqual({ source: "agent", target: "tool:browse" });
  });

  it("points every node at the file that defines it", () => {
    const { project } = parseProject(loadFixture("subagent-agent"));
    const paths = new Set(project.files.map((file) => file.path));
    for (const node of getCanvasGraph(project).nodes) {
      expect(paths.has(node.filePath)).toBe(true);
    }
  });
});
