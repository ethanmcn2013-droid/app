import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const contract = JSON.parse(readFileSync(path.join(root, "experience/browser-contract.json"), "utf8"));
const port = Number(process.env.PERSONAL_CHAT_FILES_BROWSER_PORT ?? 4836);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid browser-suite port");

export default defineConfig({
  testDir: __dirname,
  testMatch: "personal-chat.spec.ts",
  outputDir: path.join(root, "experience/output/playwright-results/personal-chat-files"),
  reporter: [["list"], [path.join(__dirname, "reporter.ts")]],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    locale: contract.determinism.locale,
    timezoneId: contract.determinism.timezoneId,
    contextOptions: { reducedMotion: contract.determinism.reducedMotion },
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-light", use: { viewport: { width: 1440, height: 960 }, colorScheme: "light" } },
    { name: "desktop-dark", use: { viewport: { width: 1440, height: 960 }, colorScheme: "dark" } },
    { name: "phone-light", use: { viewport: { width: 390, height: 844 }, colorScheme: "light" } },
    { name: "short-light", use: { viewport: { width: 390, height: 400 }, colorScheme: "light" } },
    { name: "short-dark", use: { viewport: { width: 390, height: 400 }, colorScheme: "dark" } },
  ],
  webServer: {
    command: `"${process.execPath}" "${path.join(__dirname, "server.mjs")}" start ${port}`,
    cwd: root,
    url: `http://127.0.0.1:${port}/app/files`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
