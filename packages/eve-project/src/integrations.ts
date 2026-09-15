/**
 * Extensions and memory providers from eve's integration registry, in the
 * shape `eve add <id>` writes them. Each entry was checked against its page on
 * eve.dev/integrations; add one only after doing the same.
 *
 * Credentials are read from the environment variables listed, so nothing
 * secret is ever written into the project.
 */

export type IntegrationSlot = "extensions" | "memory";

export interface CatalogIntegration {
  /** The registry id `eve add` takes. */
  id: string;
  slot: IntegrationSlot;
  name: string;
  summary: string;
  /** File stem under the slot directory. For an extension it is also the tool namespace. */
  file: string;
  /** npm packages the file imports, added to package.json. */
  packages: Readonly<Record<string, string>>;
  env: readonly string[];
  source: string;
}

const memoryModule = (imports: string[], description: string, provider: string) =>
  [
    ...imports,
    `import { defineMemory } from "eve/memory";`,
    `import { byPrincipal } from "eve/memory/scope";`,
    ``,
    `export default defineMemory({`,
    `  description: ${JSON.stringify(description)},`,
    `  provider: ${provider},`,
    `  scope: byPrincipal,`,
    `});`,
    ``,
  ].join("\n");

export const INTEGRATION_CATALOG: readonly CatalogIntegration[] = [
  {
    id: "extension/agent-browser",
    slot: "extensions",
    name: "agent-browser",
    summary: "Browser automation tools: navigate, snapshot, click, fill and screenshot.",
    file: "browser",
    packages: { "@agent-browser/eve": "^0.37.1" },
    env: [],
    source: `import browser from "@agent-browser/eve";\n\nexport default browser({});\n`,
  },
  {
    id: "extension/browserbase",
    slot: "extensions",
    name: "Browserbase",
    summary: "Search, fetch and automate the web in Browserbase cloud browsers.",
    file: "browserbase",
    packages: { "@browserbasehq/eve": "^0.1.0" },
    env: ["BROWSERBASE_API_KEY"],
    source: `import browserbase from "@browserbasehq/eve";\n\nexport default browserbase({\n  apiKey: process.env.BROWSERBASE_API_KEY!,\n});\n`,
  },
  {
    id: "extension/kernel",
    slot: "extensions",
    name: "KERNEL",
    summary: "Let the agent use the internet through KERNEL browser infrastructure.",
    file: "kernel",
    packages: { "@onkernel/eve-extension": "^0.1.4" },
    env: ["KERNEL_API_KEY"],
    source: `export { default } from "@onkernel/eve-extension";\n`,
  },
  {
    id: "memory/file",
    slot: "memory",
    name: "File memory",
    summary: "Durable per-user memory as files, kept in Vercel Blob once deployed.",
    file: "file",
    packages: {},
    env: ["BLOB_READ_WRITE_TOKEN"],
    source: memoryModule(
      [`import { fileMemory } from "eve/memory/file";`],
      "Remember stable facts and preferences about the caller.",
      "fileMemory()",
    ),
  },
  {
    id: "memory/supermemory",
    slot: "memory",
    name: "Supermemory",
    summary: "Long-term memory, user profiles and retrieval through Supermemory.",
    file: "supermemory",
    packages: { "@supermemory/eve": "^0.1.1" },
    env: ["SUPERMEMORY_API_KEY"],
    source: memoryModule(
      [`import supermemory from "@supermemory/eve";`],
      "Recall and manage durable context for the current user.",
      "supermemory({\n    apiKey: process.env.SUPERMEMORY_API_KEY!,\n  })",
    ),
  },
  {
    id: "memory/upstash-agentkit",
    slot: "memory",
    name: "Upstash AgentKit",
    summary: "Ranked recall on Upstash Redis.",
    file: "upstash-agentkit",
    packages: { "@upstash/agentkit-eve": "^0.9.0", "@upstash/redis": "^1.38.4" },
    env: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    source: memoryModule(
      [`import { redisMemory } from "@upstash/agentkit-eve/memory";`],
      "Recall and manage durable context for the current user.",
      "redisMemory({ topK: 5 })",
    ),
  },
];

export function findIntegration(id: string): CatalogIntegration | undefined {
  return INTEGRATION_CATALOG.find((integration) => integration.id === id);
}

/** Where an integration's file lives, relative to the agent root. */
export function integrationPath(integration: CatalogIntegration): string {
  return `${integration.slot}/${integration.file}.ts`;
}
