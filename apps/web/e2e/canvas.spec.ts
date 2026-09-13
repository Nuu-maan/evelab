import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

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
  await rm(join(WORKSPACE, "..", "layouts"), { recursive: true, force: true });
  await mkdir(join(PROJECT, "subagents"), { recursive: true });
  await mkdir(join(PROJECT, "skills", "notes"), { recursive: true });
  await writeFile(join(PROJECT, "agent.ts"), AGENT_TS);
  await writeFile(join(PROJECT, "instructions.md"), "# Demo Agent\n\nBe useful.\n");
  await writeFile(
    join(PROJECT, "subagents", "researcher.md"),
    "---\nname: Researcher\ndescription: Gathers sources.\n---\n\nCollect three sources.\n",
  );
  await writeFile(
    join(PROJECT, "skills", "notes", "SKILL.md"),
    "---\nname: Notes\ndescription: Keeps notes while working.\n---\n\nWrite things down.\n",
  );
});

const researcherFile = () => readFile(join(PROJECT, "subagents", "researcher.md"), "utf8");

/** Drags from one point to another in small steps, the way React Flow expects a pointer to move. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 16 });
  await page.mouse.up();
}

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

test("the canvas shows every capability and the file behind it", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  await expect(page.getByTestId("rf__node-agent")).toContainText("Demo Agent");
  await expect(page.getByTestId("rf__node-subagent:researcher")).toContainText("Researcher");
  await expect(page.getByText("subagents/researcher.md")).toBeVisible();
  await expect(page.getByTestId("rf__node-skill:notes")).toContainText("skills/notes/SKILL.md");
});

test("the zoom controls are visible and work", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");
  const controls = page.getByRole("toolbar", { name: "Canvas view" });
  const zoom = controls.getByRole("button", { name: /Reset zoom/ });
  await expect(page.getByTestId("rf__node-agent")).toBeVisible();
  const before = await zoom.textContent();
  // The initial fitView can land after an early click and reset the zoom, so retry the click.
  await expect(async () => {
    await controls.getByRole("button", { name: "Zoom in" }).click();
    await expect(zoom).not.toHaveText(before ?? "", { timeout: 1000 });
  }).toPass();
});

test("selecting a node opens its file in the inspector and saves edits", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  await page.getByTestId("rf__node-subagent:researcher").click();

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

  const onDisk = await researcherFile();
  expect(onDisk).toContain("Prefer primary sources.");
  // The rest of the file, including its frontmatter, is untouched.
  expect(onDisk).toContain("name: Researcher");

  await inspector.getByRole("button", { name: "Close" }).click();
  await expect(inspector).toBeHidden();
});

test("dragging an edge hands a skill to a subagent, and dropping it hands it back", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  const edge = page.getByTestId("rf__edge-agent->skill:notes");
  await expect(edge).toBeVisible();

  // The source end sits on the agent's handle; grab the edge just below it.
  const agentHandle = page.getByTestId("rf__node-agent").locator(".react-flow__handle.source");
  const start = await center(agentHandle);
  const researcherHandle = page
    .getByTestId("rf__node-subagent:researcher")
    .locator(".react-flow__handle.source");
  await drag(page, { x: start.x, y: start.y + 9 }, await center(researcherHandle));

  await expect.poll(researcherFile).toContain("skills: [notes]");
  await expect(page.getByTestId("rf__edge-subagent:researcher->skill:notes")).toBeVisible();

  // Drop the same end on empty canvas: the subagent lets go.
  const owned = await center(researcherHandle);
  const pane = await page.locator(".react-flow__pane").boundingBox();
  await drag(page, { x: owned.x, y: owned.y + 9 }, { x: pane!.x + 40, y: pane!.y + 40 });

  await expect.poll(researcherFile).not.toContain("skills:");
  await expect(page.getByTestId("rf__edge-agent->skill:notes")).toBeVisible();
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

/**
 * A node's position in flow coordinates, read from React Flow's transform.
 * Screen positions are useless here: fitView re-centres the graph on reload.
 */
async function flowX(page: Page, id: string): Promise<number> {
  const transform = await page
    .getByTestId(`rf__node-${id}`)
    .evaluate((element) => (element as HTMLElement).style.transform);
  const match = /translate\((-?[\d.]+)px/.exec(transform);
  expect(match).not.toBeNull();
  return Number(match![1]);
}

test("node positions survive a reload", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  const before = await flowX(page, "subagent:researcher");
  const box = await page.getByTestId("rf__node-subagent:researcher").boundingBox();
  expect(box).not.toBeNull();

  const from = { x: box!.x + box!.width / 2, y: box!.y + 30 };
  await drag(page, from, { x: from.x + 160, y: from.y + 60 });

  // The layout save is debounced.
  await page.waitForTimeout(1200);
  await page.reload();

  // 160 screen pixels is at least 160 flow units at any zoom up to 100%.
  expect(await flowX(page, "subagent:researcher")).toBeGreaterThan(before + 100);
});

test("the explorer opens nested files and supports the keyboard", async ({ page }) => {
  await page.goto("/projects/demo-agent/files?path=agent.ts");

  const tree = page.getByRole("tree", { name: "Project files" });
  await tree.getByRole("treeitem", { name: "subagents" }).click();
  await tree.getByRole("treeitem", { name: "researcher.md" }).click();
  await expect(page.getByRole("navigation", { name: "File path" })).toContainText("researcher.md");
  await expect(page).toHaveURL(/path=subagents%2Fresearcher\.md/);

  await tree.getByRole("treeitem", { name: "researcher.md" }).press("ArrowLeft");
  await expect(tree.getByRole("treeitem", { name: "subagents" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tree.getByRole("treeitem", { name: "subagents" })).toHaveAttribute("aria-expanded", "false");
});

test("resized panes keep their width after a reload", async ({ page }) => {
  await page.goto("/projects/demo-agent/files");

  const pane = page.getByRole("complementary", { name: "Explorer" });
  const before = (await pane.boundingBox())!.width;
  const handle = page.getByRole("separator", { name: "Resize file explorer" });
  const start = await center(handle);
  await drag(page, start, { x: start.x + 120, y: start.y });

  await expect.poll(async () => (await pane.boundingBox())!.width).toBeGreaterThan(before + 100);
  await page.reload();
  expect((await page.getByRole("complementary", { name: "Explorer" }).boundingBox())!.width).toBeGreaterThan(
    before + 100,
  );
});

test("the sidebar switches projects and opens the command palette", async ({ page }) => {
  await page.goto("/projects/demo-agent");

  await page.getByRole("button", { name: /Demo Agent/ }).click();
  const menu = page.getByRole("menu", { name: "Switch project" });
  await expect(menu.getByRole("menuitem", { name: "All projects" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await page.getByRole("button", { name: /Find/ }).click();
  const palette = page.getByRole("dialog", { name: "Commands" });
  await expect(palette).toBeVisible();
  await page.keyboard.insertText("files");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/files/);
});
