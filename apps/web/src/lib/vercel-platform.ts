/**
 * Which Vercel products EveLab can use right now, read from the environment.
 *
 * EveLab is built to run on Vercel: agents run in Vercel Sandbox, long work runs
 * in Vercel Workflow, model calls go through AI Gateway, files live in Vercel
 * Blob, and external services connect through Vercel Connect. Every one of them
 * has a local fallback, so the app works before anything is configured; this
 * module is how the UI says what is on, what is not, and what to set.
 *
 * Pure: takes the environment as an argument so it can be tested and rendered
 * without touching process.env from a client component.
 */

export type PlatformEnv = Record<string, string | undefined>;

export type PlatformProductId = "ai-gateway" | "sandbox" | "workflow" | "blob" | "connect" | "deploy" | "observability";

export interface PlatformProduct {
  id: PlatformProductId;
  name: string;
  /** What EveLab uses it for, in one sentence. */
  role: string;
  configured: boolean;
  /** What EveLab does instead while it is not configured. */
  fallback: string;
  /** The variables that turn it on. */
  env: string[];
  docs: string;
}

export interface SandboxCredentials {
  token?: string;
  teamId?: string;
  projectId?: string;
}

/**
 * Credentials for the Sandbox SDK: a token with team and project for local use,
 * or nothing when the OIDC token is present and the SDK picks it up itself.
 */
export function sandboxCredentials(env: PlatformEnv): SandboxCredentials | undefined {
  if (env.VERCEL_TOKEN && env.VERCEL_TEAM_ID && env.VERCEL_PROJECT_ID) {
    return { token: env.VERCEL_TOKEN, teamId: env.VERCEL_TEAM_ID, projectId: env.VERCEL_PROJECT_ID };
  }
  return env.VERCEL_OIDC_TOKEN ? {} : undefined;
}

export function platformProducts(env: PlatformEnv): PlatformProduct[] {
  const oidc = Boolean(env.VERCEL_OIDC_TOKEN);
  const onVercel = Boolean(env.VERCEL);
  return [
    {
      id: "sandbox",
      name: "Vercel Sandbox",
      role: "Runs each agent's dev server in an isolated microVM, so project code never runs on the EveLab server.",
      configured: Boolean(sandboxCredentials(env)),
      fallback: "Runs eve dev on this machine, which is only allowed when EveLab is a single-user local tool.",
      env: ["VERCEL_OIDC_TOKEN", "or VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID"],
      docs: "https://vercel.com/docs/vercel-sandbox",
    },
    {
      id: "ai-gateway",
      name: "AI Gateway",
      role: "Model calls for your agents and for EveLab's assistant, with one key for every provider.",
      configured: Boolean(env.AI_GATEWAY_API_KEY) || oidc,
      fallback: "The model catalog still loads, but runs and the assistant cannot call a model.",
      env: ["AI_GATEWAY_API_KEY", "or VERCEL_OIDC_TOKEN"],
      docs: "https://vercel.com/docs/ai-gateway",
    },
    {
      id: "workflow",
      name: "Vercel Workflow",
      role: "Deploys and other long tasks run as durable workflows that survive restarts and retry failed steps.",
      configured: onVercel || env.WORKFLOW_TARGET_WORLD === "vercel",
      fallback: "Workflows run on the local world, stored on disk beside the workspace.",
      env: ["Deploy EveLab to Vercel", "or WORKFLOW_TARGET_WORLD=vercel"],
      docs: "https://vercel.com/docs/workflow",
    },
    {
      id: "blob",
      name: "Vercel Blob",
      role: "Private storage for run recordings and deployment logs, and public storage for shared exports.",
      configured: Boolean(env.BLOB_READ_WRITE_TOKEN),
      fallback: "Stored as files beside the workspace.",
      env: ["BLOB_READ_WRITE_TOKEN"],
      docs: "https://vercel.com/docs/vercel-blob",
    },
    {
      id: "connect",
      name: "Vercel Connect",
      role: "Holds OAuth and API credentials for connections and channels, so no secret is written to a project.",
      configured: oidc || Boolean(env.VERCEL_TOKEN),
      fallback: "Connector names are written into files, but EveLab cannot list or create connectors for you.",
      env: ["VERCEL_OIDC_TOKEN", "or VERCEL_TOKEN"],
      docs: "https://vercel.com/kb/guide/vercel-connect",
    },
    {
      id: "deploy",
      name: "Deployments",
      role: "Runs eve deploy, which ships the agent to Vercel with Workflow, Sandbox, Cron and AI Gateway wired up.",
      configured: Boolean(env.VERCEL_TOKEN) || Boolean(env.EVELAB_EVE_BIN),
      fallback: "Deploy from a terminal with eve deploy.",
      env: ["VERCEL_TOKEN"],
      docs: "https://vercel.com/docs/deployments",
    },
    {
      id: "observability",
      name: "Observability",
      role: "Runtime logs, traces and the Agent Runs view for deployed agents, next to EveLab's own run history.",
      configured: onVercel || Boolean(env.VERCEL_TOKEN),
      fallback: "Run history and usage come from runs recorded by EveLab.",
      env: ["VERCEL_TOKEN"],
      docs: "https://vercel.com/docs/observability",
    },
  ];
}
