import { describe, expect, it } from "vitest";
import {
  attachResource,
  detachResource,
  generateProject,
  getCanvasGraph,
  OwnershipError,
  parseProject,
  removeEntity,
  validateProject,
  type ProjectFile,
} from "../src/index.js";
import { loadFixture } from "./fixtures.js";

function contentOf(files: ProjectFile[], path: string): string | undefined {
  return files.find((file) => file.path === path)?.content;
}

/** The full fixture with the `#` import map `eve init` writes. */
function withImportMap(files: ProjectFile[]): ProjectFile[] {
  return files.map((file) =>
    file.path === "package.json"
      ? { ...file, content: `${JSON.stringify({ ...JSON.parse(file.content), imports: { "#*": "./agent/*" } }, null, 2)}\n` }
      : file,
  );
}

describe("shared resources", () => {
  it("attaching a tool to a second agent keeps one definition and gives each agent a re-export", () => {
    const files = withImportMap(loadFixture("full-agent"));
    const original = contentOf(files, "agent/tools/search_docs.ts")!;
    const { project } = parseProject(files);

    const output = generateProject(attachResource(project, { resource: "tool:search_docs", to: "subagent:researcher" }));

    expect(contentOf(output, "agent/lib/tools/search_docs.ts")).toBe(original);
    const reexport = 'export { default } from "#lib/tools/search_docs.ts";\n';
    expect(contentOf(output, "agent/tools/search_docs.ts")).toBe(reexport);
    expect(contentOf(output, "agent/subagents/researcher/tools/search_docs.ts")).toBe(reexport);

    const reparsed = parseProject(output).project;
    expect(reparsed.library.tools.map((tool) => tool.id)).toEqual(["search_docs"]);
    expect(reparsed.tools.find((tool) => tool.id === "search_docs")).toMatchObject({
      shared: "search_docs",
      description: "Search the product docs index.",
    });
    expect(generateProject(reparsed)).toEqual(output);
    expect(validateProject(reparsed).filter((issue) => issue.level === "error")).toEqual([]);

    const graph = getCanvasGraph(reparsed);
    const nodes = graph.nodes.filter((node) => node.name === "search_docs");
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ id: "tool:#search_docs", shared: true });
    expect([...(nodes[0]?.usedBy ?? [])].sort()).toEqual(["agent", "subagent:researcher"]);
    expect(graph.edges).toContainEqual({ source: "subagent:researcher", target: "tool:#search_docs", relation: "has tool" });
    expect(graph.edges).toContainEqual({ source: "agent", target: "tool:#search_docs", relation: "has tool" });
  });

  it("uses relative paths when the project has no import map", () => {
    const { project } = parseProject(loadFixture("full-agent"));
    const output = generateProject(attachResource(project, { resource: "tool:search_docs", to: "subagent:researcher" }));
    expect(contentOf(output, "agent/tools/search_docs.ts")).toBe('export { default } from "../lib/tools/search_docs.ts";\n');
    expect(contentOf(output, "agent/subagents/researcher/tools/search_docs.ts")).toBe(
      'export { default } from "../../../lib/tools/search_docs.ts";\n',
    );
    expect(parseProject(output).project.subagents[0]?.tools.find((tool) => tool.id === "search_docs")?.shared).toBe("search_docs");
  });

  it("turns a markdown skill into a defineSkill module when it becomes shared", () => {
    const { project } = parseProject(withImportMap(loadFixture("full-agent")));
    const output = generateProject(attachResource(project, { resource: "skill:researcher/cite", to: "agent" }));
    const paths = output.map((file) => file.path);

    expect(contentOf(output, "agent/lib/skills/cite.ts")).toContain('import { defineSkill } from "eve/skills";');
    expect(contentOf(output, "agent/skills/cite.ts")).toBe('export { default } from "#lib/skills/cite.ts";\n');
    expect(contentOf(output, "agent/subagents/researcher/skills/cite.ts")).toBe('export { default } from "#lib/skills/cite.ts";\n');
    expect(paths).not.toContain("agent/subagents/researcher/skills/cite.md");
  });

  it("attaches to a third agent without another definition, and detaching never loses it", () => {
    const { project } = parseProject(withImportMap(loadFixture("full-agent")));
    const shared = attachResource(project, { resource: "connection:linear", to: "subagent:researcher" });
    const again = attachResource(shared, { resource: "connection:#linear", to: "subagent:researcher" });
    expect(generateProject(again)).toEqual(generateProject(shared));

    const detached = detachResource(shared, { resource: "connection:#linear", from: "agent" });
    expect(detached.connections.some((connection) => connection.id === "linear")).toBe(false);
    expect(detached.library.connections.map((connection) => connection.id)).toEqual(["linear"]);

    const unused = detachResource(detached, { resource: "connection:#linear", from: "subagent:researcher" });
    const node = getCanvasGraph(unused).nodes.find((candidate) => candidate.id === "connection:#linear");
    expect(node).toMatchObject({ shared: true, usedBy: [] });
  });

  it("detaching a resource defined in place moves it to lib instead of deleting it", () => {
    const { project } = parseProject(withImportMap(loadFixture("full-agent")));
    const next = detachResource(project, { resource: "tool:search_docs", from: "agent" });
    const output = generateProject(next);
    expect(contentOf(output, "agent/lib/tools/search_docs.ts")).toContain("Search the product docs index.");
    expect(output.some((file) => file.path === "agent/tools/search_docs.ts")).toBe(false);
  });

  it("removing a shared definition removes every re-export of it", () => {
    const { project } = parseProject(withImportMap(loadFixture("full-agent")));
    const shared = attachResource(project, { resource: "tool:search_docs", to: "subagent:researcher" });
    const paths = generateProject(removeEntity(shared, "tool:#search_docs")).map((file) => file.path);
    expect(paths.filter((path) => path.includes("search_docs"))).toEqual([]);
  });

  it("refuses a name that is already taken before moving anything", () => {
    const files = [...withImportMap(loadFixture("full-agent")), { path: "agent/tools/browse.ts", content: "export default 1;\n" }];
    const { project } = parseProject(files);
    expect(() => attachResource(project, { resource: "tool:researcher/browse", to: "agent" })).toThrow(OwnershipError);
    expect(project.library.tools).toEqual([]);
  });

  it("flags a subagent without a model, and a re-export of a definition that is gone", () => {
    const files = loadFixture("full-agent").map((file) =>
      file.path === "agent/subagents/researcher/agent.ts"
        ? { ...file, content: 'import { defineAgent } from "eve";\n\nexport default defineAgent({\n  description: "Researches.",\n});\n' }
        : file,
    );
    const broken = [...files, { path: "agent/connections/github.ts", content: 'export { default } from "../lib/connections/github.ts";\n' }];
    const issues = validateProject(parseProject(broken).project);
    expect(issues).toContainEqual(expect.objectContaining({ level: "error", at: "subagents.researcher.model" }));
    expect(issues).toContainEqual(expect.objectContaining({ level: "error", at: "connections.github" }));
  });

  it("draws channels as routes from the agent", () => {
    const graph = getCanvasGraph(parseProject(loadFixture("full-agent")).project);
    expect(graph.nodes.find((node) => node.id === "channel:slack")).toMatchObject({ kind: "channel", detail: "Slack" });
    expect(graph.edges).toContainEqual({ source: "agent", target: "channel:slack", relation: "routes to" });
  });
});
