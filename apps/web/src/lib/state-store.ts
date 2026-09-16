import "server-only";
import { appendFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { appState, eq, getDb, sql } from "@evelab/db";
import { storageMode, workspaceRoot } from "@/lib/workspace";

/**
 * Where evelab keeps its own state: canvas layouts, repository links, run
 * recordings and deployment history. Never project files.
 *
 * With `BLOB_READ_WRITE_TOKEN` set, state lives in Vercel Blob as private
 * objects. When projects are stored in the database, state is kept there too,
 * so a deployment with a read-only disk loses nothing. Otherwise state is
 * files beside the workspace, exactly where it always was.
 */

export interface StateStore {
  kind: "fs" | "blob" | "database";
  read(key: string): Promise<string | undefined>;
  write(key: string, content: string): Promise<void>;
  append(key: string, content: string): Promise<void>;
  /** Keys under a prefix, each relative to the store root. */
  list(prefix: string): Promise<string[]>;
  /** Forgets a key. Nothing happens when it does not exist. */
  remove(key: string): Promise<void>;
}

const KEY = /^[a-z0-9][a-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

function assertKey(key: string): string {
  if (!KEY.test(key) || key.split("/").includes("..")) throw new Error(`Invalid state key: ${key}`);
  return key;
}

function fsStore(): StateStore {
  const root = resolve(join(workspaceRoot(), ".."));
  const path = (key: string) => join(root, assertKey(key));
  return {
    kind: "fs",
    async read(key) {
      try {
        return await readFile(path(key), "utf8");
      } catch {
        return undefined;
      }
    },
    async write(key, content) {
      await mkdir(dirname(path(key)), { recursive: true });
      await writeFile(path(key), content, "utf8");
    },
    async append(key, content) {
      await mkdir(dirname(path(key)), { recursive: true });
      await appendFile(path(key), content, "utf8");
    },
    async list(prefix) {
      const directory = join(root, prefix.replace(/\/$/, ""));
      try {
        const entries = await readdir(directory, { withFileTypes: true });
        return entries
          .filter((entry) => entry.isFile())
          .map((entry) => relative(root, join(directory, entry.name)).split(sep).join("/"));
      } catch {
        return [];
      }
    },
    async remove(key) {
      await rm(path(key), { force: true });
    },
  };
}

const BLOB_PREFIX = "evelab/";

function blobStore(): StateStore {
  const store: StateStore = {
    kind: "blob",
    async read(key) {
      const { get } = await import("@vercel/blob");
      const result = await get(`${BLOB_PREFIX}${assertKey(key)}`, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200) return undefined;
      return new Response(result.stream).text();
    },
    async write(key, content) {
      const { put } = await import("@vercel/blob");
      await put(`${BLOB_PREFIX}${assertKey(key)}`, content, {
        access: "private",
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: key.endsWith(".json") ? "application/json" : "application/x-ndjson",
      });
    },
    // Blob objects are immutable; an append rewrites the object. Recordings are small enough for that.
    async append(key, content) {
      const existing = (await store.read(key)) ?? "";
      await store.write(key, existing + content);
    },
    async list(prefix) {
      const { list } = await import("@vercel/blob");
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: `${BLOB_PREFIX}${prefix}`, cursor });
        keys.push(...page.blobs.map((blob) => blob.pathname.slice(BLOB_PREFIX.length)));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return keys;
    },
    async remove(key) {
      const { del } = await import("@vercel/blob");
      await del(`${BLOB_PREFIX}${assertKey(key)}`);
    },
  };
  return store;
}

function databaseStore(): StateStore {
  const database = () => {
    const db = getDb();
    if (!db) throw new Error("State is stored in the database, but DATABASE_URL is not set.");
    return db;
  };
  return {
    kind: "database",
    async read(key) {
      const [row] = await database()
        .select({ content: appState.content })
        .from(appState)
        .where(eq(appState.key, assertKey(key)))
        .limit(1);
      return row?.content;
    },
    async write(key, content) {
      const now = new Date();
      await database()
        .insert(appState)
        .values({ key: assertKey(key), content, updatedAt: now })
        .onConflictDoUpdate({ target: appState.key, set: { content, updatedAt: now } });
    },
    async append(key, content) {
      const now = new Date();
      await database()
        .insert(appState)
        .values({ key: assertKey(key), content, updatedAt: now })
        .onConflictDoUpdate({ target: appState.key, set: { content: sql`${appState.content} || ${content}`, updatedAt: now } });
    },
    // Direct children of the prefix only, as a directory listing on disk returns them.
    async list(prefix) {
      const base = `${prefix.replace(/\/$/, "")}/`;
      const rows = await database()
        .select({ key: appState.key })
        .from(appState)
        .where(sql`starts_with(${appState.key}, ${base})`);
      return rows.map((row) => row.key).filter((key) => !key.slice(base.length).includes("/"));
    },
    async remove(key) {
      await database().delete(appState).where(eq(appState.key, assertKey(key)));
    },
  };
}

export function stateStore(): StateStore {
  if (process.env.BLOB_READ_WRITE_TOKEN) return blobStore();
  return storageMode() === "database" ? databaseStore() : fsStore();
}
