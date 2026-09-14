import { describe, expect, it } from "vitest";
import {
  advanceBase,
  computeChanges,
  computeStatus,
  gitBlobSha,
  isSecretPath,
  planPull,
  trackedFiles,
  type SyncBase,
} from "../src/index";

function synced(files: Record<string, string>, commit = "c1"): SyncBase {
  return {
    commit,
    files: Object.fromEntries(
      Object.entries(files).map(([path, content]) => [path, { sha: gitBlobSha(content), mode: "100644", content }]),
    ),
  };
}

const asFiles = (files: Record<string, string>) =>
  Object.entries(files).map(([path, content]) => ({ path, content }));

describe("gitBlobSha", () => {
  it("matches git hash-object", () => {
    expect(gitBlobSha("hello\n")).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
    expect(gitBlobSha("")).toBe("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
  });
});

describe("tracked files", () => {
  it("never tracks env files, but keeps templates", () => {
    expect(isSecretPath(".env")).toBe(true);
    expect(isSecretPath(".env.local")).toBe(true);
    expect(isSecretPath("config/.env.production")).toBe(true);
    expect(isSecretPath(".env.example")).toBe(false);
  });

  it("applies the project's .gitignore", () => {
    const files = asFiles({ ".gitignore": "logs/\n*.tmp\n", "agent.ts": "a", "logs/run.txt": "x", "a.tmp": "t", ".env": "SECRET=1" });
    expect(trackedFiles(files).map((file) => file.path)).toEqual([".gitignore", "agent.ts"]);
  });
});

describe("status", () => {
  it("reports added, modified and deleted files against the base", () => {
    const base = synced({ "agent.ts": "one", "instructions.md": "keep", "tools/old.ts": "gone" });
    const local = asFiles({ "agent.ts": "two", "instructions.md": "keep", "tools/new.ts": "new", ".env": "x" });
    expect(computeChanges(local, base)).toEqual([
      { path: "agent.ts", kind: "modified" },
      { path: "tools/new.ts", kind: "added" },
      { path: "tools/old.ts", kind: "deleted" },
    ]);
  });

  it("is clean when nothing changed", () => {
    const files = { "agent.ts": "one" };
    expect(computeStatus(asFiles(files), synced(files), "c1")).toEqual({
      changes: [],
      remoteHead: "c1",
      remoteMoved: false,
    });
  });

  it("notices when GitHub has moved on", () => {
    const files = { "agent.ts": "one" };
    expect(computeStatus(asFiles(files), synced(files), "c2").remoteMoved).toBe(true);
    expect(computeStatus(asFiles(files), synced(files)).remoteMoved).toBe(false);
  });

  it("advances the base to exactly what was committed", () => {
    const base = synced({ "agent.ts": "one", "gone.md": "x" });
    const local = asFiles({ "agent.ts": "two", "new.md": "n" });
    const changes = computeChanges(local, base);
    const next = advanceBase(base, "c2", local, changes);
    expect(next.commit).toBe("c2");
    expect(computeChanges(local, next)).toEqual([]);
  });
});

describe("pull planning", () => {
  it("takes GitHub's changes where the local copy is untouched", () => {
    const base = synced({ "agent.ts": "one", "old.md": "x", "local.md": "mine" });
    const remote = synced({ "agent.ts": "two", "new.md": "n", "local.md": "mine" }, "c2");
    const local = asFiles({ "agent.ts": "one", "old.md": "x", "local.md": "edited" });

    const plan = planPull(local, base, remote);
    expect(plan.write).toEqual([
      { path: "agent.ts", content: "two" },
      { path: "new.md", content: "n" },
    ]);
    expect(plan.remove).toEqual(["old.md"]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.base.commit).toBe("c2");
  });

  it("does nothing for a file both sides changed the same way", () => {
    const plan = planPull(asFiles({ "a.md": "same" }), synced({ "a.md": "old" }), synced({ "a.md": "same" }, "c2"));
    expect(plan).toMatchObject({ write: [], remove: [], conflicts: [] });
  });

  it("reports conflicts instead of choosing a side", () => {
    const base = synced({ "a.md": "old", "b.md": "old" });
    const remote = synced({ "a.md": "theirs" }, "c2");
    const local = asFiles({ "a.md": "ours" });
    expect(planPull(local, base, remote).conflicts).toEqual(["a.md"]);
  });
});
