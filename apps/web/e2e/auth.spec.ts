import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import postgres from "postgres";
import { expect, test, type BrowserContext } from "@playwright/test";
import { AUTH_ENV, AUTH_WORKSPACE } from "../playwright.config";

/**
 * Sign-in and ownership, against a real Postgres. Runs only when
 * E2E_DATABASE_URL is set; the GitHub OAuth round trip itself is not driven,
 * so sessions are written straight into the database, signed the way Better
 * Auth signs them.
 */

const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "";
const sql = postgres(DATABASE_URL, { max: 2, onnotice: () => {} });

const OWNER = { id: "user-owner", name: "Owner", email: "owner@example.com" };
const STRANGER = { id: "user-stranger", name: "Stranger", email: "stranger@example.com" };
const PROJECT = "owned-agent";

async function signIn(context: BrowserContext, user: { id: string }) {
  const token = randomUUID().replaceAll("-", "");
  await sql`
    insert into sessions (id, token, user_id, expires_at, created_at, updated_at)
    values (${randomUUID()}, ${token}, ${user.id}, now() + interval '1 day', now(), now())
  `;
  const signature = createHmac("sha256", AUTH_ENV.BETTER_AUTH_SECRET).update(token).digest("base64");
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: encodeURIComponent(`${token}.${signature}`),
      url: AUTH_ENV.BETTER_AUTH_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

test.beforeAll(async () => {
  // Migrations are the same ones `pnpm db:migrate` applies.
  execFileSync("pnpm", ["--filter", "@evelab/db", "db:migrate"], {
    cwd: resolve(__dirname, "../../.."),
    env: { ...process.env, DATABASE_URL },
    stdio: "pipe",
  });
  await sql`truncate users, projects cascade`;

  for (const user of [OWNER, STRANGER]) {
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${user.id}, ${user.name}, ${user.email}, true, now(), now())
    `;
  }

  const directory = join(AUTH_WORKSPACE, PROJECT);
  await rm(AUTH_WORKSPACE, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  await mkdir(join(directory, "agent"), { recursive: true });
  await writeFile(join(directory, "package.json"), `${JSON.stringify({ name: PROJECT, type: "module" })}\n`);
  await writeFile(
    join(directory, "agent", "agent.ts"),
    `import { defineAgent } from "eve";\n\nexport default defineAgent({\n  model: "openai/gpt-5.6-luna-fast",\n});\n`,
  );
  await writeFile(join(directory, "agent", "instructions.md"), "# Owned Agent\n");

  const projectId = randomUUID();
  await sql`insert into projects (id, slug, name, owner_id) values (${projectId}, ${PROJECT}, 'Owned Agent', ${OWNER.id})`;
  await sql`insert into project_members (project_id, user_id, role) values (${projectId}, ${OWNER.id}, 'owner')`;
});

test.afterAll(async () => {
  await sql.end();
});

test("a signed-out visitor is sent to sign in, and sign-in goes to GitHub", async ({ page }) => {
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/sign-in$/);

  // Stop at GitHub's door: the OAuth app here is not real.
  let authorize: URL | undefined;
  await page.route("https://github.com/**", async (route) => {
    authorize = new URL(route.request().url());
    await route.fulfill({ status: 200, body: "GitHub" });
  });
  await page.getByRole("button", { name: "Continue with GitHub" }).click();
  await expect.poll(() => authorize?.pathname).toBe("/login/oauth/authorize");
  expect(authorize?.searchParams.get("client_id")).toBe(AUTH_ENV.GITHUB_CLIENT_ID);
});

test("a project page is a 404 for a signed-out visitor", async ({ page }) => {
  const response = await page.goto(`/projects/${PROJECT}`);
  expect(response?.status()).toBe(404);
});

test("the owner sees their project; another account does not", async ({ browser }) => {
  const owner = await browser.newContext();
  await signIn(owner, OWNER);
  const ownerPage = await owner.newPage();
  await ownerPage.goto("/projects");
  await expect(ownerPage.getByText("Owned Agent")).toBeVisible();
  await ownerPage.goto(`/projects/${PROJECT}`);
  await expect(ownerPage.getByRole("heading", { name: "Owned Agent" })).toBeVisible();

  const stranger = await browser.newContext();
  await signIn(stranger, STRANGER);
  const strangerPage = await stranger.newPage();
  await strangerPage.goto("/projects");
  await expect(strangerPage.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(strangerPage.getByText("Owned Agent")).toBeHidden();
  const response = await strangerPage.goto(`/projects/${PROJECT}`);
  expect(response?.status()).toBe(404);

  await owner.close();
  await stranger.close();
});

test("a server action called directly by another account is rejected", async ({ browser }) => {
  // Take the real action id from the owner's settings page...
  const owner = await browser.newContext();
  await signIn(owner, OWNER);
  const ownerPage = await owner.newPage();
  await ownerPage.goto(`/projects/${PROJECT}/settings`);
  const form = ownerPage.locator("form", { has: ownerPage.locator('input[name="id"]') });
  const actionField = await form.locator('input[name^="$ACTION_ID_"]').getAttribute("name");
  expect(actionField).toBeTruthy();
  await owner.close();

  // ...and fire it as someone else, with no page in between.
  const stranger = await browser.newContext();
  await signIn(stranger, STRANGER);
  const response = await stranger.request.post(`/projects/${PROJECT}/settings`, {
    multipart: { [actionField!]: "", id: PROJECT },
    maxRedirects: 0,
  });
  expect(response.status()).toBeGreaterThanOrEqual(400);
  expect(existsSync(join(AUTH_WORKSPACE, PROJECT, "agent", "agent.ts"))).toBe(true);
  const [row] = await sql`select count(*)::int as count from projects where slug = ${PROJECT}`;
  expect(row?.count).toBe(1);
  await stranger.close();
});
