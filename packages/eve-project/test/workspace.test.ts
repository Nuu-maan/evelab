import { describe, expect, it } from "vitest";
import { workspaceMembers } from "../src/index";

const AGENT = `import { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: "openai/gpt-5.6-luna-fast",\n});\n`;

const workspace = [
  { path: "package.json", content: `{"name":"operations","type":"module"}\n` },
  { path: "agents/support/agent/agent.ts", content: AGENT },
  { path: "agents/support/agent/instructions.md", content: "# Support\n" },
  { path: "agents/research/agent/agent.ts", content: AGENT },
  { path: "agents/research/agent/instructions.md", content: "# Research\n" },
];

describe("workspaceMembers", () => {
  it("names the members of an agents/ workspace", () => {
    expect(workspaceMembers(workspace.map((file) => file.path))).toEqual(["research", "support"]);
  });

  it("ignores a directory that carries its own package.json", () => {
    const paths = [...workspace.map((file) => file.path), "agents/site/package.json", "agents/site/agent/agent.ts"];
    expect(workspaceMembers(paths)).toEqual(["research", "support"]);
  });

  it("is empty when a root agent/ directory takes precedence", () => {
    expect(workspaceMembers([...workspace.map((file) => file.path), "agent/instructions.md"])).toEqual([]);
  });
});
