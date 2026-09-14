import { describe, expect, it } from "vitest";
import {
  encodePath,
  isSafeRepoPath,
  isValidBranchName,
  isValidRepositoryName,
  parseRepositoryName,
} from "../src/index";

describe("repository names", () => {
  it("accepts owner/name", () => {
    expect(isValidRepositoryName("vercel/eve-agent")).toBe(true);
    expect(isValidRepositoryName("a-b/c.d_e")).toBe(true);
    expect(parseRepositoryName(" anishfn/evelab ")).toEqual({
      owner: "anishfn",
      name: "evelab",
      fullName: "anishfn/evelab",
    });
  });

  it("refuses anything that could reshape a URL", () => {
    for (const input of ["vercel", "vercel/eve/extra", "../x", "vercel/..", "-bad/x", "bad-/x", "vercel/x.git", "ve rcel/x", "vercel/x?y"]) {
      expect(isValidRepositoryName(input), input).toBe(false);
    }
  });
});

describe("branch names", () => {
  it("follows check-ref-format", () => {
    expect(isValidBranchName("main")).toBe(true);
    expect(isValidBranchName("feature/canvas-edges")).toBe(true);
    for (const input of ["", "a..b", "a b", "a~b", "a:b", "/main", "main/", "main.lock", ".hidden", "a//b", "a@{b", "x\\y"]) {
      expect(isValidBranchName(input), input).toBe(false);
    }
  });
});

describe("repository paths", () => {
  it("accepts plain relative paths, dotfiles included", () => {
    expect(isSafeRepoPath("agent.ts")).toBe(true);
    expect(isSafeRepoPath("skills/pdf-forms/scripts/run.sh")).toBe(true);
    expect(isSafeRepoPath(".gitignore")).toBe(true);
  });

  it("refuses traversal, absolute paths and .git", () => {
    for (const input of ["", "/etc/passwd", "../outside", "a/../../b", "a//b", "a\\b", ".git/config", "x/.git/hooks/pre-commit", "./a"]) {
      expect(isSafeRepoPath(input), input).toBe(false);
    }
  });

  it("encodes segments but keeps separators", () => {
    expect(encodePath("feature/a b#c")).toBe("feature/a%20b%23c");
  });
});
