import type { ConnectionAuth, ProjectFile, Reasoning } from "./types";

/**
 * Source for files evelab creates. Each shape is taken from Eve's own
 * documentation or from what `eve init` (eve 0.54.3) writes. Existing files are
 * never regenerated from these: they are always patched in place.
 */

function reasoningLine(reasoning: Reasoning | undefined): string {
  return reasoning && reasoning !== "provider-default" ? `  reasoning: ${JSON.stringify(reasoning)},\n` : "";
}

/** `agent/agent.ts` exactly as `eve init` scaffolds it. */
export function renderAgentConfig(model: string, reasoning?: Reasoning): string {
  return `import { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: ${JSON.stringify(model)},\n${reasoningLine(reasoning)}});\n`;
}

/**
 * How the agent reaches its model, as `eve init` asks it: through AI Gateway
 * (a linked Vercel project or AI_GATEWAY_API_KEY), a ChatGPT subscription, or
 * a provider's own SDK and key.
 */
export type ModelProvider = "ai-gateway-project" | "ai-gateway-key" | "chatgpt" | "anthropic" | "openai";

export const DIRECT_PROVIDERS = {
  anthropic: { package: "@ai-sdk/anthropic", factory: "anthropic", env: "ANTHROPIC_API_KEY", version: "^4.0.0" },
  openai: { package: "@ai-sdk/openai", factory: "openai", env: "OPENAI_API_KEY", version: "^4.0.0" },
} as const;

/** The model id without its gateway prefix: "anthropic/claude-opus-4.8" to "claude-opus-4.8". */
function bareModelId(model: string): string {
  return model.slice(model.indexOf("/") + 1);
}

/** `agent/agent.ts` for a provider. Gateway projects get the plain model string, as `eve init` writes. */
export function renderAgentConfigFor(provider: ModelProvider, model: string, reasoning?: Reasoning): string {
  if (provider === "chatgpt") {
    return `import { defineAgent } from "eve";\nimport { chatgpt } from "eve/models/openai";\n\nexport default defineAgent({\n  model: chatgpt(${JSON.stringify(bareModelId(model))}),\n${reasoningLine(reasoning)}});\n`;
  }
  if (provider === "anthropic" || provider === "openai") {
    const direct = DIRECT_PROVIDERS[provider];
    return `import { ${direct.factory} } from "${direct.package}";\nimport { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: ${direct.factory}(${JSON.stringify(bareModelId(model))}),\n${reasoningLine(reasoning)}});\n`;
  }
  return renderAgentConfig(model, reasoning);
}

/** What `eve init` picks when no model is chosen. */
export const DEFAULT_AGENT_MODEL_ID = "openai/gpt-5.6-luna-fast";

/**
 * A declared subagent's `agent.ts`. Eve's compiler requires both `description`
 * and `model` on a subagent, so a model is always written.
 */
export function renderSubagentConfig(description: string, model: string, reasoning?: Reasoning): string {
  return `import { defineAgent } from "eve";\n\nexport default defineAgent({\n  description: ${JSON.stringify(description)},\n  model: ${JSON.stringify(model)},\n${reasoningLine(reasoning)}});\n`;
}

/** A slot file that uses a shared definition from `lib/`. */
export function renderSharedReexport(specifier: string): string {
  return `export { default } from ${JSON.stringify(specifier)};\n`;
}

/**
 * A skill as a `defineSkill` module, which is how a markdown or packaged skill
 * becomes shareable: a module can be re-exported, a markdown file cannot.
 */
export function renderSkillModule(input: { description: string; markdown: string; files: { path: string; content: string }[] }): string {
  const lines = [
    `import { defineSkill } from "eve/skills";`,
    ``,
    `export default defineSkill({`,
    `  description: ${JSON.stringify(input.description)},`,
    `  markdown: ${JSON.stringify(input.markdown)},`,
  ];
  if (input.files.length > 0) {
    lines.push(`  files: {`);
    for (const file of input.files) lines.push(`    ${JSON.stringify(file.path)}: ${JSON.stringify(file.content)},`);
    lines.push(`  },`);
  }
  lines.push(`});`, ``);
  return lines.join("\n");
}

