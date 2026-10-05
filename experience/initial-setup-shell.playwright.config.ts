import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";

const contract = JSON.parse(readFileSync("experience/browser-contract.json", "utf8")) as {
  determinism: { locale: string; timezoneId: string };
};

// The v3 shell's navigation: the approved top level and the "Initial setup"
// group, in the sidebar, the New menu, the launcher and the palette.
// Deliberately independent of the critical attestation. Start an owned,
// credential-free review server first (NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review,
// SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true) and point INITIAL_SETUP_SHELL_URL at it.
export default defineConfig({
  testDir: "./feature-tests",
  testMatch: "initial-setup-shell.spec.ts",
  outputDir: "./output/initial-setup-shell",
  reporter: [["list"], ["json", { outputFile: "./output/initial-setup-shell-results.json" }]],
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.INITIAL_SETUP_SHELL_URL ?? "http://127.0.0.1:3132",
    browserName: "chromium",
    channel: process.env.CI ? undefined : "chrome",
    launchOptions: { args: ["--disable-extensions"] },
    locale: contract.determinism.locale,
    timezoneId: contract.determinism.timezoneId,
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: (
    [
      { name: "desktop", viewport: { width: 1440, height: 900 } },
      { name: "mobile", viewport: { width: 390, height: 844 } },
    ] as const
  ).flatMap(({ name, viewport }) =>
    (["light", "dark"] as const).map((colorScheme) => ({
      name: `${name}-${colorScheme}`,
      use: { viewport, colorScheme },
    })),
  ),
});
