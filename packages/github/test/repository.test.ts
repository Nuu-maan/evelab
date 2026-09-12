import { describe, expect, it } from "vitest";
import {
  commitFiles,
  computeChanges,
  createRepository,
  getBranchHead,
  gitBlobSha,
  GitHubError,
  parseRepositoryName,
  readRepositoryTree,
  RemoteMovedError,
  type SyncBase,
} from "../src/index.js";
import { base64, fakeClient, sha } from "./fake-client.js";

const repo = parseRepositoryName("acme/agent");
const HEAD = sha("a");
const TREE = sha("b");

function treeRoutes(entries: { path: string; mode?: string; type?: string; content?: string; size?: number }[]) {
  const routes: Record<string, () => unknown> = {
    [`GET /repos/acme/agent/git/commits/${HEAD}`]: () => ({ sha: HEAD, tree: { sha: TREE } }),
    [`GET /repos/acme/agent/git/trees/${TREE}`]: () => ({
      truncated: false,
      tree: entries.map((entry) => ({
        path: entry.path,
        mode: entry.mode ?? "100644",
        type: entry.type ?? "blob",
        sha: entry.content === undefined ? sha("f") : gitBlobSha(entry.content),
        size: entry.size ?? entry.content?.length ?? 0,
      })),
    }),
  };
  for (const entry of entries) {
    if (entry.content === undefined) continue;
    routes[`GET /repos/acme/agent/git/blobs/${gitBlobSha(entry.content)}`] = () => ({
      content: base64(entry.content!),
      encoding: "base64",
    });
  }
  return routes;
}

describe("readRepositoryTree", () => {
  it("maps a tree to text files and explains everything it skipped", async () => {
    const { client } = fakeClient({
      ...treeRoutes([
        { path: "agent.ts", content: "export default 1;\n" },
        { path: "skills/run.sh", mode: "100755", content: "#!/bin/sh\n" },
        { path: "skills", type: "tree" },
        { path: "vendor/lib", type: "commit" },
        { path: "link", mode: "120000", content: "../../etc/passwd" },
        { path: "../escape.ts", content: "x" },
        { path: "node_modules/x.js", content: "y" },
        { path: "huge.json", size: 5_000_000 },
      ]),
      [`GET /repos/acme/agent/git/blobs/${gitBlobSha("\0binary")}`]: () => ({ content: base64("\0binary"), encoding: "base64" }),
    });

    const snapshot = await readRepositoryTree(client, repo, HEAD, {
      skip: (path) => (path.startsWith("node_modules/") ? "not part of a project" : undefined),
    });

    expect(Object.keys(snapshot.files)).toEqual(["agent.ts", "skills/run.sh"]);
    expect(snapshot.files["skills/run.sh"]).toMatchObject({ mode: "100755", content: "#!/bin/sh\n" });
    expect(snapshot.commit).toBe(HEAD);
    expect(snapshot.warnings).toEqual([
      'Skipped submodule "vendor/lib".',
      'Skipped symlink "link".',
      'Skipped "../escape.ts": unsafe path.',
      'Skipped "node_modules/x.js": not part of a project.',
      'Skipped "huge.json": larger than 1024 KB.',
    ]);
  });

  it("skips binary content", async () => {
    const { client } = fakeClient(treeRoutes([{ path: "logo.png", content: "\0\x01png" }]));
    const snapshot = await readRepositoryTree(client, repo, HEAD);
    expect(snapshot.files).toEqual({});
    expect(snapshot.warnings).toEqual(['Skipped "logo.png": not a text file.']);
  });

  it("bounds the number of files", async () => {
    const entries = Array.from({ length: 4 }, (_, index) => ({ path: `f${index}.md`, content: `${index}` }));
    const { client } = fakeClient(treeRoutes(entries));
    await expect(
      readRepositoryTree(client, repo, HEAD, { limits: { maxFiles: 3, maxFileBytes: 100, maxTotalBytes: 1000 } }),
    ).rejects.toThrow("more than 3 files");
  });
});

describe("getBranchHead", () => {
  it("treats a missing branch and an empty repository as no head", async () => {
    const { client } = fakeClient({
      "GET /repos/acme/agent/git/ref/heads/main": () => new GitHubError("empty", 409),
      "GET /repos/acme/agent/git/ref/heads/feature/x": () => ({ object: { sha: HEAD } }),
    });
    expect(await getBranchHead(client, repo, "main")).toBeUndefined();
    expect(await getBranchHead(client, repo, "feature/x")).toBe(HEAD);
  });
});