/** An authored tool, as the Eve tools guide writes one. */
export function renderToolModule(description: string): string {
  return [
    `import { defineTool } from "eve/tools";`,
    `import { z } from "zod";`,
    ``,
    `export default defineTool({`,
    `  description: ${JSON.stringify(description)},`,
    `  inputSchema: z.object({ query: z.string().min(1) }),`,
    `  async execute({ query }) {`,
    `    // Replace with the real implementation. The file is yours from here on.`,
    `    return { query };`,
    `  },`,
    `});`,
    ``,
  ].join("\n");
}

export interface ConnectionTemplateInput {
  kind: "mcp" | "openapi";
  /** MCP endpoint or OpenAPI document URL. */
  url: string;
  description: string;
  auth: Exclude<ConnectionAuth, "custom">;
  /** Vercel Connect connector UID, for `auth: "connect"`. */
  connector?: string;
  /** Environment variable holding a bearer token, for `auth: "token"`. */
  tokenEnv?: string;
  filter?: { mode: "allow" | "block"; names: string[] };
}

/** An MCP or OpenAPI connection, as the Eve connections guides write them. */
export function renderConnectionModule(input: ConnectionTemplateInput): string {
  const factory = input.kind === "mcp" ? "defineMcpClientConnection" : "defineOpenAPIConnection";
  const lines: string[] = [];
  if (input.auth === "connect") lines.push(`import { connect } from "@vercel/connect/eve";`);
  lines.push(`import { ${factory} } from "eve/connections";`, ``, `export default ${factory}({`);
  lines.push(`  ${input.kind === "mcp" ? "url" : "spec"}: ${JSON.stringify(input.url)},`);
  lines.push(`  description: ${JSON.stringify(input.description)},`);
  if (input.auth === "connect" && input.connector) {
    lines.push(`  auth: connect(${JSON.stringify(input.connector)}),`);
  } else if (input.auth === "token" && input.tokenEnv) {
    lines.push(`  auth: { getToken: async () => ({ token: process.env.${input.tokenEnv}! }) },`);
  }
  if (input.filter && input.filter.names.length > 0) {
    const key = input.kind === "mcp" ? "tools" : "operations";
    lines.push(`  ${key}: { ${input.filter.mode}: [${input.filter.names.map((name) => JSON.stringify(name)).join(", ")}] },`);
  }
  lines.push(`});`, ``);
  return lines.join("\n");
}

/** A markdown schedule: `cron` frontmatter and the prompt as the body. */
export function renderScheduleMarkdown(cron: string, prompt: string): string {
  return `---\ncron: ${JSON.stringify(cron)}\n---\n\n${prompt.trim()}\n`;
}

export interface ProjectScaffoldInput {
  /** npm package name, which Eve uses as the agent's name. */
  packageName: string;
  model: string;
  /** Defaults to AI Gateway, which is what `eve init` recommends. */
  provider?: ModelProvider;
  reasoning?: Reasoning;
  instructions?: string;
}

const SCAFFOLD_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node", "eve/workflow-modules"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["agent/**/*.ts", "evals/**/*.ts"]
}
`;

const SCAFFOLD_GITIGNORE = `node_modules
.env*
.eve
.vercel
.next
.output
.nitro
dist
.DS_Store
*.tsbuildinfo
`;

/** What \`eve init\` keeps out of a Vercel upload: dependencies, secrets and build output. */
const SCAFFOLD_VERCELIGNORE = `node_modules
.env*
.eve
.next
.output
.nitro
dist
`;

const SCAFFOLD_EVE_CHANNEL = `import { eveChannel } from "eve/channels/eve";
import { localDev, placeholderAuth, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [
    // Lets the eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
    // Open on localhost for \`eve dev\` and the REPL; ignored in production.
    localDev(),
    // This placeholder will not allow browser requests in production.
    // Replace it with your app's auth provider, like Auth.js or Clerk,
    // or use none() for a public demo.
    placeholderAuth(),
  ],
});
`;

const SCAFFOLD_AGENTS_MD = `# eve Agent App

