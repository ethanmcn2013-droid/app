import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.NOTES_HYBRID_BASE_URL;
const port = Number(process.env.NOTES_HYBRID_PORT ?? 4353);
const baseURL = externalBaseUrl ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./feature-tests",
  testMatch: "notes-hybrid.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  retries: 0,
  reporter: [["line"]],
  outputDir: "output/notes-hybrid-results",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
    locale: "en-IE",
    timezoneId: "Europe/Dublin",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "on",
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `pnpm exec next dev -H 127.0.0.1 -p ${port}`,
        cwd: process.cwd(),
        url: `${baseURL}/app/notes?fixture=populated`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          SIGNAL_ACCESS_MODE: "review",
          NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "review",
          NOTES_LEGACY_NOTEBOOK_ENABLED: "0",
          SIGNAL_PLANNING_PERIODS_ENABLED: "0",
          VERCEL_ENV: "preview",
          NEXT_TELEMETRY_DISABLED: "1",
        },
      },
});
