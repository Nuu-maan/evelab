import { describe, expect, it } from "vitest";
import { scanRequiredEnv } from "../src/lib/env-scan";

describe("scanRequiredEnv", () => {
  it("knows what a Chat SDK channel reads from the environment", () => {
    const result = scanRequiredEnv([
      { path: "agent/channels/telegram.ts", content: "adapters: { telegram: createTelegramAdapter() },\n  state: createRedisState()," },
    ]);
    expect(result.map((entry) => entry.name)).toEqual(["REDIS_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET_TOKEN"]);
  });

  it("lists what the source reads, with the files that read it", () => {
    const result = scanRequiredEnv([
      { path: "agent/connections/petstore.ts", content: "auth: { getToken: async () => ({ token: process.env.PETSTORE_TOKEN! }) }" },
      { path: "agent/tools/lookup.ts", content: 'const key = process.env["PETSTORE_TOKEN"]; const env = process.env.NODE_ENV;' },
      { path: "agent/channels/slack.ts", content: "export default slackChannel();" },
      { path: "README.md", content: "process.env.NOT_CODE" },
    ]);
    expect(result).toEqual([
      { name: "PETSTORE_TOKEN", files: ["agent/connections/petstore.ts", "agent/tools/lookup.ts"] },
      { name: "SLACK_BOT_TOKEN", files: ["agent/channels/slack.ts"] },
      { name: "SLACK_SIGNING_SECRET", files: ["agent/channels/slack.ts"] },
    ]);
  });
});
