import { describe, expect, it } from "vitest";
import { generateProject, parseProject, patchAgentSource } from "../src/index.js";
import { loadFixture } from "./fixtures.js";

describe("generateProject", () => {
  it("edits only the changed value in agent.ts", () => {
    const files = loadFixture("subagent-agent");
    const { project } = parseProject(files);
    project.agent.name = "Deep Research Agent";

    const before = files.find((file) => file.path === "agent.ts")!.content;
    const after = generateProject(project).find((file) => file.path === "agent.ts")!.content;

    expect(after).toContain('name: "Deep Research Agent"');
    expect(after).toContain("const gateway = process.env.AI_GATEWAY_URL;");
    expect(after).toContain("tools: [browse]");
    expect(after.split("\n")).toHaveLength(before.split("\n").length);
  });

  it("adds a missing property without disturbing the rest", () => {
    const source = 'export default new Agent({\n  name: "A",\n});\n';
    expect(patchAgentSource(source, { model: '"openai/gpt-5.6"' })).toBe(
      'export default new Agent({\n  name: "A",\n  model: "openai/gpt-5.6",\n});\n',
    );
  });

  it("never clobbers an agent module it cannot parse", () => {
    const broken = "this is not typescript ((\n";
    const { project } = parseProject([
      { path: "agent.ts", content: broken },
      { path: "instructions.md", content: "hi\n" },
    ]);
    project.agent.name = "Renamed";
    const output = generateProject(project).find((file) => file.path === "agent.ts");
    expect(output?.content).toBe(broken);
  });

  it("drops files for deleted tools and subagents", () => {
    const { project } = parseProject(loadFixture("subagent-agent"));
    project.subagents = project.subagents.filter((subagent) => subagent.id !== "reviewer");
    const paths = generateProject(project).map((file) => file.path);
    expect(paths).not.toContain("subagents/reviewer.md");
    expect(paths).toContain("subagents/researcher.md");
  });

  it("renders a template only when there is no agent module yet", () => {
    const { project } = parseProject([{ path: "instructions.md", content: "Be useful.\n" }]);
    project.agent.name = "New Agent";
    project.agent.model = { id: "openai/gpt-5.6", raw: {} };
    const source = generateProject(project).find((file) => file.path === "agent.ts")!.content;
    expect(source).toContain('name: "New Agent"');
    expect(source).toContain('instructions: "instructions.md"');
  });
});

describe("renderModelValue", () => {
  it("keeps a shorthand property shorthand", () => {
    const { project } = parseProject([
      {
        path: "agent.ts",
        content:
          'const gateway = 1;\nexport default new Agent({\n  model: {\n    id: "a/b",\n    gateway,\n  },\n});\n',
      },
    ]);
    project.agent.model.id = "c/d";
    const source = generateProject(project).find((file) => file.path === "agent.ts")!.content;
    expect(source).toContain("gateway,");
    expect(source).not.toContain("gateway: gateway");
  });
});
