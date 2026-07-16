import { defineConfig, devices } from "@playwright/test";

const port = 4317;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e/design-lab",
  outputDir: "./artifacts/tasks-redesign/test-results",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: [["list"], ["json", { outputFile: "artifacts/tasks-redesign/playwright-results.json" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    channel: "chrome",
    colorScheme: "light",
    locale: "en-GB",
    timezoneId: "Europe/London",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `pnpm exec next dev --hostname 127.0.0.1 -p ${port}`,
    url: `${baseURL}/__design-lab/tasks?option=a&view=board&dataset=sparse&density=compact&mode=default`,
    reuseExistingServer: process.env.DESIGN_LAB_REUSE_SERVER === "true",
    timeout: 120_000,
    env: {
      ...process.env,
      SIGNAL_ACCESS_MODE: "review",
      NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "review",
      SIGNAL_TASKS_DESIGN_LAB: "true",
    },
  },
});