This project uses the eve framework: an agent is a directory of files under \`agent/\`, and eve compiles and runs it.

For a content-only change to the root agent's identity, purpose, tone, or response guidelines, edit its existing authored instructions. Fresh projects use \`agent/instructions.md\`; a project may instead use \`agent/instructions.ts\` or files under \`agent/instructions/\`. You do not need to read the framework docs for a content-only instructions change. A fresh project already has its selected model in \`agent/agent.ts\`; preserve that file unless the user asks to change the model.

## Read the docs before writing code

\`\`\`sh
ls node_modules/eve/docs
\`\`\`

Start with \`docs/README.md\`: it maps each task to the page that covers it. Read that page before authoring tools, connections, channels, skills, subagents, schedules, or deployment. In a workspace or local package install, resolve the installed \`eve\` package location first. If the package docs are missing, use https://eve.dev/docs.

Use a bounded authoring loop:

1. Read the relevant page and inspect only files you will modify or need to imitate.
2. Stop discovery once the file location, imports, and definition shape are clear. Implement the smallest complete behavior the user requested.
3. Run one narrow verification. Expand investigation only when it fails or the request needs project-specific details.

Follow links or inspect public types only when the routed page leaves the task unanswered. Do not recursively glob \`node_modules\`, enumerate the entire docs tree, or read unrelated scaffold files when the direct path is known. Package-manager links can hide files from recursive glob tools even though direct reads work.

## Prefer an existing integration

When a task names an external product or service, search the registry before implementing its integration. For a generic capability, author a tool instead.

\`\`\`sh
eve registry search <query> --json
eve registry view <item>
\`\`\`

Prefer items whose \`implementation\` is \`native\`; use Chat SDK adapters when no native channel fits. \`registry view\` links the item's documentation.

Install without driving interactive prompts:

\`\`\`sh
eve add <item> --non-interactive
\`\`\`

Exit code 0 means setup completed, 1 failed, and 2 needs an answer or a prerequisite. On exit 2, run the \`next.command\` from the final NDJSON event. For a non-secret question, replace its \`<JSON value>\` answer placeholder with the answer you collected; string values need JSON quotes. Never pass a secret in \`--answer\`. See \`docs/install-integrations.mdx\` for setup prerequisites.

## Use eve for Vercel operations

Use eve to link and deploy Vercel projects:

\`\`\`sh
eve link --non-interactive --project <name-or-id> [--team <team-id-or-slug>]
eve deploy --non-interactive --yes [--project <name-or-id>]
\`\`\`

A setup may report \`eve link\` as a prerequisite; run it, then retry the continuation. When a completed setup event has \`deploymentRequired: true\`, run the \`next\` command it reports.

## Validate the change

Run the validation the task requests. When it does not establish the behavior you changed, run the narrowest relevant check.
`;

/**
 * The files `eve init` writes for a new project, so a project created in
 * evelab is indistinguishable from one created on the command line.
 */
export function renderProjectScaffold(input: ProjectScaffoldInput): ProjectFile[] {
  const packageJson = {
    name: input.packageName,
    version: "0.0.0",
    type: "module",
    imports: { "#*": "./agent/*", "#evals/*": "./evals/*" },
    scripts: {
      build: "eve build",
      deploy: "eve deploy",
      dev: "eve dev",
      eval: "eve eval",
      start: "eve start",
      typecheck: "tsc",
    },
    dependencies: {
      "@vercel/connect": "1.0.0",
      ai: "^7.0.93",
      eve: "^0.55.0",
      zod: "4.5.4",
      ...(input.provider === "anthropic" || input.provider === "openai"
        ? { [DIRECT_PROVIDERS[input.provider].package]: DIRECT_PROVIDERS[input.provider].version }
        : {}),
    },
    devDependencies: { "@types/node": "24.x", typescript: "7.0.2" },
    engines: { node: "24.x" },
  };
  return [
    { path: ".gitignore", content: SCAFFOLD_GITIGNORE },
    { path: ".vercelignore", content: SCAFFOLD_VERCELIGNORE },
    { path: "AGENTS.md", content: SCAFFOLD_AGENTS_MD },
    { path: "CLAUDE.md", content: "@AGENTS.md\n" },
    { path: "agent/agent.ts", content: renderAgentConfigFor(input.provider ?? "ai-gateway-project", input.model, input.reasoning) },
    { path: "agent/channels/eve.ts", content: SCAFFOLD_EVE_CHANNEL },
    { path: "agent/instructions.md", content: input.instructions ?? "# Identity\n\nYou are a helpful assistant.\n" },
    { path: "package.json", content: `${JSON.stringify(packageJson, null, 2)}\n` },
    { path: "tsconfig.json", content: SCAFFOLD_TSCONFIG },
  ];
}

