import { CHAT_SDK_ADAPTERS, CHAT_SDK_STATES, type ProjectFile } from "@evelab/eve-project";

/**
 * Environment variables a project's source reads, so the Deployments page can
 * say what the Vercel project needs before a deploy fails at run time. Only
 * names are collected; values never pass through EveLab.
 */

const READ = /process\.env\.([A-Z_][A-Z0-9_]*)|process\.env\[\s*["']([A-Z_][A-Z0-9_]*)["']\s*\]/g;

/** Set by Vercel or eve on every deployment, so never something to ask for. */
const PROVIDED = new Set(["NODE_ENV", "VERCEL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_OIDC_TOKEN", "PORT", "CI"]);

/** Read by eve itself when a channel is written without explicit credentials. */
const CHANNEL_DEFAULTS: Record<string, { pattern: RegExp; names: readonly string[] }> = {
  slack: { pattern: /slackChannel\(\s*\)/, names: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"] },
  // Chat SDK adapters and state stores called without options read their credentials from the environment.
  ...Object.fromEntries(
    [...Object.values(CHAT_SDK_ADAPTERS), ...Object.values(CHAT_SDK_STATES)].map((entry) => [
      entry.factory,
      { pattern: new RegExp(`${entry.factory}\\(\\s*\\)`), names: entry.env },
    ]),
  ),
};

export interface RequiredEnv {
  name: string;
  files: string[];
}

export function scanRequiredEnv(files: ProjectFile[]): RequiredEnv[] {
  const found = new Map<string, Set<string>>();
  const note = (name: string, path: string) => {
    if (PROVIDED.has(name)) return;
    const paths = found.get(name) ?? new Set<string>();
    paths.add(path);
    found.set(name, paths);
  };

  for (const file of files) {
    if (!/\.(m?[jt]sx?|cjs)$/.test(file.path) || file.path.split("/").includes("node_modules")) continue;
    for (const match of file.content.matchAll(READ)) note(match[1] ?? match[2]!, file.path);
    for (const { pattern, names } of Object.values(CHANNEL_DEFAULTS)) {
      if (pattern.test(file.content)) for (const name of names) note(name, file.path);
    }
  }

  return [...found.entries()]
    .map(([name, paths]) => ({ name, files: [...paths].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
