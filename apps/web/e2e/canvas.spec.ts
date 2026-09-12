import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const WORKSPACE = process.env.E2E_WORKSPACE ?? "/tmp/evelab-e2e/workspace";
const PROJECT = join(WORKSPACE, "demo-agent");

const AGENT_TS = `import { Agent } from "eve";

export default new Agent({
  name: "Demo Agent",
  description: "A project fixture for the end to end suite.",
  model: "openai/gpt-5.6",
  instructions: "instructions.md",
});
`;

test.beforeAll(async () => {
  await rm(PROJECT, { recursive: true, force: true });
  await mkdir(join(PROJECT, "subagents"), { recursive: true });
  await writeFile(join(PROJECT, "agent.ts"), AGENT_TS);
  await writeFile(join(PROJECT, "instructions.md"), "# Demo Agent\n\nBe useful.\n");
  await writeFile(
    join(PROJECT, "subagents", "researcher.md"),
    "---\nname: Researcher\ndescription: Gathers sources.\n---\n\nCollect three sources.\n",
  );
});

test("the canvas shows every capability and the file behind it", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  await expect(page.getByText("Demo Agent", { exact: true })).toBeVisible();
  await expect(page.getByText("Researcher", { exact: true })).toBeVisible();
  await expect(page.getByText("subagents/researcher.md")).toBeVisible();
});

test("selecting a node opens its file in the inspector and saves edits", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  await page.getByText("Researcher", { exact: true }).click();

  const inspector = page.getByRole("complementary", { name: /Researcher inspector/ });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByText("subagents/researcher.md")).toBeVisible();
  await expect(inspector.getByText("Collect three sources.")).toBeVisible();

  // insertText rather than type: Monaco drops characters from fast key events.
  await inspector.getByText("Collect three sources.").click();
  await page.keyboard.press("End");
  await page.keyboard.insertText(" Prefer primary sources.");

  await expect(inspector.getByRole("status")).toHaveText("Unsaved changes");
  await inspector.getByRole("button", { name: "Save", exact: true }).click();
  await expect(inspector.getByRole("status")).toHaveText("Saved");

  const onDisk = await readFile(join(PROJECT, "subagents", "researcher.md"), "utf8");
  expect(onDisk).toContain("Prefer primary sources.");
  // The rest of the file, including its frontmatter, is untouched.
  expect(onDisk).toContain("name: Researcher");
});

test("adding a tool from the palette writes a real file", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  await page.getByRole("button", { name: /TypeScript tool/ }).click();

  const panel = page.getByRole("complementary", { name: "New tool" });
  await expect(panel).toBeVisible();
  await panel.getByLabel("Tool name").fill("search-docs");
  await panel.getByLabel("Description").fill("Searches the docs index.");
  await panel.getByRole("button", { name: "Create tool" }).click();

  await expect(page.getByText("tools/search-docs.ts")).toBeVisible();

  const source = await readFile(join(PROJECT, "tools", "search-docs.ts"), "utf8");
  expect(source).toContain('name: "search-docs"');
  expect(source).toContain("Searches the docs index.");
});

test("node positions survive a reload", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  const node = page.getByText("Researcher", { exact: true });
  const before = await node.boundingBox();
  expect(before).not.toBeNull();

  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
  await page.mouse.down();
  await page.mouse.move(before!.x + before!.width / 2 + 160, before!.y + before!.height / 2 + 60, {
    steps: 12,
  });
  await page.mouse.up();

  // The layout save is debounced.
  await page.waitForTimeout(1200);
  await page.reload();

  const after = await page.getByText("Researcher", { exact: true }).boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.x - before!.x)).toBeGreaterThan(40);
});
