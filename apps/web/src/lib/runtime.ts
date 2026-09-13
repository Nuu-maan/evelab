import "server-only";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { Writable } from "node:stream";
import type { Sandbox } from "@vercel/sandbox";
import { isAuthEnabled } from "@evelab/auth";
import { onProjectFilesChanged } from "@/lib/project-events";
import { sandboxCredentials } from "@/lib/vercel-platform";
import { isIgnoredPath, projectRoot, readProjectFiles } from "@/lib/workspace";

/**
 * The development runtime: `eve dev --no-ui` for a project, reached over Eve's
 * HTTP session API.
 *
 * Where it runs depends on what is configured. With Vercel credentials it runs
 * inside a Vercel Sandbox microVM: the project is uploaded, dependencies are
 * installed there, and the dev server is exposed on the sandbox's own domain.
 * Project code never touches the EveLab server, which is what makes runs safe
 * for a shared EveLab. Without credentials, a local, single-user EveLab runs it
 * as a child process in the project directory with a scrubbed environment.
 */

export type RuntimeStatus = "stopped" | "installing" | "starting" | "running" | "failed";
export type RuntimeTarget = "sandbox" | "local";
export type RuntimeStepStatus = "pending" | "active" | "done" | "failed" | "skipped";

export interface RuntimeStep {
  id: "create" | "upload" | "install" | "start" | "ready";
  label: string;
  status: RuntimeStepStatus;
  startedAt?: string;
  endedAt?: string;
  detail?: string;
}

export interface RuntimeSnapshot {
  status: RuntimeStatus;
  target: RuntimeTarget;
  url?: string;
  startedAt?: string;
  /** When the sandbox shuts itself down, for a sandbox target. */
  expiresAt?: string;
  sandboxId?: string;
  message?: string;
  steps: RuntimeStep[];
  log: string[];
}

interface RuntimeEntry extends Omit<RuntimeSnapshot, "steps" | "log"> {
  steps: RuntimeStep[];
  log: string[];
  child?: ChildProcess;
  sandbox?: Sandbox;
  ready?: Promise<void>;
}

const LOG_LINES = 300;
const START_TIMEOUT_MS = 180_000;
const EVE_PORT = 2000;
/** A dev sandbox lives this long; runs are interactive, so this is generous but bounded. */
const SANDBOX_TIMEOUT_MS = 45 * 60_000;

const registry: Map<string, RuntimeEntry> = ((globalThis as { __evelabRuntimes?: Map<string, RuntimeEntry> }).__evelabRuntimes ??=
  new Map());

/** Environment variables a child may see. Everything else EveLab holds stays in EveLab. */
const PASSED_ENV = ["PATH", "HOME", "USER", "LANG", "LC_ALL", "TERM", "TMPDIR", "SHELL", "NODE_OPTIONS", "AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN"];

export function childEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "development", EVE_TELEMETRY_DISABLED: "1" };
  for (const key of PASSED_ENV) if (process.env[key]) env[key] = process.env[key];
  return { ...env, ...extra };
}

/** Where the next start will run: a Vercel Sandbox whenever credentials allow, unless forced local. */
export function runtimeTarget(): RuntimeTarget {
  if (process.env.EVELAB_RUNTIME === "local" || process.env.EVELAB_EVE_BIN) return "local";
  return sandboxCredentials(process.env) ? "sandbox" : "local";
}

/**
 * Running project code on the EveLab server is only acceptable when EveLab is a
 * local, single-user tool. A shared EveLab runs agents in Vercel Sandbox.
 */
export function localRuntimeAllowed(): boolean {
  return !isAuthEnabled() || process.env.EVELAB_ALLOW_LOCAL_RUNTIME === "1";
}

/** Whether pressing Start can work at all on this server. */
export function runtimeAvailable(): boolean {
  return runtimeTarget() === "sandbox" || localRuntimeAllowed();
}

