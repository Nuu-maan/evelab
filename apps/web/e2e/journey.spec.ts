import { access, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * The launch sequence on one agent: create, build on the canvas, run, deploy,
 * and open the generated Eve project. eve itself is the suite's stand-in binary.
 */

const WORKSPACE = process.env.E2E_WORKSPACE ?? "/tmp/evelab-e2e/workspace";
const PROJECT_ID = "journey-agent";
const PROJECT = join(WORKSPACE, PROJECT_ID);

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

test.beforeAll(async () => {
  await rm(PROJECT, { recursive: true, force: true });
  await rm(join(WORKSPACE, "..", "runs", PROJECT_ID), { recursive: true, force: true });
  await rm(join(WORKSPACE, "..", "deployments", `${PROJECT_ID}.json`), { force: true });
});

test("create, build, run, deploy and open the project", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/projects/new");
  await page.getByLabel("Name").fill("Journey Agent");
  await page.getByLabel("Description").fill("Answers questions about the docs.");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}$`));

  // The project on disk is what eve init writes.
  for (const path of ["package.json", "tsconfig.json", "agent/agent.ts", "agent/instructions.md", "agent/channels/eve.ts"]) {
    expect(await exists(join(PROJECT, path))).toBe(true);
  }
  expect(await readFile(join(PROJECT, "agent", "agent.ts"), "utf8")).toContain('description: "Answers questions about the docs."');

  // Build on the canvas.
  await page.goto(`/projects/${PROJECT_ID}/canvas`);
  await page.getByRole("button", { name: /TypeScript tool/ }).click();
  const panel = page.getByRole("complementary", { name: "New tool" });
  await panel.getByLabel("Tool name").fill("search_docs");
  await panel.getByLabel("Description").fill("Search the docs.");
  await panel.getByRole("button", { name: "Create tool" }).click();
  await expect(page.getByTestId("rf__node-tool:search_docs")).toBeVisible();

  // Run it.
  await page.goto(`/projects/${PROJECT_ID}/runs`);
  await page.getByRole("button", { name: "Start dev server" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ready" })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Message").fill("How do I reset my password?");
  await page.getByLabel("Message").press("Control+Enter");
  const timeline = page.getByRole("list", { name: "Run timeline" });
  await expect(timeline.getByText("You asked: How do I reset my password?")).toBeVisible();
  await expect(timeline.getByText(/Turn complete/)).toBeVisible();
  await page.getByRole("button", { name: "Stop" }).click();

  // Deploy it.
  await page.goto(`/projects/${PROJECT_ID}/deployments`);
  await page.getByRole("button", { name: "Deploy to production" }).click();
  await expect(page.getByRole("list", { name: "Deployments" }).getByText("Ready")).toBeVisible({ timeout: 30_000 });

  // Open the generated project with quick open.
  await page.keyboard.press("Control+p");
  const quickOpen = page.getByRole("dialog", { name: "Open file" });
  await expect(quickOpen).toBeVisible();
  await page.keyboard.insertText("search_docs");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/path=agent%2Ftools%2Fsearch_docs\.ts/);
  await expect(page.getByText('import { defineTool } from "eve/tools";')).toBeVisible({ timeout: 20_000 });
});
