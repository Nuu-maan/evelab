import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";

/** Connections, channels and schedules write the files Eve's docs describe. */

const WORKSPACE = process.env.E2E_WORKSPACE ?? "/tmp/evelab-e2e/workspace";
const PROJECT = join(WORKSPACE, "integrations-agent");

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

test.beforeAll(async () => {
  await rm(PROJECT, { recursive: true, force: true });
  const files: Record<string, string> = {
    "package.json": `${JSON.stringify({ name: "integrations-agent", type: "module" })}\n`,
    "agent/agent.ts": `import { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: "openai/gpt-5.6-luna-fast",\n});\n`,
    "agent/instructions.md": "# Identity\n\nHelp.\n",
  };
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(PROJECT, path)), { recursive: true });
    await writeFile(join(PROJECT, path), content);
  }
});

test.describe.configure({ mode: "serial" });

test("a connection with a token from the environment", async ({ page }) => {
  await page.goto("/projects/integrations-agent/connections");
  await page.getByLabel("Connection name").fill("petstore");
  await page.getByLabel("Protocol").click();
  await page.getByRole("option", { name: "OpenAPI document" }).click();
  await page.getByLabel("URL").fill("https://petstore3.swagger.io/api/v3/openapi.json");
  await page.getByLabel("Authentication").click();
  await page.getByRole("option", { name: "Token from an environment variable" }).click();
  await page.getByLabel("Environment variable").fill("PETSTORE_TOKEN");
  await page.getByRole("button", { name: "Create connection" }).click();

  await expect(page.getByText("OpenAPI", { exact: true })).toBeVisible();
  const source = await readFile(join(PROJECT, "agent", "connections", "petstore.ts"), "utf8");
  expect(source).toContain('import { defineOpenAPIConnection } from "eve/connections";');
  expect(source).toContain("process.env.PETSTORE_TOKEN");
});

test("a Slack channel through Vercel Connect", async ({ page }) => {
  await page.goto("/projects/integrations-agent/channels");
  await expect(page.getByText("The default HTTP session API")).toBeVisible();
  await page.getByLabel("Platform").click();
  // Slack is offered twice, as a Chat SDK adapter and as eve's native channel; the native group comes last.
  await page.getByRole("option", { name: "Slack", exact: true }).last().click();
  await page.getByLabel("Vercel Connect connector").fill("slack/integrations-agent");
  await page.getByRole("button", { name: "Add Slack" }).click();

  await expect(page.getByText("Webhook route /eve/v1/slack")).toBeVisible();
  const source = await readFile(join(PROJECT, "agent", "channels", "slack.ts"), "utf8");
  expect(source).toContain('credentials: connectSlackCredentials("slack/integrations-agent"),');
});

test("an extension from the integrations catalog", async ({ page }) => {
  await page.goto("/projects/integrations-agent/integrations");
  await page.getByRole("button", { name: "Add Browserbase" }).click();

  await expect.poll(() => exists(join(PROJECT, "agent", "extensions", "browserbase.ts"))).toBe(true);
  const source = await readFile(join(PROJECT, "agent", "extensions", "browserbase.ts"), "utf8");
  expect(source).toContain('import browserbase from "@browserbasehq/eve";');
  const packageJson = JSON.parse(await readFile(join(PROJECT, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
  expect(packageJson.dependencies?.["@browserbasehq/eve"]).toBe("^0.1.0");
});

test("a Twilio channel set up from the integrations catalog", async ({ page }) => {
  await page.goto("/projects/integrations-agent/integrations");
  await page.getByRole("link", { name: "Set up Twilio" }).click();
  await page.getByLabel("Allowed caller").fill("+15551234567");
  await page.getByRole("button", { name: "Add Twilio (SMS and voice)" }).click();

  await expect(page.getByText("Webhook route /eve/v1/twilio")).toBeVisible();
  const source = await readFile(join(PROJECT, "agent", "channels", "twilio.ts"), "utf8");
  expect(source).toContain('allowFrom: "+15551234567",');
});

test("a schedule is a markdown file with a cron", async ({ page }) => {
  await page.goto("/projects/integrations-agent/schedules");
  await page.getByLabel("Name").fill("digest");
  await page.getByLabel("Cron").fill("0 9 * * 1-5");
  await page.getByLabel("Prompt").fill("Summarize new tickets.");
  await page.getByRole("button", { name: "Add schedule" }).click();

  // The cron presets list holds the same words in a hidden option, so read the card.
  await expect(page.locator('[data-slot="card-description"]', { hasText: "Weekdays at 09:00 UTC" })).toBeVisible();
  const path = join(PROJECT, "agent", "schedules", "digest.md");
  expect(await readFile(path, "utf8")).toBe('---\ncron: "0 9 * * 1-5"\n---\n\nSummarize new tickets.\n');

  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
  await expect.poll(() => exists(path)).toBe(false);
});
