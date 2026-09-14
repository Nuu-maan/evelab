import { describe, expect, it } from "vitest";
import {
  generateProject,
  parseProject,
  patchAgentSource,
  renderAgentConfig,
  addPackageDependencies,
  chatSdkDependencies,
  renderChannelModule,
  renderChatSdkChannelModule,
  renderProjectScaffold,
  setFrontmatterValue,
  type ProjectFile,
} from "../src/index";
import { loadFixture } from "./fixtures";

function contentOf(files: ProjectFile[], path: string): string | undefined {
  return files.find((file) => file.path === path)?.content;
}

describe("generateProject", () => {
  it("changes only the model value in agent.ts, keeping comments and other options", () => {
    const files = loadFixture("full-agent");
    const { project } = parseProject(files);
    project.agent.model = { id: "anthropic/claude-opus-5" };

    const before = contentOf(files, "agent/agent.ts")!;
    const after = contentOf(generateProject(project), "agent/agent.ts")!;
    expect(after).toBe(before.replace('"anthropic/claude-sonnet-5"', '"anthropic/claude-opus-5"'));
  });

  it("removes reasoning with its whole line when it is cleared", () => {
    const { project } = parseProject(loadFixture("full-agent"));
    project.agent.reasoning = undefined;
    const after = contentOf(generateProject(project), "agent/agent.ts")!;
    expect(after).not.toContain("reasoning");
    expect(after).toContain("compaction");
  });

  it("never touches a model set in code", () => {
    const files = loadFixture("flat-agent");
    const { project } = parseProject(files);
    expect(contentOf(generateProject(project), "agent.ts")).toBe(contentOf(files, "agent.ts"));
  });

  it("never clobbers an agent module it cannot read", () => {
    const broken = "this is not typescript ((\n";
    const { project } = parseProject([
      { path: "agent/agent.ts", content: broken },
      { path: "agent/instructions.md", content: "hi\n" },
    ]);
    project.agent.model = { id: "anthropic/claude-sonnet-5" };
    expect(contentOf(generateProject(project), "agent/agent.ts")).toBe(broken);
  });

  it("writes agent.ts the way eve init does when a model is first chosen", () => {
    const { project } = parseProject([{ path: "agent/instructions.md", content: "Be useful.\n" }]);
    project.agent.model = { id: "openai/gpt-5.6-luna-fast" };
    expect(contentOf(generateProject(project), "agent/agent.ts")).toBe(
      'import { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: "openai/gpt-5.6-luna-fast",\n});\n',
    );
    expect(renderAgentConfig("a/b", "high")).toContain('  reasoning: "high",\n});');
  });

  it("scaffolds a project the way eve init does, and it round trips", () => {
    const files = renderProjectScaffold({ packageName: "demo-agent", model: "openai/gpt-5.6-luna-fast" });
    // The same files eve init writes, apart from the README EveLab generates and what npm install and git init add.
    expect(files.map((file) => file.path).sort()).toEqual([
      ".gitignore",
      ".vercelignore",
      "AGENTS.md",
      "CLAUDE.md",
      "agent/agent.ts",
      "agent/channels/eve.ts",
      "agent/instructions.md",
      "package.json",
      "tsconfig.json",
    ]);
    const { project } = parseProject(files);
    expect(project.agent.name).toBe("demo-agent");
    expect(project.channels.map((channel) => channel.kind)).toEqual(["eve"]);
    expect(JSON.parse(contentOf(files, "package.json")!).imports).toEqual({ "#*": "./agent/*", "#evals/*": "./evals/*" });
    expect(generateProject(project)).toEqual([...files].sort((a, b) => a.path.localeCompare(b.path)));
  });

  it("drops only the files of a deleted tool", () => {
    const files = loadFixture("full-agent");
    const { project } = parseProject(files);
    project.tools = project.tools.filter((tool) => tool.id !== "search_docs");
    const paths = generateProject(project).map((file) => file.path);
    expect(paths).not.toContain("agent/tools/search_docs.ts");
    expect(paths).toHaveLength(files.length - 1);
  });

  it("drops a packaged skill with its siblings", () => {
    const { project } = parseProject(loadFixture("full-agent"));
    project.skills = project.skills.filter((skill) => skill.id !== "research");
    const paths = generateProject(project).map((file) => file.path);
    expect(paths.some((path) => path.startsWith("agent/skills/research/"))).toBe(false);
  });

  it("writes a new subagent as a directory with a description", () => {
    const { project } = parseProject(loadFixture("basic-agent"));
    project.subagents.push({
      id: "reviewer",
      kind: "local",
      description: "Check claims before the parent replies.",
      raw: {},
      source: "",
      instructions: "Reject unsupported claims.\n",
      hasInstructions: true,
      tools: [],
      skills: [],
      connections: [],
      subagents: [],
    });
    const output = generateProject(project);
    expect(contentOf(output, "agent/subagents/reviewer/agent.ts")).toBe(
      'import { defineAgent } from "eve";\n\nexport default defineAgent({\n  description: "Check claims before the parent replies.",\n  model: "openai/gpt-5.6-luna-fast",\n});\n',
    );
    expect(contentOf(output, "agent/subagents/reviewer/instructions.md")).toBe("Reject unsupported claims.\n");
  });

  it("writes a flat project back to the package root", () => {
    const { project } = parseProject(loadFixture("flat-agent"));
    project.agent.instructions = "You are a precise assistant.\n";
    const output = generateProject(project);
    expect(contentOf(output, "instructions.md")).toBe("You are a precise assistant.\n");
    expect(output.some((file) => file.path.startsWith("agent/"))).toBe(false);
  });
});

