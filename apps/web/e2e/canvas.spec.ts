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
  "agent/subagents/researcher/agent.ts": `import { defineAgent } from "eve";\n\nexport default defineAgent({\n  description: "Gathers sources.",\n  model: "openai/gpt-5.6-luna-fast",\n});\n`,
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
const sharedSkill = join(PROJECT, "agent", "lib", "skills", "notes.ts");
const researcherReexport = join(PROJECT, "agent", "subagents", "researcher", "skills", "notes.ts");

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

test("the canvas shows every node and the file behind it", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  await expect(page.getByTestId("rf__node-agent")).toContainText("demo-agent");
  await expect(page.getByTestId("rf__node-subagent:researcher")).toContainText("agent/subagents/researcher/agent.ts");
  await expect(page.getByTestId("rf__node-skill:notes")).toContainText("agent/skills/notes/SKILL.md");
  await expect(page.getByRole("complementary", { name: "Resources" }).getByText("notes")).toBeVisible();
});

test("the toolbar zooms", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");
  const toolbar = page.getByRole("toolbar", { name: "Canvas" });
  const zoom = toolbar.getByRole("button", { name: /Reset zoom/ });
  await expect(page.getByTestId("rf__node-agent")).toBeVisible();
  const before = await zoom.textContent();
  // The first fit can land after an early click and reset the zoom, so retry the click.
  await expect(async () => {
    await toolbar.getByRole("button", { name: "Zoom in" }).click();
    await expect(zoom).not.toHaveText(before ?? "", { timeout: 1000 });
  }).toPass();
});

test("selecting a node shows its source and saves edits", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  await page.getByTestId("rf__node-skill:notes").click();
  const inspector = page.getByRole("complementary", { name: /notes inspector/ });
  await expect(inspector).toBeVisible();
  await inspector.getByRole("tab", { name: "Source" }).click();
  // Monaco loads on first use, which can take a while on a busy machine.
  await expect(inspector.getByText("Write things down.")).toBeVisible({ timeout: 20_000 });

  // insertText rather than type: Monaco drops characters from fast key events.
  await inspector.getByText("Write things down.").click();
  await page.keyboard.press("End");
  await page.keyboard.insertText(" Cite the source.");
  await expect(page.getByRole("toolbar", { name: "Canvas" })).toContainText("Unsaved");
  await inspector.getByRole("button", { name: "Save", exact: true }).click();

  await expect.poll(() => readFile(rootSkill, "utf8")).toContain("Cite the source.");
  // The rest of the file, including its frontmatter, is untouched.
  expect(await readFile(rootSkill, "utf8")).toContain("description: Keeps notes while working.");
});

test("attaching a skill to a subagent shares one definition, and detaching keeps it", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  await page.getByTestId("rf__node-skill:notes").click();
  await page.getByRole("button", { name: "Attach to agent" }).click();
  await page.getByRole("menuitem", { name: "researcher" }).click();

  // Eve gives a subagent nothing from its parent, so both agents re-export one module in lib/.
  await expect.poll(() => exists(sharedSkill)).toBe(true);
  expect(await readFile(researcherReexport, "utf8")).toBe('export { default } from "../../../lib/skills/notes.ts";\n');
  expect(await exists(rootSkill)).toBe(false);
  const node = page.getByTestId("rf__node-skill:#notes");
  await expect(node).toContainText("Shared");
  await expect(page.locator('[data-testid^="rf__node-skill"]')).toHaveCount(1);

  await node.click();
  await page.getByRole("button", { name: "Detach researcher" }).click();
  await expect.poll(() => exists(researcherReexport)).toBe(false);
  expect(await exists(sharedSkill)).toBe(true);

  await page.keyboard.press("Control+z");
  await expect.poll(() => exists(researcherReexport)).toBe(true);
});

test("adding a tool from the Add menu writes a real file", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  await page.getByRole("toolbar", { name: "Canvas" }).getByRole("button", { name: "Add" }).click();
  await page.getByRole("menuitem", { name: /^Tool/ }).click();

  const panel = page.getByRole("complementary", { name: "Create" });
  await panel.getByLabel("Name").fill("search_docs");
  await panel.getByLabel("Description").fill("Searches the docs index.");
  await panel.getByRole("button", { name: "Create tool" }).click();

  await expect(page.getByTestId("rf__node-tool:search_docs")).toBeVisible();
  const source = await readFile(join(PROJECT, "agent", "tools", "search_docs.ts"), "utf8");
  expect(source).toContain('import { defineTool } from "eve/tools";');
  expect(source).toContain("Searches the docs index.");
});

test("adding a connection writes an MCP connection with Vercel Connect auth", async ({ page }) => {
  await page.goto("/projects/demo-agent/canvas");

  await page.keyboard.press("a");
  await page.getByRole("menuitem", { name: /^Connection/ }).click();
  const panel = page.getByRole("complementary", { name: "Create" });
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
 * Screen positions are useless here: the first fit re-centres the graph on reload.
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

  // 160 screen pixels is at least 100 flow units at any zoom the first fit picks.
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
