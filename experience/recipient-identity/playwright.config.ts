import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.SIGNAL_RECIPIENT_PORT ?? "4389");
const baseURL = `http://127.0.0.1:${port}`;
const sourceRevision = process.env.SIGNAL_RECIPIENT_SOURCE_REVISION ?? "0000000000000000000000000000000000000000";
if (!/^[a-f0-9]{40}$/.test(sourceRevision)) throw new Error("Recipient source revision must be a full commit SHA.");
function localDatabaseUrl(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  const url = new URL(value);
  const filePath = url.protocol === "file:" ? fileURLToPath(url) : "";
  const canonical = filePath ? pathToFileURL(filePath).href : "";
  if (url.protocol !== "file:" || url.hostname || url.search || url.hash || !path.isAbsolute(filePath) || canonical !== url.href) {
    throw new Error(`${name} must be an explicit local file URL.`);
  }
  return canonical;
}
const tasksDatabaseUrl = localDatabaseUrl("TASKS_DATABASE_URL");
const notesDatabaseUrl = localDatabaseUrl("NOTES_DATABASE_URL");
const timelineDatabaseUrl = localDatabaseUrl("TIMELINE_DATABASE_URL");
const signalDatabaseUrl = localDatabaseUrl("SIGNAL_DATABASE_URL");
localDatabaseUrl("ENTITLEMENTS_DATABASE_URL");

const serverEnvironment = Object.fromEntries(
  Object.entries({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    TASKS_DATABASE_URL: process.env.TASKS_DATABASE_URL,
    TASKS_AUTH_TOKEN: process.env.TASKS_AUTH_TOKEN,
    NOTES_DATABASE_URL: process.env.NOTES_DATABASE_URL,
    TIMELINE_DATABASE_URL: process.env.TIMELINE_DATABASE_URL,
    SIGNAL_DATABASE_URL: process.env.SIGNAL_DATABASE_URL,
    ENTITLEMENTS_DATABASE_URL: process.env.ENTITLEMENTS_DATABASE_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    SIGNAL_ACCESS_MODE: "production",
    NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "production",
    SIGNAL_ACTIVE_PROJECT_V3_ENABLED: "true",
    SIGNAL_ALLOWLIST: process.env.SIGNAL_ALLOWLIST,
    VERCEL_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
  }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
);

export default defineConfig({
  testDir: ".",
  outputDir: path.join(process.cwd(), "experience", "output", "recipient-identity", "playwright"),
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 12_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "clerk setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "recipient identity",
      testMatch: /recipient\.spec\.ts/,
      dependencies: ["clerk setup"],
    },
  ],
  webServer: {
    command: [
      `node scripts/db/migrate.mjs migrate --database-url=${tasksDatabaseUrl} --environment=test --release-sha=${sourceRevision}`,
      `node scripts/db/notes-migrate.mjs migrate --database-url=${notesDatabaseUrl} --environment=test --release-sha=${sourceRevision} --create`,
      `node scripts/db/timeline-migrate.mjs migrate --database-url=${timelineDatabaseUrl} --environment=test --release-sha=${sourceRevision}`,
      `node scripts/db/signal-migrate.mjs migrate --database-url=${signalDatabaseUrl} --environment=test --release-sha=${sourceRevision} --create`,
      "corepack pnpm exec next build",
      `corepack pnpm exec next start -H 127.0.0.1 -p ${port}`,
    ].join(" && "),
    cwd: process.cwd(),
    url: `${baseURL}/sign-in`,
    timeout: 360_000,
    reuseExistingServer: false,
    env: serverEnvironment,
  },
});
