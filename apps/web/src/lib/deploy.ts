import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { readGitState } from "@/lib/git";
import { ensureEve, eveCommand, runInProject } from "@/lib/runtime";
import { workspaceRoot } from "@/lib/workspace";

/**
 * Deployment is `eve deploy`, the same command a developer runs: it installs
 * dependencies, runs `vercel deploy --prod`, and Vercel provisions Workflow,
 * Sandbox, Cron and AI Gateway access for the agent. EveLab only starts it,
 * keeps the log, and records the result beside the workspace.
 */

const PROJECT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const LOG_LINES = 400;

export const deploySettingsSchema = z.object({
  /** Vercel project name or id; `eve deploy --project` links it first. */
  project: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9._-]{0,99}$/, "Use a Vercel project name: lowercase letters, digits, ., _ and -")
    .optional(),
  /** Team id or slug, when the token can reach more than one team. */
  team: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,100}$/, "Use a team id or slug")
    .optional(),
});
export type DeploySettings = z.infer<typeof deploySettingsSchema>;

const deploymentSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  status: z.enum(["building", "ready", "failed"]),
  url: z.string().optional(),
  commit: z.string().optional(),
  project: z.string(),
  log: z.array(z.string()),
});
export type Deployment = z.infer<typeof deploymentSchema>;

const stateSchema = z.object({
  settings: deploySettingsSchema.default({}),
  deployments: z.array(deploymentSchema).default([]),
});
export type DeployState = z.infer<typeof stateSchema>;

function statePath(projectId: string): string {
  if (!PROJECT_ID.test(projectId)) throw new Error(`Invalid project id: ${projectId}`);
  return resolve(join(workspaceRoot(), "..", "deployments", `${projectId}.json`));
}

export async function readDeployState(projectId: string): Promise<DeployState> {
  try {
    const parsed = stateSchema.safeParse(JSON.parse(await readFile(statePath(projectId), "utf8")));
    return parsed.success ? parsed.data : { settings: {}, deployments: [] };
  } catch {
    return { settings: {}, deployments: [] };
  }
}

const writes = new Map<string, Promise<unknown>>();

/** Read, change and write the state file one caller at a time. */
function updateState(projectId: string, change: (state: DeployState) => void): Promise<DeployState> {
  const next = (writes.get(projectId) ?? Promise.resolve()).then(async () => {
    const state = await readDeployState(projectId);
    change(state);
    const path = statePath(projectId);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(state, null, 2)}\n`);
    return state;
  });
  writes.set(projectId, next.catch(() => undefined));
  return next;
}

export function saveDeploySettings(projectId: string, settings: DeploySettings): Promise<DeployState> {
  return updateState(projectId, (state) => {
    state.settings = settings;
  });
}

/** Deploying needs a Vercel token, unless the eve binary is a local stand-in. */
export function deployAvailability(): { ok: true } | { ok: false; reason: string } {
  if (process.env.VERCEL_TOKEN || process.env.EVELAB_EVE_BIN) return { ok: true };
  return {
    ok: false,
    reason: "Set VERCEL_TOKEN on the EveLab server. eve deploy runs non-interactively, so it cannot open a browser to sign in.",
  };
}

/** The production URL `vercel deploy` prints, which is the last vercel.app URL in the output. */
export function deploymentUrl(output: string): string | undefined {
  const matches = output.match(/https:\/\/[a-z0-9][a-z0-9.-]*\.vercel\.app\b/gi);
  return matches?.at(-1);
}

export async function startDeployment(projectId: string): Promise<Deployment> {
  const availability = deployAvailability();
  if (!availability.ok) throw new Error(availability.reason);

  const current = await readDeployState(projectId);
  if (current.deployments.some((deployment) => deployment.status === "building")) {
    throw new Error("A deployment is already building.");
  }
  const project = current.settings.project ?? projectId;
  const commit = (await readGitState(projectId))?.base.commit || undefined;
  const deployment: Deployment = {
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    status: "building",
    project,
    commit,
    log: [],
  };
  await updateState(projectId, (state) => {
    state.deployments.unshift(deployment);
    state.deployments.splice(20);
  });

  void runDeployment(projectId, deployment.id, project, current.settings.team);
  return deployment;
}

async function runDeployment(projectId: string, id: string, project: string, team: string | undefined): Promise<void> {
  const token = process.env.VERCEL_TOKEN;
  const lines: string[] = [];
  let output = "";
  let flushed = 0;

  const append = (chunk: string) => {
    let text = chunk;
    if (token) text = text.split(token).join("[redacted]");
    output += text;
    for (const line of text.split(/\r?\n/)) {
      const clean = line.replace(/\[[0-9;]*m/g, "").trimEnd();
      if (clean) lines.push(clean);
    }
    if (lines.length > LOG_LINES) lines.splice(0, lines.length - LOG_LINES);
    // The page polls, so write the log every so often rather than on every chunk.
    if (Date.now() - flushed > 750) {
      flushed = Date.now();
      void updateState(projectId, (state) => {
        const entry = state.deployments.find((deployment) => deployment.id === id);
        if (entry) entry.log = [...lines];
      });
    }
  };

  let status: Deployment["status"] = "failed";
  let url: string | undefined;
  try {
    if (await ensureEve(projectId, append)) {
      const args = ["deploy", "--non-interactive", "--yes", "--project", project, ...(team ? ["--team", team] : [])];
      const code = await runInProject(projectId, eveCommand(projectId, args)!, append, token ? { VERCEL_TOKEN: token } : {});
      url = deploymentUrl(output);
      status = code === 0 && url ? "ready" : "failed";
      if (code === 0 && !url) append("eve deploy finished but printed no deployment URL.");
    }
  } catch (error) {
    append(error instanceof Error ? error.message : "The deployment failed.");
  }

  await updateState(projectId, (state) => {
    const entry = state.deployments.find((deployment) => deployment.id === id);
    if (!entry) return;
    Object.assign(entry, { status, url, log: [...lines], finishedAt: new Date().toISOString() });
  });
}
