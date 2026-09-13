import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const WORKSPACE = process.env.E2E_WORKSPACE ?? "/tmp/evelab-e2e/workspace";
const PROJECT = join(WORKSPACE, "demo-agent");

/** A project in Eve's recommended layout, as `eve init` and hand edits leave it. */
const FILES: Record<string, string> = {
  "package.json": `${JSON.stringify({ name: "demo-agent", type: "module" }, null, 2)}\n`,
  "agent/agent.ts": `import { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: "openai/gpt-5.6-luna-fast",\n  description: "A project fixture for the end to end suite.",\n});\n`,
  "agent/instructions.md": "# Identity\n\nBe useful.\n",
  "agent/subagents/researcher/agent.ts": `import { defineAgent } from "eve";\n\nexport default defineAgent({\n  description: "Gathers sources.",\n});\n`,
  "agent/subagents/researcher/instructions.md": "Collect three sources.\n",
  "agent/skills/notes/SKILL.md": "---\nname: notes\ndescription: Keeps notes while working.\n---\n\nWrite things down.\n",
};

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

test.beforeAll(async () => {
  await rm(PROJECT, { recursive: true, force: true });
  await rm(join(WORKSPACE, "..", "layouts"), { recursive: true, force: true });
  for (const [path, content] of Object.entries(FILES)) {
    await mkdir(dirname(join(PROJECT, path)), { recursive: true });
    await writeFile(join(PROJECT, path), content);
  }
});

const rootSkill = join(PROJECT, "agent", "skills", "notes", "SKILL.md");
const researcherSkill = join(PROJECT, "agent", "subagents", "researcher", "skills", "notes", "SKILL.md");

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

  await expect(page.getByTestId("rf__node-agent")).toContainText("demo-agent");
  await expect(page.getByTestId("rf__node-subagent:researcher")).toContainText("researcher");
  await expect(page.getByText("agent/subagents/researcher/agent.ts")).toBeVisible();
  await expect(page.getByTestId("rf__node-skill:notes")).toContainText("agent/skills/notes/SKILL.md");
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

  await page.getByTestId("rf__node-skill:notes").click();

  const inspector = page.getByRole("complementary", { name: /notes inspector/ });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByText("agent/skills/notes/SKILL.md")).toBeVisible();
  // Monaco loads on first use, which can take a while on a busy machine.
  await expect(inspector.getByText("Write things down.")).toBeVisible({ timeout: 20_000 });

  // insertText rather than type: Monaco drops characters from fast key events.
  await inspector.getByText("Write things down.").click();
  await page.keyboard.press("End");
  await page.keyboard.insertText(" Cite the source.");

  await expect(inspector.getByRole("status")).toHaveText("Unsaved changes");
  await inspector.getByRole("button", { name: "Save", exact: true }).click();
  await expect(inspector.getByRole("status")).toHaveText("Saved");

  const onDisk = await readFile(rootSkill, "utf8");
  expect(onDisk).toContain("Cite the source.");
  // The rest of the file, including its frontmatter, is untouched.
  expect(onDisk).toContain("description: Keeps notes while working.");

  await inspector.getByRole("button", { name: "Close" }).click();
  await expect(inspector).toBeHidden();
});

test("dragging an edge moves a skill into a subagent, and dropping it moves it back", async ({ page }) => {
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

  // A subagent inherits nothing in Eve, so the skill's directory moves.
  await expect.poll(() => exists(researcherSkill)).toBe(true);
  expect(await exists(rootSkill)).toBe(false);
  await expect(page.getByTestId("rf__edge-subagent:researcher->skill:researcher/notes")).toBeVisible();

  // Drop the same end on empty canvas: it goes back to the agent.
  const owned = await center(researcherHandle);
  const pane = await page.locator(".react-flow__pane").boundingBox();
  await drag(page, { x: owned.x, y: owned.y + 9 }, { x: pane!.x + 40, y: pane!.y + 40 });

  await expect.poll(() => exists(rootSkill)).toBe(true);
  expect(await exists(researcherSkill)).toBe(false);
  await expect(page.getByTestId("rf__edge-agent->skill:notes")).toBeVisible();
});

test("adding a tool from the palette writes a real file", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  await page.getByRole("button", { name: /TypeScript tool/ }).click();

  const panel = page.getByRole("complementary", { name: "New tool" });
  await expect(panel).toBeVisible();
  await panel.getByLabel("Tool name").fill("search_docs");
  await panel.getByLabel("Description").fill("Searches the docs index.");
  await panel.getByRole("button", { name: "Create tool" }).click();

  await expect(page.getByText("agent/tools/search_docs.ts")).toBeVisible();

  const source = await readFile(join(PROJECT, "agent", "tools", "search_docs.ts"), "utf8");
  expect(source).toContain('import { defineTool } from "eve/tools";');
  expect(source).toContain("Searches the docs index.");
});

test("adding a connection writes an MCP connection with Vercel Connect auth", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  await page.getByRole("button", { name: /Connection/ }).click();
  const panel = page.getByRole("complementary", { name: "New connection" });
  await panel.getByLabel("Connection name").fill("linear");
  await panel.getByLabel("URL").fill("https://mcp.linear.app/mcp");
  await panel.getByLabel("Description").fill("Linear issues.");
  await panel.getByLabel("Authentication").selectOption("connect");
  await panel.getByLabel("Connector").fill("mcp.linear.app/linear");
  await panel.getByRole("button", { name: "Create connection" }).click();

  await expect(page.getByTestId("rf__node-connection:linear")).toBeVisible();
  const source = await readFile(join(PROJECT, "agent", "connections", "linear.ts"), "utf8");
  expect(source).toContain('import { connect } from "@vercel/connect/eve";');
  expect(source).toContain('auth: connect("mcp.linear.app/linear"),');
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
  await page.goto("/projects/demo-agent/files?path=agent%2Fagent.ts");

  const tree = page.getByRole("tree", { name: "Project files" });
  // A folder with a single child folder is compacted into one row, as in Zed.
  const folder = tree.getByRole("treeitem", { name: "skills / notes" });
  await folder.click();
  await tree.getByRole("treeitem", { name: "SKILL.md" }).click();
  await expect(page.getByRole("navigation", { name: "File path" })).toContainText("SKILL.md");
  await expect(page).toHaveURL(/path=agent%2Fskills%2Fnotes%2FSKILL\.md/);

  await tree.getByRole("treeitem", { name: "SKILL.md" }).press("ArrowLeft");
  await expect(folder).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(folder).toHaveAttribute("aria-expanded", "false");
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

  await page.getByRole("button", { name: /demo-agent/ }).first().click();
  const menu = page.getByRole("menu", { name: "Switch project" });
  await expect(menu.getByRole("menuitem", { name: "All projects" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await page.getByRole("button", { name: /Find/ }).click();
  const palette = page.getByRole("dialog", { name: "Commands" });
  await expect(palette).toBeVisible();
  await page.keyboard.insertText("browse files");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/files/);
});
