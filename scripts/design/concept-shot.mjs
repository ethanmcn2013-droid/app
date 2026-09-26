#!/usr/bin/env node
/**
 * Screenshot one page of the running review-mode dev server.
 *
 *   node scripts/design/concept-shot.mjs <app/path> <out.png> [width] [height] [light|dark]
 *
 * The path takes no leading slash (Git Bash rewrites one). The server is
 * http://localhost:$CONCEPT_PORT (default 3217), started with
 *   NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true pnpm exec next dev --port 3217
 * Review mode needs no secrets and never touches a database.
 */
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { chromium } = require("@playwright/test");

const [, , rawPath, out, w = "1440", h = "900", theme = "light"] = process.argv;
if (!rawPath || !out) {
  console.error("usage: concept-shot.mjs <app/path> <out.png> [width] [height] [light|dark]");
  process.exit(2);
}
const port = process.env.CONCEPT_PORT ?? "3217";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, colorScheme: theme });
await page.goto(`http://localhost:${port}/${rawPath.replace(/^\/+/, "")}`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("h1", { timeout: 90_000 }).catch(() => console.log("no h1 found"));
await page.waitForTimeout(3000);
await page.screenshot({ path: out });
await browser.close();
console.log("saved", out);
