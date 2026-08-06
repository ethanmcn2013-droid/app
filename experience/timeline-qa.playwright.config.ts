import { defineConfig } from "@playwright/test";

/**
 * Dedicated Playwright config for the Timeline visual-QA harness
 * (experience/timeline-qa/). Sibling to timeline-switcher.playwright.config.ts
 * -- one small config per focused sweep, same pattern as the rest of this
 * folder -- but this one deliberately has NO webServer block.
 *
 * Why: this harness is meant to run against the review-mode dev server that
 * is already running for this worktree (default port 3520, SIGNAL_ACCESS_MODE
 * review, no login wall -- see ../.env.local and DEMO_MODE.md). That server
 * is shared with whoever else is working in this worktree. Booting a second
 * `next build && next start` here, the way the base experience/playwright.
 * config.ts does on its own port, would give a colder, less faithful picture
 * of the actual redesign (a from-scratch production build lags live edits)
 * and this repository's own Next.js install refuses to run two `next dev`
 * processes against the same .next directory at once, so a second instance
 * is not a safe fallback either -- confirmed while building this harness by
 * attempting exactly that; Next.js reported "Another next dev server is
 * already running" and exited cleanly rather than allowing it.
 *
 * Point this at a different, already-running server with TIMELINE_QA_PORT.
 */

const port = process.env.TIMELINE_QA_PORT ?? "3520";

export default defineConfig({
  testDir: "./timeline-qa",
  testMatch: ["timeline-visual-qa.spec.ts"],
  outputDir: "./output/timeline-qa-results",
  snapshotPathTemplate: "./timeline-qa/baselines/{testFilePath}/{projectName}/{arg}{ext}",
  fullyParallel: false,
  // Deliberately conservative. The dev server this harness targets was
  // observed, during the session that built this harness, to become fully
  // unresponsive for over an hour under concurrent load from multiple
  // clients -- see the README "Harness trustworthiness" section. Raise this
  // with --workers=N once the environment is known stable; do not raise the
  // default until then.
  workers: 1,
  timeout: 75_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "./output/timeline-qa-evidence.json" }],
    ["html", { outputFolder: "./output/timeline-qa-report", open: "never" }],
  ],
  use: {
    baseURL: "http://localhost:" + port,
    browserName: "chromium",
    channel: process.env.CI ? undefined : "chrome",
    colorScheme: "light",
    locale: "en-GB",
    timezoneId: "Europe/London",
    trace: "retain-on-failure",
    screenshot: "off",
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
  },
  // No webServer entry -- see file header. Start or confirm the target
  // server yourself before running this config.
});
