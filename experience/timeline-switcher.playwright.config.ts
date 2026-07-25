import { defineConfig } from "@playwright/test";
import experienceBaseConfig from "./playwright.config";

export default defineConfig({
  ...experienceBaseConfig,
  testDir: "./feature-tests",
  testMatch: ["timeline-project-switcher.spec.ts"],
  outputDir: "./output/timeline-project-switcher-results",
  reporter: [["list"]],
});
