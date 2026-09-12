import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end coverage for the flows that would embarrass us if they broke:
 * opening the canvas, editing the file behind a node, and creating a capability.
 *
 * The suite runs against a disposable workspace so it never touches real
 * projects.
 */
const PORT = Number(process.env.E2E_PORT ?? 3310);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices["Desktop Chrome"],
    // Use a locally installed Chromium when one is available, so the suite does
    // not require a separate `playwright install` download.
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : undefined,
  },
  webServer: {
    command: `pnpm start --port ${PORT} --hostname 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      EVELAB_WORKSPACE: process.env.E2E_WORKSPACE ?? "/tmp/evelab-e2e/workspace",
    },
  },
});
