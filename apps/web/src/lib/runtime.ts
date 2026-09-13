import "server-only";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { isAuthEnabled } from "@evelab/auth";
import { projectRoot } from "@/lib/workspace";

/**
 * The development runtime: `eve dev --no-ui` in the project directory.
 *
 * EveLab drives Eve rather than re-implementing it, so a run talks to the same
 * HTTP session API the eve TUI uses. The child process gets a scrubbed
 * environment: it never inherits EveLab's own credentials (GitHub tokens, the
 * database, the auth secret), only what a model call needs. Eve loads the
 * project's own `.env.local` itself, which is where `eve link` puts the
 * AI Gateway credential.
 */

export type RuntimeStatus = "stopped" | "installing" | "starting" | "running" | "failed";

export interface RuntimeSnapshot {
  status: RuntimeStatus;
  url?: string;
  startedAt?: string;
  message?: string;
  log: string[];
}

interface RuntimeEntry {
  status: RuntimeStatus;
  url?: string;
  startedAt?: string;
  message?: string;
  log: string[];
  child?: ChildProcess;
  ready?: Promise<void>;
}

const LOG_LINES = 200;
const START_TIMEOUT_MS = 90_000;

const registry: Map<string, RuntimeEntry> = ((globalThis as { __evelabRuntimes?: Map<string, RuntimeEntry> }).__evelabRuntimes ??=
  new Map());

/** Environment variables a child may see. Everything else EveLab holds stays in EveLab. */
const PASSED_ENV = ["PATH", "HOME", "USER", "LANG", "LC_ALL", "TERM", "TMPDIR", "SHELL", "NODE_OPTIONS", "AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN"];

export function childEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "development", EVE_TELEMETRY_DISABLED: "1" };
  for (const key of PASSED_ENV) if (process.env[key]) env[key] = process.env[key];
  return { ...env, ...extra };
}

/**
 * Running project code on the EveLab server is only acceptable when EveLab is a
 * local, single-user tool. A hosted EveLab runs agents on Vercel instead.
 */
export function localRuntimeAllowed(): boolean {
  return !isAuthEnabled() || process.env.EVELAB_ALLOW_LOCAL_RUNTIME === "1";
}

function snapshot(entry: RuntimeEntry | undefined): RuntimeSnapshot {
  if (!entry) return { status: "stopped", log: [] };
  const { status, url, startedAt, message, log } = entry;
  return { status, url, startedAt, message, log: [...log] };
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
    const clean = line.replace(/\[[0-9;]*m/g, "").trimEnd();
    if (clean) entry.log.push(clean);
  }
  if (entry.log.length > LOG_LINES) entry.log.splice(0, entry.log.length - LOG_LINES);
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

async function waitForHealth(entry: RuntimeEntry, url: string): Promise<void> {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (entry.status !== "starting") return;
    try {
      const response = await fetch(`${url}/eve/v1/health`, { cache: "no-store", signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("eve dev did not become healthy within 90 seconds.");
}

async function boot(projectId: string, entry: RuntimeEntry): Promise<void> {
  if (!eveCommand(projectId, [])) {
    entry.status = "installing";
    pushLog(entry, "Installing the project's dependencies, eve included...");
    const code = await runInProject(projectId, installCommand(projectId), (chunk) => pushLog(entry, chunk));
    if (entry.status !== "installing") return;
    if (code !== 0 || !eveCommand(projectId, [])) {
      throw new Error("Installing dependencies failed, so eve is not available. See the log.");
    }
  }

  entry.status = "starting";
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const command = eveCommand(projectId, ["dev", "--no-ui", "--host", "127.0.0.1", "--port", String(port)])!;
  const child = spawn(command.command, command.args, {
    cwd: projectRoot(projectId),
    env: childEnv({ PORT: String(port) }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  entry.child = child;
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

  await waitForHealth(entry, url);
  if (entry.status !== "starting") return;
  entry.status = "running";
  entry.url = url;
  entry.startedAt = new Date().toISOString();
}

/** Starts `eve dev` for a project, resolving once it answers its health check or fails. */
export async function startRuntime(projectId: string): Promise<RuntimeSnapshot> {
  if (!localRuntimeAllowed()) {
    return {
      status: "failed",
      message: "This EveLab is multi-user, so it does not run project code itself. Deploy to Vercel and run against the deployment.",
      log: [],
    };
  }
  const existing = registry.get(projectId);
  if (existing?.ready && (existing.status === "installing" || existing.status === "starting")) {
    await existing.ready.catch(() => undefined);
    return snapshot(existing);
  }
  if (existing?.status === "running") return snapshot(existing);

  const entry: RuntimeEntry = { status: "starting", log: [] };
  registry.set(projectId, entry);
  entry.ready = boot(projectId, entry).catch((error: unknown) => {
    entry.status = "failed";
    entry.message = error instanceof Error ? error.message : "eve dev failed to start.";
    entry.child?.kill("SIGTERM");
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
  return snapshot(entry);
}