describe("commitFiles", () => {
  const base: SyncBase = {
    commit: HEAD,
    files: {
      "agent.ts": { sha: gitBlobSha("one"), mode: "100644", content: "one" },
      "run.sh": { sha: gitBlobSha("#!"), mode: "100755", content: "#!" },
      "old.md": { sha: gitBlobSha("old"), mode: "100644", content: "old" },
    },
  };
  const local = [
    { path: "agent.ts", content: "two" },
    { path: "run.sh", content: "#!/bin/sh" },
    { path: "new.md", content: "new" },
  ];
  const changes = computeChanges(local, base);
  const NEW_TREE = sha("c");
  const NEW_COMMIT = sha("d");

  it("sends exactly the changed files, keeps modes, and fast-forwards the branch", async () => {
    const { client, calls } = fakeClient({
      "GET /repos/acme/agent/git/ref/heads/main": () => ({ object: { sha: HEAD } }),
      [`GET /repos/acme/agent/git/commits/${HEAD}`]: () => ({ sha: HEAD, tree: { sha: TREE } }),
      "POST /repos/acme/agent/git/trees": () => ({ sha: NEW_TREE }),
      "POST /repos/acme/agent/git/commits": () => ({ sha: NEW_COMMIT }),
      "PATCH /repos/acme/agent/git/refs/heads/main": () => ({ object: { sha: NEW_COMMIT } }),
    });

    const next = await commitFiles(client, repo, { branch: "main", message: "Update agent", base, local, changes });

    const tree = calls.find((call) => call.route === "POST /repos/acme/agent/git/trees")!;
    expect(tree.params).toEqual({
      base_tree: TREE,
      tree: [
        { path: "agent.ts", mode: "100644", type: "blob", content: "two" },
        { path: "new.md", mode: "100644", type: "blob", content: "new" },
        { path: "old.md", mode: "100644", type: "blob", sha: null },
        { path: "run.sh", mode: "100755", type: "blob", content: "#!/bin/sh" },
      ],
    });
    expect(calls.find((call) => call.route === "POST /repos/acme/agent/git/commits")!.params).toEqual({
      message: "Update agent",
      tree: NEW_TREE,
      parents: [HEAD],
    });
    expect(calls.at(-1)!.params).toEqual({ sha: NEW_COMMIT, force: false });
    expect(next.commit).toBe(NEW_COMMIT);
    expect(computeChanges(local, next)).toEqual([]);
  });

  it("refuses to commit over commits it has not pulled", async () => {
    const { client, calls } = fakeClient({
      "GET /repos/acme/agent/git/ref/heads/main": () => ({ object: { sha: sha("e") } }),
    });
    await expect(
      commitFiles(client, repo, { branch: "main", message: "x", base, local, changes }),
    ).rejects.toBeInstanceOf(RemoteMovedError);
    expect(calls).toHaveLength(1);
  });

  it("turns a rejected fast-forward into the same error", async () => {
    const { client } = fakeClient({
      "GET /repos/acme/agent/git/ref/heads/main": () => ({ object: { sha: HEAD } }),
      [`GET /repos/acme/agent/git/commits/${HEAD}`]: () => ({ sha: HEAD, tree: { sha: TREE } }),
      "POST /repos/acme/agent/git/trees": () => ({ sha: NEW_TREE }),
      "POST /repos/acme/agent/git/commits": () => ({ sha: NEW_COMMIT }),
      "PATCH /repos/acme/agent/git/refs/heads/main": () => new GitHubError("not a fast forward", 422),
    });
    await expect(
      commitFiles(client, repo, { branch: "main", message: "x", base, local, changes }),
    ).rejects.toBeInstanceOf(RemoteMovedError);
  });

  it("publishes into an empty repository as one root commit", async () => {
    const empty: SyncBase = { commit: "", files: {} };
    const files = [
      { path: "agent.ts", content: "a" },
      { path: "instructions.md", content: "b" },
    ];
    const { client, calls } = fakeClient({
      "GET /repos/acme/agent/git/ref/heads/main": () => new GitHubError("empty", 409),
      "PUT /repos/acme/agent/contents/agent.ts": () => ({}),
      "POST /repos/acme/agent/git/trees": () => ({ sha: NEW_TREE }),
      "POST /repos/acme/agent/git/commits": () => ({ sha: NEW_COMMIT }),
      "PATCH /repos/acme/agent/git/refs/heads/main": () => ({}),
    });

    const next = await commitFiles(client, repo, {
      branch: "main",
      message: "Initial commit",
      base: empty,
      local: files,
      changes: computeChanges(files, empty),
    });

    expect(calls.find((call) => call.route === "POST /repos/acme/agent/git/commits")!.params).toMatchObject({ parents: [] });
    expect(calls.at(-1)!.params).toEqual({ sha: NEW_COMMIT, force: true });
    expect(Object.keys(next.files)).toEqual(["agent.ts", "instructions.md"]);
  });
});

describe("createRepository", () => {
  it("needs a personal token", async () => {
    const { client } = fakeClient({}, "app");
    await expect(createRepository(client, "agent", true)).rejects.toThrow("personal access token");
  });
});
