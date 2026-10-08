import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const contract = JSON.parse(readFileSync(path.join(process.cwd(), "experience/browser-contract.json"), "utf8"));
const next = path.join(process.cwd(), "node_modules/next/dist/bin/next");
// Shell quoting for fixed installed paths; JSON escaping is not shell escaping.
const quote = (value: string) => `"${value}"`;
const node = quote(process.execPath);
const port = 4353;

export default defineConfig({
  testDir: "../tests",
  testMatch: "workshop-task-detail.spec.ts",
  // One serial two-phase journey captures every initial viewport/variant before edits.
  // The four registered widths are explicitly applied to fresh contexts in the spec.
  projects: [{ name: "workshop" }],
  fullyParallel: false,
  workers: 1,
  outputDir: "../output/workshop-playwright-results",
  retries: 0,
  timeout: 360_000,
  expect: { timeout: 8_000 },
  reporter: [["json"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    channel: process.env.CI ? undefined : "chrome",
    locale: contract.determinism.locale,
    timezoneId: contract.determinism.timezoneId,
    colorScheme: contract.determinism.colorScheme,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `${node} ${quote(next)} build && ${node} ${quote(next)} start -H 127.0.0.1 -p ${port}`,
    cwd: process.cwd(),
    url: `http://127.0.0.1:${port}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      NODE_OPTIONS: "--max-old-space-size=4096",
      VERCEL_ENV: contract.determinism.deploymentEnvironment,
      SIGNAL_ACCESS_MODE: contract.determinism.accessMode,
      NEXT_PUBLIC_SIGNAL_ACCESS_MODE: contract.determinism.accessMode,
      NEXT_PUBLIC_TASKS_FIRST_COMPLETION: "off",
      SIGNAL_ANALYTICS_V1_ENABLED: "false",
      SIGNAL_HOME_ANALYTICS_ENABLED: "false",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
