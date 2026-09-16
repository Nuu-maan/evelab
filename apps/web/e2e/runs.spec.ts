import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Runs against `eve dev`. The suite's EVELAB_EVE_BIN is e2e/fake-eve.mjs, which
 * serves eve's session API and streams events in eve's format, so this covers
 * evelab's process management, proxying, recording and timeline without a model.
 */

const WORKSPACE = process.env.E2E_WORKSPACE ?? "/tmp/evelab-e2e/workspace";
const PROJECT_ID = "runs-agent";
const PROJECT = join(WORKSPACE, PROJECT_ID);

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await rm(PROJECT, { recursive: true, force: true });
  await rm(join(WORKSPACE, "..", "runs", PROJECT_ID), { recursive: true, force: true });
  const files: Record<string, string> = {
    "package.json": `${JSON.stringify({ name: PROJECT_ID, type: "module" })}\n`,
    "agent/agent.ts": `import { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: "openai/gpt-5.6-luna-fast",\n});\n`,
    "agent/instructions.md": "# Identity\n\nHelp.\n",
    "agent/schedules/digest.md": '---\ncron: "0 9 * * 1-5"\n---\n\nSummarize.\n',
  };
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(PROJECT, path)), { recursive: true });
    await writeFile(join(PROJECT, path), content);
  }
});

test("start the dev server, run a message, and read the timeline", async ({ page }) => {
  await page.goto(`/projects/${PROJECT_ID}/runs`);
  await page.getByRole("button", { name: "Start dev server" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ready" })).toBeVisible({ timeout: 30_000 });

  const composer = page.getByLabel("Message");
  await composer.fill("Find the refund policy");
  await composer.press("Control+Enter");

  const timeline = page.getByRole("list", { name: "Run timeline" });
  await expect(timeline.getByText("You asked: Find the refund policy")).toBeVisible();
  await expect(timeline.getByText("search_docs")).toBeVisible();
  await expect(timeline.getByText(/Turn complete.*120 in, 18 out/)).toBeVisible();
  await expect(page).toHaveURL(/session=wrun_/);

  // The run was recorded, so it reads back after a reload.
  await page.reload();
  await expect(page.getByRole("list", { name: "Run timeline" }).getByText("You asked: Find the refund policy")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Run history" }).or(page.getByRole("complementary", { name: "Run history" })).getByText("Find the refund policy")).toBeVisible();
});

test("an approval pauses the run until it is answered", async ({ page }) => {
  await page.goto(`/projects/${PROJECT_ID}/runs`);
  await expect(page.getByRole("status").filter({ hasText: "Ready" })).toBeVisible();
  await page.getByLabel("Message").fill("please approve deleting notes");
  await page.getByRole("button", { name: "Send" }).click();

  const timeline = page.getByRole("list", { name: "Run timeline" });
  await expect(timeline.getByText("Allow delete_file on notes.txt?")).toBeVisible();
  await timeline.getByRole("button", { name: "Approve" }).click();
  await expect(timeline.getByText("Deleted notes.txt.")).toBeVisible();
  await expect(timeline.getByText("Answered: approved")).toBeVisible();
});

test("cancelling stops the turn and keeps what streamed", async ({ page }) => {
  await page.goto(`/projects/${PROJECT_ID}/runs`);
  await page.getByLabel("Message").fill("a slow answer");
  await page.getByRole("button", { name: "Send" }).click();

  const timeline = page.getByRole("list", { name: "Run timeline" });
  await expect(timeline.getByText(/word2/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(timeline.getByText("Cancelled")).toBeVisible();
  await expect(page.getByText("Session waiting")).toBeVisible();
});

test("a schedule runs once from the Schedules page", async ({ page }) => {
  await page.goto(`/projects/${PROJECT_ID}/schedules`);
  await page.getByRole("button", { name: "Run now" }).click();
  await expect(page).toHaveURL(/runs\?session=wrun_/);
  await expect(page.getByRole("list", { name: "Run timeline" }).getByText("You asked: Scheduled run of digest")).toBeVisible();
});

test("observability adds up the recorded runs", async ({ page }) => {
  await page.goto(`/projects/${PROJECT_ID}/observability`);
  const stats = page.getByRole("region", { name: "Last runs at a glance" });
  await expect(stats.getByText("Runs", { exact: true })).toBeVisible();
  // The refund, approval and schedule runs each completed a turn through search_docs or delete_file.
  await expect(page.getByRole("cell", { name: "search_docs" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "openai/gpt-5.6-luna-fast" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Turns per day/ })).toBeVisible();
});

test("stopping the dev server leaves recorded runs readable", async ({ page }) => {
  await page.goto(`/projects/${PROJECT_ID}/runs`);
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByRole("button", { name: "Start dev server" })).toBeVisible();
  await page.getByRole("link", { name: /Find the refund policy/ }).click();
  await expect(page.getByRole("list", { name: "Run timeline" }).getByText("You asked: Find the refund policy")).toBeVisible();
});
