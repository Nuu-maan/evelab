import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSkillCandidate, parseSkillsShReference, SkillImportError } from "../src/lib/skill-import";

describe("parseSkillsShReference", () => {
  it("reads both forms eve add accepts", () => {
    expect(parseSkillsShReference("@skills/vercel-labs/agent-skills/react")).toBe("vercel-labs/agent-skills/react");
    expect(parseSkillsShReference("https://skills.sh/vercel-labs/agent-skills/react")).toBe("vercel-labs/agent-skills/react");
    expect(parseSkillsShReference("https://www.skills.sh/r/vercel-labs/agent-skills/react?agent=eve")).toBe(
      "vercel-labs/agent-skills/react",
    );
  });

  it("leaves GitHub links alone and refuses malformed names", () => {
    expect(parseSkillsShReference("https://github.com/o/r/tree/main/skills/x")).toBeUndefined();
    expect(() => parseSkillsShReference("@skills/only-two/parts")).toThrow(SkillImportError);
    expect(() => parseSkillsShReference("@skills/a/../b")).toThrow(SkillImportError);
  });
});

describe("fetchSkillCandidate from skills.sh", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds a candidate from the registry item, skipping unsafe paths and flagging scripts", async () => {
    const item = {
      name: "react",
      description: "From the registry.",
      files: [
        { path: "SKILL.md", content: "---\nname: react-best-practices\ndescription: Use for React work.\n---\n\nBody.\n" },
        { path: "rules/a.md", content: "Rule." },
        { path: "scripts/check.sh", content: "echo hi" },
        { path: "../escape.md", content: "no" },
      ],
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(item), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const candidate = await fetchSkillCandidate("@skills/vercel-labs/agent-skills/react");
    expect(fetchMock).toHaveBeenCalledWith("https://www.skills.sh/r/vercel-labs/agent-skills/react?agent=eve", expect.anything());
    expect(candidate).toMatchObject({ id: "react-best-practices", description: "Use for React work." });
    expect(candidate.files.map((file) => file.path)).toEqual(["SKILL.md", "rules/a.md", "scripts/check.sh"]);
    expect(candidate.warnings).toEqual(["1 file can run code. Read them before installing.", 'Skipped "../escape.md": unsafe path.']);
  });

  it("explains a missing skill", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await expect(fetchSkillCandidate("@skills/a/b/c")).rejects.toThrow("skills.sh has no skill a/b/c.");
  });
});
