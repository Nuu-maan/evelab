import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";

/** Deploys through the stand-in `eve deploy` from e2e/fake-eve.mjs. */

const WORKSPACE = process.env.E2E_WORKSPACE ?? "/tmp/evelab-e2e/workspace";
const PROJECT_ID = "deploy-agent";
const PROJECT = join(WORKSPACE, PROJECT_ID);

test.beforeAll(async () => {
  await rm(PROJECT, { recursive: true, force: true });
  await rm(join(WORKSPACE, "..", "deployments", `${PROJECT_ID}.json`), { force: true });
  const files: Record<string, string> = {
    "package.json": `${JSON.stringify({ name: PROJECT_ID, type: "module" })}\n`,
    "agent/agent.ts": `import { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: "openai/gpt-5.6-luna-fast",\n});\n`,
    "agent/instructions.md": "# Identity\n\nHelp.\n",
    "agent/connections/petstore.ts":
      'import { defineOpenAPIConnection } from "eve/connections";\n\nexport default defineOpenAPIConnection({\n  spec: "https://petstore3.swagger.io/api/v3/openapi.json",\n  description: "Pets.",\n  auth: { getToken: async () => ({ token: process.env.PETSTORE_TOKEN! }) },\n});\n',
  };
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(PROJECT, path)), { recursive: true });
    await writeFile(join(PROJECT, path), content);
  }
});

test("deploying runs eve deploy for the chosen Vercel project and records the URL", async ({ page }) => {
  await page.goto(`/projects/${PROJECT_ID}/deployments`);

  await expect(page.getByRole("list", { name: "Environment variables" })).toContainText("PETSTORE_TOKEN");

  await page.getByLabel("Project name").fill("deploy-agent-prod");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("Project name")).toHaveValue("deploy-agent-prod");

  await page.getByRole("button", { name: "Deploy to production" }).click();
  const deployments = page.getByRole("list", { name: "Deployments" });
  await expect(deployments.getByText("Ready")).toBeVisible({ timeout: 30_000 });
  await expect(deployments.getByRole("link", { name: "https://deploy-agent-prod.vercel.app" })).toBeVisible();

  const state = JSON.parse(await readFile(join(WORKSPACE, "..", "deployments", `${PROJECT_ID}.json`), "utf8"));
  expect(state.deployments[0]).toMatchObject({ status: "ready", project: "deploy-agent-prod" });
  // Nothing about the deployment is written into the project.
  await expect(readFile(join(PROJECT, ".vercel", "project.json"), "utf8")).rejects.toThrow();
});
