import { describe, expect, it } from "vitest";
import { generateProject, INTEGRATION_CATALOG, integrationPath, parseProject, renderChannelModule } from "../src/index";

const base = [
  { path: "package.json", content: `${JSON.stringify({ name: "catalog-agent", type: "module" })}\n` },
  { path: "agent/agent.ts", content: `import { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: "openai/gpt-5.6-luna-fast",\n});\n` },
  { path: "agent/instructions.md", content: "# Identity\n\nHelp.\n" },
];

describe("integration catalog", () => {
  it("writes files eve reads back into the right slot and passes through untouched", () => {
    const files = [...base, ...INTEGRATION_CATALOG.map((item) => ({ path: `agent/${integrationPath(item)}`, content: item.source }))];
    const { project } = parseProject(files, { fallbackName: "catalog-agent" });

    const extensions = INTEGRATION_CATALOG.filter((item) => item.slot === "extensions").map((item) => item.file);
    const memory = INTEGRATION_CATALOG.filter((item) => item.slot === "memory").map((item) => item.file);
    expect(project.extensions.map((extension) => extension.id).sort()).toEqual([...extensions].sort());
    expect(project.memory.map((slot) => slot.id).sort()).toEqual([...memory].sort());
    expect(project.extensions.find((extension) => extension.id === "browser")?.package).toBe("@agent-browser/eve");

    const output = new Map(generateProject(project).map((file) => [file.path, file.content]));
    for (const file of files) expect(output.get(file.path)).toBe(file.content);
  });

  it("uses unique ids and file paths", () => {
    expect(new Set(INTEGRATION_CATALOG.map((item) => item.id)).size).toBe(INTEGRATION_CATALOG.length);
    expect(new Set(INTEGRATION_CATALOG.map(integrationPath)).size).toBe(INTEGRATION_CATALOG.length);
  });
});

describe("twilio channel", () => {
  it("writes the shape from eve's Twilio docs", () => {
    expect(renderChannelModule({ kind: "twilio", allowFrom: "+15551234567", fromNumber: "+15557654321" })).toBe(
      `import { twilioChannel } from "eve/channels/twilio";\n\nexport default twilioChannel({\n  allowFrom: "+15551234567",\n  messaging: { from: "+15557654321" },\n});\n`,
    );
  });

  it("refuses a channel anyone could reach", () => {
    expect(() => renderChannelModule({ kind: "twilio" })).toThrow();
  });
});
