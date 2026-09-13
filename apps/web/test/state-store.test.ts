import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stateStore } from "../src/lib/state-store";

describe("stateStore on disk", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "evelab-state-"));
    process.env.EVELAB_WORKSPACE = join(root, "workspace");
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  afterEach(async () => {
    delete process.env.EVELAB_WORKSPACE;
    await rm(root, { recursive: true, force: true });
  });

  it("keeps state beside the workspace, where layouts and runs always lived", async () => {
    const store = stateStore();
    expect(store.kind).toBe("fs");
    await store.write("runs/demo/wrun_1.json", "{}");
    await store.append("runs/demo/wrun_1.ndjson", "a\n");
    await store.append("runs/demo/wrun_1.ndjson", "b\n");

    expect(await readFile(join(root, "runs", "demo", "wrun_1.ndjson"), "utf8")).toBe("a\nb\n");
    expect(await store.read("runs/demo/wrun_1.json")).toBe("{}");
    expect(await store.read("runs/demo/missing.json")).toBeUndefined();
    expect((await store.list("runs/demo/")).sort()).toEqual(["runs/demo/wrun_1.json", "runs/demo/wrun_1.ndjson"]);
    expect(await store.list("runs/nobody/")).toEqual([]);
  });

  it("refuses keys that could escape the store", async () => {
    const store = stateStore();
    await expect(store.write("../outside.json", "x")).rejects.toThrow(/Invalid state key/);
    await expect(store.write("runs/../../x.json", "x")).rejects.toThrow(/Invalid state key/);
  });
});
