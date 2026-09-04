import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Additional locale regressions are separate from the exact critical-manifest
// attestation. Both suites run in CI; this one uses the build produced there.
export default defineConfig({
  ...base,
  testDir: "./hydration-tests",
  outputDir: "./output/settings-hydration-results",
  reporter: [["list"]],
  projects: [{ name: "settings-locales" }],
  webServer: {
    ...base.webServer,
    command: "corepack pnpm exec next start -p " + Number(process.env.TASKS_EXPERIENCE_PORT ?? 4342),
  },
});
