import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end coverage for the flows that would embarrass us if they broke:
 * opening the canvas, editing the file behind a node, and creating a capability.
 *
 * The suite runs against a disposable workspace so it never touches real
 * projects. Setting E2E_DATABASE_URL adds a second server with sign-in on, and
 * the ownership tests that run against it.
 */
const PORT = Number(process.env.E2E_PORT ?? 3310);
const AUTH_PORT = Number(process.env.E2E_AUTH_PORT ?? 3311);
const DATABASE_URL = process.env.E2E_DATABASE_URL;

export const AUTH_WORKSPACE = process.env.E2E_AUTH_WORKSPACE ?? "/tmp/evelab-e2e/auth-workspace";

/** A throwaway OAuth app and secret: the suite never completes a real GitHub sign-in. */
export const AUTH_ENV = {
  BETTER_AUTH_URL: `http://127.0.0.1:${AUTH_PORT}`,
  BETTER_AUTH_SECRET: "e2e-only-secret-not-for-any-real-deployment",
  GITHUB_CLIENT_ID: "e2e-client-id",
  GITHUB_CLIENT_SECRET: "e2e-client-secret",
};

const local = `http://127.0.0.1:${PORT}`;
const authed = AUTH_ENV.BETTER_AUTH_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    // Use a locally installed Chromium when one is available, so the suite does
    // not require a separate `playwright install` download.
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    { name: "local", testIgnore: /auth\.spec\.ts/, use: { baseURL: local } },
    ...(DATABASE_URL ? [{ name: "auth", testMatch: /auth\.spec\.ts/, use: { baseURL: authed } }] : []),
  ],
  webServer: [
    {
      command: `pnpm start --port ${PORT} --hostname 127.0.0.1`,
      url: local,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        EVELAB_WORKSPACE: process.env.E2E_WORKSPACE ?? "/tmp/evelab-e2e/workspace",
        // GitHub is an in-memory mock started by e2e/github.spec.ts.
        GITHUB_API_URL: `http://127.0.0.1:${process.env.E2E_GITHUB_PORT ?? 3399}`,
        GITHUB_TOKEN: "e2e-token",
        // `eve dev` and `eve deploy` are a local stand-in that serves eve's session API.
        EVELAB_EVE_BIN: `${process.cwd()}/e2e/fake-eve.mjs`,
      },
    },
    ...(DATABASE_URL
      ? [
          {
            command: `pnpm start --port ${AUTH_PORT} --hostname 127.0.0.1`,
            url: authed,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: { ...AUTH_ENV, DATABASE_URL, EVELAB_WORKSPACE: AUTH_WORKSPACE },
          },
        ]
      : []),
  ],
});
