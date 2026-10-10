import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const appServer = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;

// Additional locale regressions are separate from the exact critical-manifest
// attestation. Both suites run in CI; this one uses the build produced there.
export default defineConfig({
  ...base,
  testDir: "./hydration-tests",
  outputDir: "./output/settings-hydration-results",
  reporter: [["list"]],
  projects: [{ name: "settings-locales" }],
  webServer: {
    ...appServer,
    command: "corepack pnpm exec next start -p " + Number(process.env.TASKS_EXPERIENCE_PORT ?? 4342),
  },
});