/** Platform channels evelab can write, each in the shape its Eve docs page shows. */
export const CHANNEL_TEMPLATES = {
  slack: { factory: "slackChannel", connect: "connectSlackCredentials", connectOptional: true },
  discord: { factory: "discordChannel", connect: "connectDiscordCredentials", connectOptional: false },
  linear: { factory: "linearChannel", connect: "connectLinearCredentials", connectOptional: false },
  github: { factory: "githubChannel", connect: "connectGitHubCredentials", connectOptional: false },
  linq: { factory: "linqChannel", connect: "connectLinqCredentials", connectOptional: false },
  photon: { factory: "photonIMessageChannel", connect: "connectPhotonCredentials", connectOptional: false },
  teams: { factory: "teamsChannel", connect: undefined, connectOptional: true },
  telegram: { factory: "telegramChannel", connect: undefined, connectOptional: true },
  mcp: { factory: "mcpChannel", connect: undefined, connectOptional: true },
  twilio: { factory: "twilioChannel", connect: undefined, connectOptional: true },
} as const;

export type ChannelTemplateKind = keyof typeof CHANNEL_TEMPLATES;

export interface ChannelTemplateInput {
  kind: ChannelTemplateKind;
  /** Vercel Connect connector UID, such as "slack/my-agent". */
  connector?: string;
  /** GitHub App bot name the channel answers to. */
  botName?: string;
  /** Telegram bot username. */
  botUsername?: string;
  /** Twilio: the phone number allowed to reach the inbound hooks. Eve requires it. */
  allowFrom?: string;
  /** Twilio: the number outbound SMS is sent from. */
  fromNumber?: string;
}

export function renderChannelModule(input: ChannelTemplateInput): string {
  const template = CHANNEL_TEMPLATES[input.kind];
  const connector = template.connect ? input.connector : undefined;
  if (template.connect && !template.connectOptional && !connector) {
    throw new Error(`A ${input.kind} channel needs a Vercel Connect connector.`);
  }

  const imports: string[] = [];
  if (connector && template.connect) imports.push(`import { ${template.connect} } from "@vercel/connect/eve";`);
  if (input.kind === "mcp") imports.push(`import { localDev } from "eve/channels/auth";`);
  imports.push(`import { ${template.factory} } from "eve/channels/${input.kind}";`);

  const options: string[] = [];
  if (input.kind === "github") options.push(`  botName: ${JSON.stringify(input.botName ?? "")},`);
  if (input.kind === "telegram") options.push(`  botUsername: ${JSON.stringify(input.botUsername ?? "")},`);
  if (input.kind === "mcp") options.push(`  auth: localDev(),`);
  if (input.kind === "twilio") {
    if (!input.allowFrom) throw new Error("A Twilio channel needs the number allowed to reach it.");
    options.push(`  allowFrom: ${JSON.stringify(input.allowFrom)},`);
    if (input.fromNumber) options.push(`  messaging: { from: ${JSON.stringify(input.fromNumber)} },`);
  }
  if (connector && template.connect) options.push(`  credentials: ${template.connect}(${JSON.stringify(connector)}),`);

  const call = options.length > 0 ? `${template.factory}({\n${options.join("\n")}\n})` : `${template.factory}()`;
  return `${imports.join("\n")}\n\nexport default ${call};\n`;
}

/**
 * Chat SDK adapters for services eve has no first-class channel for. Each reads
 * its credentials from the environment variables listed, so nothing secret is
 * written into the channel file.
 */
