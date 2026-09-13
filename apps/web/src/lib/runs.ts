import "server-only";
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { sessionStatus, type EveEvent, type SessionStatus } from "@/lib/run-timeline";
import { workspaceRoot } from "@/lib/workspace";

/**
 * A record of every session started from EveLab, so a run can be inspected
 * after the dev server stops. Like canvas layouts this is EveLab's own state,
 * kept beside the workspace and never inside a project. Events are stored as
 * eve emitted them, keyed by `meta.id` so re-reading a stream adds nothing.
 */

const PROJECT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const sessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

export const runRecordSchema = z.object({
  sessionId: sessionIdSchema,
  title: z.string(),
  target: z.string(),
  startedAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(["starting", "running", "waiting", "input", "failed", "completed"]),
  eventCount: z.number().int().nonnegative(),
  usage: z.object({ inputTokens: z.number(), outputTokens: z.number(), costUsd: z.number() }),
});
export type RunRecord = z.infer<typeof runRecordSchema>;

function runsDirectory(projectId: string): string {
  if (!PROJECT_ID.test(projectId)) throw new Error(`Invalid project id: ${projectId}`);
  return resolve(join(workspaceRoot(), "..", "runs", projectId));
}

function paths(projectId: string, sessionId: string) {
  const id = sessionIdSchema.parse(sessionId);
  const directory = runsDirectory(projectId);
  return { directory, record: join(directory, `${id}.json`), events: join(directory, `${id}.ndjson`) };
}

async function readRecord(file: string): Promise<RunRecord | undefined> {
  try {
    const parsed = runRecordSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export async function startRunRecord(projectId: string, sessionId: string, title: string, target: string): Promise<void> {
  const { directory, record } = paths(projectId, sessionId);
  await mkdir(directory, { recursive: true });
  const now = new Date().toISOString();
  const run: RunRecord = {
    sessionId,
    title: title.slice(0, 200),
    target,
    startedAt: now,
    updatedAt: now,
    status: "starting",
    eventCount: 0,
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
  };
  await writeFile(record, `${JSON.stringify(run, null, 2)}\n`);
}

export async function listRuns(projectId: string): Promise<RunRecord[]> {
  const directory = runsDirectory(projectId);
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return [];
  }
  const records = await Promise.all(
    names.filter((name) => name.endsWith(".json")).map((name) => readRecord(join(directory, name))),
  );
  return records
    .filter((record): record is RunRecord => Boolean(record))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function getRun(projectId: string, sessionId: string): Promise<RunRecord | undefined> {
  return readRecord(paths(projectId, sessionId).record);
}

export async function readRunEvents(projectId: string, sessionId: string): Promise<EveEvent[]> {
  try {
    const raw = await readFile(paths(projectId, sessionId).events, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as EveEvent];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function eventKey(event: EveEvent): string {
  return event.meta?.id ?? JSON.stringify(event);
}

/** One write at a time per session, so two readers of a stream cannot store an event twice. */
const writes = new Map<string, Promise<void>>();

/** Appends events not already stored and refreshes the run's status and usage. */
export function appendRunEvents(projectId: string, sessionId: string, incoming: EveEvent[]): Promise<void> {
  if (incoming.length === 0) return Promise.resolve();
  const key = `${projectId}/${sessionId}`;
  const next = (writes.get(key) ?? Promise.resolve()).then(() => writeRunEvents(projectId, sessionId, incoming));
  const settled = next.catch(() => undefined);
  writes.set(key, settled);
  void settled.then(() => {
    if (writes.get(key) === settled) writes.delete(key);
  });
  return next;
}

async function writeRunEvents(projectId: string, sessionId: string, incoming: EveEvent[]): Promise<void> {
  const file = paths(projectId, sessionId);
  const stored = await readRunEvents(projectId, sessionId);
  const seen = new Set(stored.map(eventKey));
  const fresh = incoming.filter((event) => {
    const key = eventKey(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (fresh.length === 0) return;
  await mkdir(file.directory, { recursive: true });
  await appendFile(file.events, fresh.map((event) => `${JSON.stringify(event)}\n`).join(""));

  const all = [...stored, ...fresh];
  const record = await readRecord(file.record);
  if (!record) return;
  const usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  for (const event of all) {
    if (event.type !== "step.completed") continue;
    const step = (event.data?.usage ?? {}) as Record<string, unknown>;
    usage.inputTokens += typeof step.inputTokens === "number" ? step.inputTokens : 0;
    usage.outputTokens += typeof step.outputTokens === "number" ? step.outputTokens : 0;
    usage.costUsd += typeof step.costUsd === "number" ? step.costUsd : 0;
  }
  const status: SessionStatus = sessionStatus(all);
  await writeFile(
    file.record,
    `${JSON.stringify({ ...record, status, eventCount: all.length, usage, updatedAt: new Date().toISOString() }, null, 2)}\n`,
  );
}
