import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";

const contract = JSON.parse(readFileSync("experience/browser-contract.json", "utf8")) as {
  determinism: { locale: string; timezoneId: string };
  projects: Array<{ name: string; viewport: { width: number; height: number } }>;
};

// Deliberately independent of the critical attestation and Settings specs.
// Start an owned, credential-free review build before running this config.
const baseURL = process.env.UTILITY_NAVIGATION_URL ?? "http://127.0.0.1:3132";

// The app is dark unless a person chose light, and it no longer follows the
// device (5 Oct 2026), so emulating a colour scheme no longer selects the
// theme. Each project states its choice the way the app remembers one: this
// browser's copy, which the pre-paint resolver reads (src/lib/theme-mode.ts).
const chosenTheme = (theme: "light" | "dark") => ({
  cookies: [],
  origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: "signal:theme-mode", value: theme }] }],
});

export default defineConfig({
  testDir: "./feature-tests",
  testMatch: "utility-navigation.spec.ts",
  outputDir: "./output/utility-navigation",
  reporter: [["list"], ["json", { outputFile: "./output/utility-navigation-results.json" }]],
  workers: 1,
  timeout: 45_000,
  use: {
    baseURL,
    browserName: "chromium",
    channel: process.env.CI ? undefined : "chrome",
    launchOptions: { args: ["--disable-extensions"] },
    locale: contract.determinism.locale,
    timezoneId: contract.determinism.timezoneId,
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: contract.projects
    .filter(({ name }) => name === "mobile" || name === "desktop")
    .flatMap(({ name, viewport }) => (["light", "dark"] as const).map((colorScheme) => ({
      name: `${name}-${colorScheme}`,
      use: { viewport, colorScheme, storageState: chosenTheme(colorScheme) },
    }))),
});
