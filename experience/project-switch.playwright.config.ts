import { defineConfig } from "@playwright/test";
import experienceBaseConfig from "./playwright.config";

/**
 * WP0 · The multi-Project browser journeys (plan §13.4).
 *
 * Deliberately a sibling of `timeline-switcher.playwright.config.ts`, not an
 * extension of it. That config proves switching between three Timeline-local
 * children of ONE Tasks Project; this one proves an A/B Tasks *Project*
 * journey, which is the thing the whole wave exists to demonstrate
 * (`docs/wave/DECISIONS.md` D-009).
 *
 * Viewports are inherited, not declared. The base config builds its Playwright
 * projects from `experience/browser-contract.json`, whose four viewports are
 * checked against `experience/registry.json`'s breakpoints — 390×844,
 * 768×1024, 1280×900, 1440×960 — by
 * `src/lib/project-truth-fixture.test.ts`. Nothing here hardcodes a size.
 */
export default defineConfig({
  ...experienceBaseConfig,
  testDir: "./feature-tests",
  testMatch: ["project-switch-journeys.spec.ts"],
  outputDir: "./output/project-switch-results",
  reporter: [["list"]],
});