export const CHAT_SDK_ADAPTERS = {
  slack: {
    label: "Slack",
    package: "@chat-adapter/slack",
    factory: "createSlackAdapter",
    env: ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"],
  },
  discord: {
    label: "Discord",
    package: "@chat-adapter/discord",
    factory: "createDiscordAdapter",
    env: ["DISCORD_BOT_TOKEN", "DISCORD_PUBLIC_KEY", "DISCORD_APPLICATION_ID"],
  },
  teams: {
    label: "Microsoft Teams",
    package: "@chat-adapter/teams",
    factory: "createTeamsAdapter",
    env: ["TEAMS_APP_ID", "TEAMS_APP_PASSWORD", "TEAMS_APP_TENANT_ID"],
  },
  github: {
    label: "GitHub",
    package: "@chat-adapter/github",
    factory: "createGitHubAdapter",
    env: ["GITHUB_TOKEN", "GITHUB_WEBHOOK_SECRET"],
  },
  linear: {
    label: "Linear",
    package: "@chat-adapter/linear",
    factory: "createLinearAdapter",
    env: ["LINEAR_API_KEY", "LINEAR_WEBHOOK_SECRET"],
  },
  whatsapp: {
    label: "WhatsApp",
    package: "@chat-adapter/whatsapp",
    factory: "createWhatsAppAdapter",
    env: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN"],
  },
  gchat: {
    label: "Google Chat",
    package: "@chat-adapter/gchat",
    factory: "createGoogleChatAdapter",
    env: ["GOOGLE_CHAT_CREDENTIALS"],
  },
  telegram: {
    label: "Telegram",
    package: "@chat-adapter/telegram",
    factory: "createTelegramAdapter",
    env: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET_TOKEN"],
  },
} as const;

/** Where a Chat SDK channel keeps thread subscriptions and dedupe state. */
export const CHAT_SDK_STATES = {
  memory: { label: "In memory (development)", package: "@chat-adapter/state-memory", factory: "createMemoryState", env: [] },
  redis: { label: "Redis (production)", package: "@chat-adapter/state-redis", factory: "createRedisState", env: ["REDIS_URL"] },
} as const;

export type ChatSdkAdapter = keyof typeof CHAT_SDK_ADAPTERS;
export type ChatSdkState = keyof typeof CHAT_SDK_STATES;

export const CHAT_SDK_VERSION = "^4.40.0";

/** The npm packages a Chat SDK channel imports, for the project's package.json. */
export function chatSdkDependencies(adapter: ChatSdkAdapter, state: ChatSdkState): Record<string, string> {
  return {
    chat: CHAT_SDK_VERSION,
    [CHAT_SDK_ADAPTERS[adapter].package]: CHAT_SDK_VERSION,
    [CHAT_SDK_STATES[state].package]: CHAT_SDK_VERSION,
  };
}

/** A Chat SDK channel in the shape Eve's chat-sdk channel docs write it. */
export function renderChatSdkChannelModule(input: { adapter: ChatSdkAdapter; state: ChatSdkState; userName: string }): string {
  const adapter = CHAT_SDK_ADAPTERS[input.adapter];
  const state = CHAT_SDK_STATES[input.state];
  return [
    `import { ${adapter.factory} } from "${adapter.package}";`,
    `import { ${state.factory} } from "${state.package}";`,
    `import type { Message, Thread } from "chat";`,
    `import { chatSdkChannel } from "eve/channels/chat-sdk";`,
    ``,
    `export const { bot, channel, send } = chatSdkChannel({`,
    `  userName: ${JSON.stringify(input.userName)},`,
    `  adapters: {`,
    `    ${input.adapter}: ${adapter.factory}(),`,
    `  },`,
    `  state: ${state.factory}(),`,
    `});`,
    ``,
    `bot.onNewMention(async (thread: Thread, message: Message) => {`,
    `  await thread.subscribe();`,
    `  await send(message.text, { thread });`,
    `});`,
    ``,
    `bot.onDirectMessage(async (thread: Thread, message: Message) => {`,
    `  await thread.subscribe();`,
    `  await send(message.text, { thread });`,
    `});`,
    ``,
    `bot.onSubscribedMessage(async (thread: Thread, message: Message) => {`,
    `  await send(message.text, { thread });`,
    `});`,
    ``,
    `export default channel;`,
    ``,
  ].join("\n");
}

/**
 * Adds dependencies to a package.json without dropping anything else in it.
 * Versions already present are kept: the project's own pin wins.
 */
export function addPackageDependencies(packageJson: string, dependencies: Record<string, string>): string {
  const parsed = JSON.parse(packageJson) as Record<string, unknown> & { dependencies?: Record<string, string> };
  const current = parsed.dependencies ?? {};
  const merged: Record<string, string> = { ...current };
  for (const [name, version] of Object.entries(dependencies)) merged[name] ??= version;
  parsed.dependencies = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify(parsed, null, 2)}\n`;
}
