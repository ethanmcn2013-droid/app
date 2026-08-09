import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const port = Number(process.env.TASKS_EXPERIENCE_PORT ?? 4342);
const browserContract = JSON.parse(
  readFileSync(path.join(process.cwd(), "experience", "browser-contract.json"), "utf8"),
) as {
  determinism: {
    accessMode: string;
    deploymentEnvironment: string;
    locale: string;
    timezoneId: string;
    colorScheme: "light" | "dark" | "no-preference";
  };
  projects: Array<{
    name: string;
    viewport: { width: number; height: number };
  }>;
};

export default defineConfig({
  testDir: "./tests",
  outputDir: "./output/playwright-results",
  snapshotPathTemplate:
    "./baselines/{testFilePath}/{projectName}/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.0025,
      threshold: 0.1,
    },
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "./output/critical-evidence.json" }],
    ["html", { outputFolder: "./output/playwright-report", open: "never" }],
  ],
  use: {
    baseURL: `http://localhost:${port}`,
    browserName: "chromium",
    channel: process.env.CI ? undefined : "chrome",
    colorScheme: browserContract.determinism.colorScheme,
    locale: browserContract.determinism.locale,
    timezoneId: browserContract.determinism.timezoneId,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 30_000,
  },
  projects: browserContract.projects.map((project) => ({
    name: project.name,
    use: { viewport: project.viewport },
  })),
  webServer: {
    command:
      `corepack pnpm exec next build && ` +
      `corepack pnpm exec next start -p ${port}`,
    cwd: process.cwd(),
    url: `http://localhost:${port}`,
    timeout: 240_000,
    reuseExistingServer: process.env.TASKS_EXPERIENCE_REUSE_SERVER === "1",
    env: {
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=4096",
      VERCEL_ENV: browserContract.determinism.deploymentEnvironment,
      SIGNAL_ACCESS_MODE: browserContract.determinism.accessMode,
      NEXT_PUBLIC_SIGNAL_ACCESS_MODE: browserContract.determinism.accessMode,
      NEXT_PUBLIC_TASKS_FIRST_COMPLETION: "off",
      SIGNAL_ANALYTICS_V1_ENABLED: "false",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