describe("renderChannelModule", () => {
  it("writes the Slack channel eve add creates with Vercel Connect, and it parses back as Slack", () => {
    const source = renderChannelModule({ kind: "slack", connector: "slack/my-agent" });
    expect(source).toBe(
      'import { connectSlackCredentials } from "@vercel/connect/eve";\nimport { slackChannel } from "eve/channels/slack";\n\nexport default slackChannel({\n  credentials: connectSlackCredentials("slack/my-agent"),\n});\n',
    );
    const { project } = parseProject([...loadFixture("basic-agent"), { path: "agent/channels/slack.ts", content: source }]);
    expect(project.channels.find((channel) => channel.id === "slack")?.kind).toBe("slack");
  });

  it("falls back to environment credentials only where Eve reads them", () => {
    expect(renderChannelModule({ kind: "slack" })).toContain("export default slackChannel();");
    expect(renderChannelModule({ kind: "teams" })).toContain("export default teamsChannel();");
    expect(() => renderChannelModule({ kind: "discord" })).toThrow(/connector/);
  });
});

describe("Chat SDK channels", () => {
  it("writes a channel that parses back as a Chat SDK channel, with credentials left to the environment", () => {
    const source = renderChatSdkChannelModule({ adapter: "whatsapp", state: "redis", userName: "support-triage" });
    expect(source).toContain('import { createWhatsAppAdapter } from "@chat-adapter/whatsapp";');
    expect(source).toContain("    whatsapp: createWhatsAppAdapter(),");
    expect(source).toContain("  state: createRedisState(),");
    expect(source).not.toMatch(/process\.env|TOKEN/);
    const { project } = parseProject([...loadFixture("basic-agent"), { path: "agent/channels/whatsapp.ts", content: source }]);
    expect(project.channels.find((channel) => channel.id === "whatsapp")?.kind).toBe("chat-sdk");
  });

  it("adds the packages it imports without overriding the project's own versions", () => {
    const packageJson = `${JSON.stringify({ name: "demo", dependencies: { zod: "4.5.4", chat: "4.1.0" } }, null, 2)}\n`;
    const next = JSON.parse(addPackageDependencies(packageJson, chatSdkDependencies("gchat", "memory")));
    expect(next.name).toBe("demo");
    expect(next.dependencies).toEqual({
      "@chat-adapter/gchat": "^4.40.0",
      "@chat-adapter/state-memory": "^4.40.0",
      chat: "4.1.0",
      zod: "4.5.4",
    });
  });
});

describe("patchAgentSource", () => {
  it("adds a missing property without disturbing the rest", () => {
    const source = 'export default defineAgent({\n  model: "a/b",\n});\n';
    expect(patchAgentSource(source, { reasoning: '"high"' })).toBe(
      'export default defineAgent({\n  model: "a/b",\n  reasoning: "high",\n});\n',
    );
  });

  it("follows `export default agent` to the definition it names", () => {
    const source = 'const agent = defineAgent({\n  model: "a/b",\n});\n\nexport default agent;\n';
    expect(patchAgentSource(source, { model: '"c/d"' })).toContain('model: "c/d"');
  });
});

describe("setFrontmatterValue", () => {
  it("rewrites one key and keeps the rest of the file", () => {
    const input = '---\ncron: "0 0 * * 0"\nnote: keep\n---\n\nSweep.\n';
    expect(setFrontmatterValue(input, "cron", "0 9 * * 1")).toBe('---\ncron: "0 9 * * 1"\nnote: keep\n---\n\nSweep.\n');
  });

  it("adds a fence when there is none, and removes it when emptied", () => {
    const added = setFrontmatterValue("Body.\n", "description", "Use when asked.");
    expect(added).toBe("---\ndescription: Use when asked.\n---\n\nBody.\n");
    expect(setFrontmatterValue(added, "description", undefined)).toBe("Body.\n");
  });
});

describe("renderAgentConfigFor", () => {
  it("writes each provider the way eve init does", async () => {
    const { renderAgentConfigFor, renderProjectScaffold, parseProject } = await import("../src/index");
    expect(renderAgentConfigFor("ai-gateway-key", "anthropic/claude-opus-4.8", "high")).toBe(
      'import { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: "anthropic/claude-opus-4.8",\n  reasoning: "high",\n});\n',
    );
    expect(renderAgentConfigFor("chatgpt", "gpt-5.6-sol")).toContain('model: chatgpt("gpt-5.6-sol"),');
    const direct = renderAgentConfigFor("anthropic", "anthropic/claude-opus-4.8");
    expect(direct).toContain('import { anthropic } from "@ai-sdk/anthropic";');
    expect(direct).toContain('model: anthropic("claude-opus-4.8"),');

    const scaffold = renderProjectScaffold({ packageName: "direct", model: "anthropic/claude-opus-4.8", provider: "anthropic" });
    expect(JSON.parse(scaffold.find((file) => file.path === "package.json")!.content).dependencies).toHaveProperty("@ai-sdk/anthropic");
    const { project } = parseProject(scaffold);
    expect(project.agent.model?.expression).toBe('anthropic("claude-opus-4.8")');
  });
});