function planSteps(target: RuntimeTarget): RuntimeStep[] {
  const steps: RuntimeStep[] =
    target === "sandbox"
      ? [
          { id: "create", label: "Create Vercel Sandbox", status: "pending" },
          { id: "upload", label: "Upload project files", status: "pending" },
          { id: "install", label: "Install dependencies", status: "pending" },
        ]
      : [{ id: "install", label: "Install dependencies", status: "pending" }];
  return [...steps, { id: "start", label: "Start eve dev", status: "pending" }, { id: "ready", label: "Health check", status: "pending" }];
}

function snapshot(entry: RuntimeEntry | undefined): RuntimeSnapshot {
  if (!entry) return { status: "stopped", target: runtimeTarget(), steps: [], log: [] };
  const { status, target, url, startedAt, expiresAt, sandboxId, message, steps, log } = entry;
  return { status, target, url, startedAt, expiresAt, sandboxId, message, steps: steps.map((step) => ({ ...step })), log: [...log] };
}

export function getRuntime(projectId: string): RuntimeSnapshot {
  return snapshot(registry.get(projectId));
}

export function runtimeUrl(projectId: string): string | undefined {
  const entry = registry.get(projectId);
  return entry?.status === "running" ? entry.url : undefined;
}

function pushLog(entry: RuntimeEntry, chunk: string): void {
  for (const line of chunk.split(/\r?\n/)) {
    // Strip terminal colour codes; the page shows plain text.
    const clean = line.replace(/\[[0-9;]*m/g, "").trimEnd();
    if (clean) entry.log.push(clean);
  }
  if (entry.log.length > LOG_LINES) entry.log.splice(0, entry.log.length - LOG_LINES);
}

async function step<T>(entry: RuntimeEntry, id: RuntimeStep["id"], run: (current: RuntimeStep) => Promise<T>): Promise<T> {
  const current = entry.steps.find((candidate) => candidate.id === id)!;
  current.status = "active";
  current.startedAt = new Date().toISOString();
  try {
    const result = await run(current);
    if (current.status === "active") current.status = "done";
    return result;
  } catch (error) {
    current.status = "failed";
    throw error;
  } finally {
    current.endedAt = new Date().toISOString();
  }
}

/** How to invoke eve for a project: EVELAB_EVE_BIN, then the project's own install. */
export function eveCommand(projectId: string, args: string[]): { command: string; args: string[] } | undefined {
  const override = process.env.EVELAB_EVE_BIN;
  if (override) {
    return /\.(m?js|cjs)$/.test(override) ? { command: process.execPath, args: [override, ...args] } : { command: override, args };
  }
  const local = join(projectRoot(projectId), "node_modules", ".bin", "eve");
  return existsSync(local) ? { command: local, args } : undefined;
}

function installCommand(projectId: string): { command: string; args: string[] } {
  const root = projectRoot(projectId);
  if (existsSync(join(root, "pnpm-lock.yaml"))) return { command: "pnpm", args: ["install", "--prefer-offline"] };
  if (existsSync(join(root, "bun.lock")) || existsSync(join(root, "bun.lockb"))) return { command: "bun", args: ["install"] };
  return { command: "npm", args: ["install", "--no-audit", "--no-fund"] };
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/** Runs a command in the project directory, feeding its output to `onOutput`. */
export function runInProject(
  projectId: string,
  command: { command: string; args: string[] },
  onOutput: (chunk: string) => void,
  env: Record<string, string> = {},
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command.command, command.args, {
      cwd: projectRoot(projectId),
      env: childEnv(env),
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk: Buffer) => onOutput(chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => onOutput(chunk.toString()));
    child.on("error", (error) => {
      onOutput(`${error.message}\n`);
      resolve(127);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/**
 * Makes sure eve can be invoked for a project on this machine, installing its
 * dependencies (eve is one of them) when it cannot. Returns false when that failed.
 */
export async function ensureEve(projectId: string, onOutput: (chunk: string) => void): Promise<boolean> {
  if (eveCommand(projectId, [])) return true;
  onOutput("Installing the project's dependencies, eve included...\n");
  const code = await runInProject(projectId, installCommand(projectId), onOutput);
  if (code === 0 && eveCommand(projectId, [])) return true;
  onOutput("Installing dependencies failed, so eve is not available.\n");
  return false;
}

async function waitForHealth(entry: RuntimeEntry, url: string): Promise<void> {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (entry.status !== "starting") return;
    try {
      const response = await fetch(`${url}/eve/v1/health`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("eve dev did not answer its health check in time. See the log.");
}

async function bootLocal(projectId: string, entry: RuntimeEntry): Promise<void> {
  await step(entry, "install", async (current) => {
    if (eveCommand(projectId, [])) {
      current.status = "skipped";
      current.detail = "Already installed";
      return;
    }
    entry.status = "installing";
    if (!(await ensureEve(projectId, (chunk) => pushLog(entry, chunk)))) {
      throw new Error("Installing dependencies failed, so eve is not available. See the log.");
    }
  });
  if (entry.status === "stopped") return;

  entry.status = "starting";
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  await step(entry, "start", async (current) => {
    const command = eveCommand(projectId, ["dev", "--no-ui", "--host", "127.0.0.1", "--port", String(port)])!;
    const child = spawn(command.command, command.args, {
      cwd: projectRoot(projectId),
      env: childEnv({ PORT: String(port) }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    entry.child = child;
    current.detail = `Port ${port}`;
    child.stdout?.on("data", (chunk: Buffer) => pushLog(entry, chunk.toString()));
    child.stderr?.on("data", (chunk: Buffer) => pushLog(entry, chunk.toString()));
    child.on("exit", (code, signal) => {
      if (entry.child !== child) return;
      entry.child = undefined;
      if (entry.status === "stopped") return;
      entry.status = "failed";
      entry.url = undefined;
      entry.message = `eve dev exited (${signal ?? `code ${code}`}).`;
    });
  });
  await step(entry, "ready", () => waitForHealth(entry, url));
  if (entry.status !== "starting") return;
  entry.url = url;
}

function logWriter(entry: RuntimeEntry): Writable {
  return new Writable({
    write(chunk: Buffer, _encoding, callback) {
      pushLog(entry, chunk.toString());
      callback();
    },
  });
}

async function bootSandbox(projectId: string, entry: RuntimeEntry): Promise<void> {
  const { Sandbox } = await import("@vercel/sandbox");

  const sandbox = await step(entry, "create", async (current) => {
    const created = await Sandbox.create({
      ...sandboxCredentials(process.env),
      runtime: "node24",
      ports: [EVE_PORT],
      timeout: SANDBOX_TIMEOUT_MS,
      resources: { vcpus: 2 },
    });
    current.detail = "node24, 2 vCPUs";
    return created;
  });
  entry.sandbox = sandbox;
  entry.sandboxId = sandbox.name;
  entry.expiresAt = new Date(Date.now() + SANDBOX_TIMEOUT_MS).toISOString();
  if (entry.status === "stopped") return void sandbox.stop().catch(() => undefined);

  await step(entry, "upload", async (current) => {
    const files = (await readProjectFiles(projectId)).filter((file) => !isIgnoredPath(file.path));
    await sandbox.writeFiles(files.map((file) => ({ path: file.path, content: file.content })));
    current.detail = `${files.length} files`;
  });

  await step(entry, "install", async () => {
    entry.status = "installing";
    const install = await sandbox.runCommand({
      cmd: "npm",
      args: ["install", "--no-audit", "--no-fund"],
      stdout: logWriter(entry),
      stderr: logWriter(entry),
    });
    if (install.exitCode !== 0) throw new Error("npm install failed in the sandbox. See the log.");
  });
  if (entry.status === "stopped") return;

  entry.status = "starting";
  await step(entry, "start", async (current) => {
    const env: Record<string, string> = { EVE_TELEMETRY_DISABLED: "1" };
    if (process.env.AI_GATEWAY_API_KEY) env.AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;
    const command = await sandbox.runCommand({
      cmd: "npx",
      args: ["eve", "dev", "--no-ui", "--host", "0.0.0.0", "--port", String(EVE_PORT)],
      env,
      detached: true,
    });
    current.detail = `Port ${EVE_PORT}`;
    void (async () => {
      try {
        for await (const line of command.logs()) pushLog(entry, line.data);
      } catch {
        // The log stream ends when the sandbox stops.
      }
    })();
  });

  const url = sandbox.domain(EVE_PORT);
  await step(entry, "ready", async (current) => {
    current.detail = url.replace(/^https?:\/\//, "");
    await waitForHealth(entry, url);
  });
  if (entry.status !== "starting") return;
  entry.url = url;
}

/** Starts `eve dev` for a project, resolving once it answers its health check or fails. */
export async function startRuntime(projectId: string): Promise<RuntimeSnapshot> {
  const target = runtimeTarget();
  if (target === "local" && !localRuntimeAllowed()) {
    return {
      status: "failed",
      target,
      steps: [],
      message: "This EveLab is shared, so it does not run project code itself. Connect Vercel Sandbox to run agents in isolation.",
      log: [],
    };
  }
  const existing = registry.get(projectId);
  if (existing?.ready && (existing.status === "installing" || existing.status === "starting")) {
    await existing.ready.catch(() => undefined);
    return snapshot(existing);
  }
  if (existing?.status === "running") return snapshot(existing);

  const entry: RuntimeEntry = { status: "starting", target, steps: planSteps(target), log: [] };
  registry.set(projectId, entry);
  entry.ready = (target === "sandbox" ? bootSandbox(projectId, entry) : bootLocal(projectId, entry))
    .then(() => {
      if (entry.status !== "starting" || !entry.url) return;
      entry.status = "running";
      entry.startedAt = new Date().toISOString();
    })
    .catch((error: unknown) => {
      if (entry.status === "stopped") return;
      entry.status = "failed";
      entry.message = error instanceof Error ? error.message : "eve dev failed to start.";
      for (const current of entry.steps) if (current.status === "pending") current.status = "skipped";
      entry.child?.kill("SIGTERM");
      void entry.sandbox?.stop().catch(() => undefined);
    });
  await entry.ready;
  return snapshot(entry);
}

export function stopRuntime(projectId: string): RuntimeSnapshot {
  const entry = registry.get(projectId);
  if (!entry) return snapshot(undefined);
  entry.status = "stopped";
  entry.url = undefined;
  entry.child?.kill("SIGTERM");
  entry.child = undefined;
  void entry.sandbox?.stop().catch(() => undefined);
  entry.sandbox = undefined;
  return snapshot(entry);
}

// A save in EveLab reaches a running sandbox the way it would reach a local
// directory, so eve dev reloads on it. Local runtimes read the directory already.
const syncRegistered = (globalThis as { __evelabRuntimeSync?: boolean }).__evelabRuntimeSync;
if (!syncRegistered) {
  (globalThis as { __evelabRuntimeSync?: boolean }).__evelabRuntimeSync = true;
  onProjectFilesChanged((projectId, changes) => {
    const entry = registry.get(projectId);
    const sandbox = entry?.sandbox;
    if (!entry || !sandbox || entry.status !== "running") return;
    const relevant = changes.filter((change) => !isIgnoredPath(change.path));
    const written = relevant.flatMap((change) => (change.content === undefined ? [] : [{ path: change.path, content: change.content }]));
    const removed = relevant.filter((change) => change.content === undefined).map((change) => change.path);
    void (async () => {
      try {
        if (written.length > 0) await sandbox.writeFiles(written);
        if (removed.length > 0) await sandbox.runCommand("rm", ["-f", "--", ...removed]);
        pushLog(entry, `Synced ${written.length + removed.length} changed file${written.length + removed.length === 1 ? "" : "s"} to the sandbox.`);
      } catch (error) {
        pushLog(entry, `Could not sync changes to the sandbox: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    })();
  });
}
