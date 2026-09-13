import { describe, expect, it } from "vitest";
import { getCanvasGraph, parseProject, validateProject } from "../src/index.js";
import { loadFixture } from "./fixtures.js";

describe("parseProject", () => {
  it("reads the nested layout and the name from package.json", () => {
    const { project } = parseProject(loadFixture("basic-agent"));
    expect(project.root).toBe("agent");
    expect(project.agent.name).toBe("support-triage");
    expect(project.agent.hasConfig).toBe(true);
    expect(project.agent.model).toEqual({ id: "openai/gpt-5.6-luna-fast" });
    expect(project.agent.instructions).toContain("Never promise a refund.");
  });

  it("keeps defineAgent options it has no control for, verbatim", () => {
    const { project } = parseProject(loadFixture("full-agent"));
    expect(project.agent.reasoning).toBe("high");
    expect(project.agent.raw.compaction).toBe("{\n    thresholdPercent: 0.95,\n  }");
  });

  it("reads tools, telling authored tools from built-ins", () => {
    const { project } = parseProject(loadFixture("full-agent"));
    expect(project.tools.map((tool) => [tool.id, tool.kind])).toEqual([
      ["search_docs", "tool"],
      ["web_search", "provided"],
    ]);
    expect(project.tools[0]?.description).toBe("Search the product docs index.");
  });

  it("reads markdown and packaged skills", () => {
    const { project } = parseProject(loadFixture("full-agent"));
    const [forecast, research] = project.skills;
    expect(forecast).toMatchObject({ id: "forecast", format: "markdown" });
    expect(forecast?.description).toBe("Use when the user asks about a forecast or temperature.");
    expect(research).toMatchObject({ id: "research", format: "package" });
    expect(research?.files.map((file) => file.path)).toEqual(["references/checklist.md"]);
  });

  it("describes a markdown skill without frontmatter by its first line, as Eve does", () => {
    const files = [...loadFixture("basic-agent"), { path: "agent/skills/tone.md", content: "\n# Keep it short\n\nBody.\n" }];
    expect(parseProject(files).project.skills[0]?.description).toBe("Keep it short");
  });

  it("reads a subagent directory with its own tools and skills", () => {
    const { project } = parseProject(loadFixture("full-agent"));
    const [researcher] = project.subagents;
    expect(researcher).toMatchObject({
      id: "researcher",
      kind: "local",
      description: "Investigate ambiguous questions before the parent agent responds.",
      model: { id: "anthropic/claude-opus-5" },
      hasInstructions: true,
    });
    expect(researcher?.tools.map((tool) => tool.id)).toEqual(["browse"]);
    expect(researcher?.skills.map((skill) => skill.id)).toEqual(["cite"]);
  });

  it("reads MCP and OpenAPI connections, including Vercel Connect auth and filters", () => {
    const { project } = parseProject(loadFixture("full-agent"));
    const [linear, petstore] = project.connections;
    expect(linear).toMatchObject({
      id: "linear",
      kind: "mcp",
      url: "https://mcp.linear.app/mcp",
      auth: "connect",
      connector: "mcp.linear.app/linear",
      filter: { mode: "allow", names: ["search_issues", "get_issue"] },
    });
    expect(petstore).toMatchObject({ id: "petstore", kind: "openapi", auth: "token" });
    expect(petstore?.spec).toBe("https://petstore3.swagger.io/api/v3/openapi.json");
  });

  it("reads channels and both schedule forms", () => {
    const { project } = parseProject(loadFixture("full-agent"));
    expect(project.channels.map((channel) => [channel.id, channel.kind])).toEqual([
      ["eve", "eve"],
      ["slack", "slack"],
    ]);
    expect(project.schedules).toMatchObject([
      { id: "cleanup", format: "markdown", cron: "0 0 * * 0", prompt: "Sweep stale research notes.", handler: false },
      { id: "digest", format: "module", cron: "0 9 * * 1-5", prompt: "Summarize new sources added yesterday." },
    ]);
  });

  it("reads the flat layout and a model set in code", () => {
    const { project } = parseProject(loadFixture("flat-agent"));
    expect(project.root).toBe("");
    expect(project.agent.model).toEqual({ id: "", expression: 'anthropic("claude-opus-5")' });
    expect(project.tools.map((tool) => tool.id)).toEqual(["get_weather"]);
  });

  it("warns instead of throwing on an agent.ts it cannot read", () => {
    const { project, warnings } = parseProject([
      { path: "agent/agent.ts", content: "const agent = 1;\n" },
      { path: "agent/instructions.md", content: "Hi.\n" },
    ]);
    expect(warnings[0]?.path).toBe("agent/agent.ts");
    expect(project.agent.hasConfig).toBe(true);
    expect(project.agent.model).toBeUndefined();
  });
});

describe("validateProject", () => {
  it("rejects a subagent without a description, as Eve's compiler does", () => {
    const files = loadFixture("full-agent").map((file) =>
      file.path === "agent/subagents/researcher/agent.ts"
        ? { ...file, content: 'import { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: "anthropic/claude-opus-5",\n});\n' }
        : file,
    );
    const issues = validateProject(parseProject(files).project);
    expect(issues).toContainEqual(expect.objectContaining({ level: "error", at: "subagents.researcher.description" }));
  });

  it("rejects a schedule without a five-field cron", () => {
    const files = [...loadFixture("basic-agent"), { path: "agent/schedules/bad.md", content: "---\ncron: daily\n---\n\nRun.\n" }];
    const issues = validateProject(parseProject(files).project);
    expect(issues).toContainEqual(expect.objectContaining({ level: "error", at: "schedules.bad.cron" }));
  });

  it("rejects a project without root instructions", () => {
    const { project } = parseProject([{ path: "agent/agent.ts", content: 'import { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: "a/b",\n});\n' }]);
    expect(validateProject(project)).toContainEqual(expect.objectContaining({ level: "error", at: "agent.instructions" }));
  });

  it("rejects traversing file paths", () => {
    const { project } = parseProject(loadFixture("basic-agent"));
    project.files.push({ path: "../outside.ts", content: "" });
    expect(validateProject(project).some((issue) => issue.level === "error")).toBe(true);
  });
});

describe("getCanvasGraph", () => {
  it("hangs a subagent's own capabilities off that subagent", () => {
    const { project } = parseProject(loadFixture("full-agent"));
    const graph = getCanvasGraph(project);
    expect(graph.nodes.map((node) => node.id)).toContain("tool:researcher/browse");
    expect(graph.edges).toContainEqual({ source: "subagent:researcher", target: "tool:researcher/browse" });
    expect(graph.edges).toContainEqual({ source: "agent", target: "connection:linear" });
    expect(graph.edges).not.toContainEqual({ source: "agent", target: "tool:researcher/browse" });
  });

  it("points every node at a file that exists", () => {
    const { project } = parseProject(loadFixture("full-agent"));
    const paths = new Set(project.files.map((file) => file.path));
    for (const node of getCanvasGraph(project).nodes) expect(paths.has(node.filePath)).toBe(true);
  });
});
