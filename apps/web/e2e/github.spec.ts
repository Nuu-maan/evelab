import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { GitHubMock } from "./github-mock";

/**
 * The source control journey against an in-memory GitHub. The web server's
 * GITHUB_API_URL points here (see playwright.config.ts).
 */

const WORKSPACE = process.env.E2E_WORKSPACE ?? "/tmp/evelab-e2e/workspace";
const GITHUB_PORT = Number(process.env.E2E_GITHUB_PORT ?? 3399);
const REPO = "acme/support-agent";
const PROJECT = join(WORKSPACE, "support-agent");
const github = new GitHubMock();

const AGENT_TS = `import { Agent } from "eve";

export default new Agent({
  name: "Support Agent",
  description: "Answers support questions.",
  model: "openai/gpt-5.6",
  instructions: "instructions.md",
});
`;

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  for (const project of ["support-agent", "export-agent"]) {
    await rm(join(WORKSPACE, project), { recursive: true, force: true });
  }
  await rm(join(WORKSPACE, "..", "git"), { recursive: true, force: true });

  github.addRepository(REPO);
  github.push(REPO, "main", {
    "agent.ts": AGENT_TS,
    "instructions.md": "# Support Agent\n\nBe kind.\n",
    "subagents/triage.md": "---\nname: Triage\ndescription: Sorts tickets.\n---\n\nSort tickets.\n",
    ".env": "OPENAI_API_KEY=not-for-anyone\n",
    "logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]),
  });
  await github.start(GITHUB_PORT);
});

test.afterAll(async () => {
  await github.stop();
});

test("importing a repository shows what was found before writing anything", async ({ page }) => {
  await page.goto("/projects/import");
  await page.getByLabel("Repository").fill(REPO);
  await page.getByRole("button", { name: "Read repository" }).click();

  const review = page.getByRole("region", { name: "Review import" });
  await expect(review).toContainText("Support Agent");
  await expect(review).toContainText("subagents/triage.md");
  await expect(review).toContainText('Skipped ".env"');
  await expect(review).toContainText('Skipped "logo.png": not a text file.');
  expect(await exists(PROJECT)).toBe(false);

  await review.getByRole("button", { name: "Import project" }).click();
  await expect(page).toHaveURL(/\/projects\/support-agent$/);
  await expect(page.getByRole("link", { name: "Synced" })).toBeVisible();
  expect(await readFile(join(PROJECT, "subagents", "triage.md"), "utf8")).toContain("Sort tickets.");
  expect(await exists(join(PROJECT, ".env"))).toBe(false);
});

test("an edit shows up as a change, and committing sends only that file", async ({ page }) => {
  const edited = "# Support Agent\n\nBe kind and brief.\n";
  await writeFile(join(PROJECT, "instructions.md"), edited);

  await page.goto("/projects/support-agent/source");
  await expect(page.getByRole("link", { name: "1 change" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Changes" })).toContainText("instructions.md");

  const before = github.requests.length;
  await page.getByLabel("Commit message").fill("Keep answers brief");
  await page.getByRole("button", { name: "Commit and push" }).click();
  await expect(page.getByText("No local changes")).toBeVisible();

  const trees = github.requests
    .slice(before)
    .filter((request) => request.method === "POST" && request.path.endsWith("/git/trees"));
  expect(trees).toHaveLength(1);
  expect(trees[0]!.body.tree).toEqual([
    { path: "instructions.md", mode: "100644", type: "blob", content: edited },
  ]);
  expect(github.fileAt(REPO, "main", "instructions.md")).toBe(edited);
  // A file EveLab never imported is untouched by the commit.
  expect(github.pathsAt(REPO, "main")).toContain("logo.png");
  await expect(page.getByRole("link", { name: "Synced" })).toBeVisible();
});

test("pulling brings in a change made on GitHub", async ({ page }) => {
  github.commitChanges(REPO, "main", {
    "agent.ts": AGENT_TS.replace("Answers support questions.", "Answers support questions politely."),
  });

  await page.goto("/projects/support-agent/source");
  await expect(page.getByText("New commits on GitHub")).toBeVisible();
  await page.getByRole("button", { name: "Pull" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Pulled 1 file" })).toBeVisible();
  expect(await readFile(join(PROJECT, "agent.ts"), "utf8")).toContain("politely");

  await page.goto("/projects/support-agent/files?path=agent.ts");
  await expect(page.getByText("Answers support questions politely.")).toBeVisible();
});

test("a pull that would overwrite a local edit writes nothing", async ({ page }) => {
  await writeFile(join(PROJECT, "agent.ts"), AGENT_TS.replace("Support Agent", "Local Agent"));
  github.commitChanges(REPO, "main", { "agent.ts": AGENT_TS.replace("Support Agent", "Remote Agent") });

  await page.goto("/projects/support-agent/source");
  await page.getByRole("button", { name: "Pull" }).click();
  const notice = page.getByRole("status").filter({ hasText: "Nothing was pulled" });
  await expect(notice).toContainText("agent.ts");
  expect(await readFile(join(PROJECT, "agent.ts"), "utf8")).toContain("Local Agent");

  await page.getByLabel("Commit message").fill("Try to overwrite");
  await expect(page.getByRole("button", { name: "Commit and push" })).toBeDisabled();
});

test("a project without a repository can create one and push", async ({ page }) => {
  const project = join(WORKSPACE, "export-agent");
  await mkdir(project, { recursive: true });
  await writeFile(join(project, "agent.ts"), AGENT_TS.replace("Support Agent", "Export Agent"));
  await writeFile(join(project, "instructions.md"), "# Export Agent\n");
  await writeFile(join(project, ".env"), "SECRET=stays-here\n");

  await page.goto("/projects/export-agent/source");
  const create = page.getByRole("region", { name: "Create a repository" });
  await create.getByLabel("Repository name").fill("export-agent");
  await create.getByRole("button", { name: "Create repository and push" }).click();

  await expect(page.getByRole("link", { name: /e2e-user\/export-agent/ })).toBeVisible();
  expect(github.pathsAt("e2e-user/export-agent", "main")).toEqual(["agent.ts", "instructions.md"]);
});
