import { describe, expect, it } from "vitest";
import { isSafeRelativePath, parseGitHubUrl, slugifySkillId } from "../src/lib/skill-import";

describe("parseGitHubUrl", () => {
  it("reads a repository root", () => {
    expect(parseGitHubUrl("https://github.com/owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
      ref: undefined,
      path: "",
    });
  });

  it("reads a tree URL", () => {
    expect(parseGitHubUrl("https://github.com/owner/repo/tree/main/skills/pdf")).toEqual({
      owner: "owner",
      repo: "repo",
      ref: "main",
      path: "skills/pdf",
    });
  });

  it("resolves a SKILL.md blob URL to its directory", () => {
    expect(parseGitHubUrl("https://github.com/o/r/blob/main/skills/pdf/SKILL.md").path).toBe(
      "skills/pdf",
    );
  });

  it("refuses other hosts, protocols and shapes", () => {
    expect(() => parseGitHubUrl("https://gitlab.com/owner/repo")).toThrow();
    expect(() => parseGitHubUrl("http://github.com/owner/repo")).toThrow();
    expect(() => parseGitHubUrl("https://github.com/owner")).toThrow();
    expect(() => parseGitHubUrl("not a url")).toThrow();
    expect(() => parseGitHubUrl("https://github.com/o/r/raw/main/x")).toThrow();
  });
});

describe("isSafeRelativePath", () => {
  it("accepts plain and nested names", () => {
    expect(isSafeRelativePath("SKILL.md")).toBe(true);
    expect(isSafeRelativePath("scripts/run.sh")).toBe(true);
  });

  it("refuses traversal, absolute, hidden and backslash paths", () => {
    for (const path of [
      "../outside.md",
      "/etc/passwd",
      "scripts/../../x",
      ".git/config",
      "scripts/.hidden",
      "a\\b",
      "",
    ]) {
      expect(isSafeRelativePath(path)).toBe(false);
    }
  });
});

describe("slugifySkillId", () => {
  it("produces a kebab-case id", () => {
    expect(slugifySkillId("Web Research!")).toBe("web-research");
    expect(slugifySkillId("///")).toBe("skill");
  });
});
