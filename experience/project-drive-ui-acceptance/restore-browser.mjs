import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

// Local component evidence only. The review view uses fictional status data and
// no server action, database, OAuth, or Google provider imports.
const root = process.cwd();
const output = process.argv[2];
if (!output || !path.isAbsolute(output) || fs.existsSync(output)) {
  throw new Error("Pass a fresh absolute output directory");
}
const require = createRequire(path.join(root, "package.json"));
const esbuild = createRequire(require.resolve("tsx/package.json"))("esbuild");
const { chromium, expect } = require("@playwright/test");
const bundle = await esbuild.build({
  stdin: {
    contents: `import React from "react";
      import { createRoot } from "react-dom/client";
      import { ConnectionsReview } from "./src/components/app/settings/sections/connections-review";
      createRoot(document.getElementById("root")).render(<ConnectionsReview />);`,
    resolveDir: root,
    sourcefile: "restore-review-entry.tsx",
    loader: "tsx",
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  alias: { "@": path.join(root, "src") },
  define: { "process.env.NODE_ENV": '"production"' },
});
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((request, response) => {
  if (request.url === "/review.js") {
    response.setHeader("Content-Type", "application/javascript");
    return response.end(bundle.outputFiles[0].contents);
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body{margin:0;background:#fafafa;color:#202020;font:14px/1.5 system-ui,sans-serif}
    main{box-sizing:border-box;max-width:820px;margin:auto;padding:20px}
    section{margin-bottom:16px}button,select{font:inherit;min-height:44px;cursor:pointer}
    button{border:1px solid #aaa;border-radius:6px;padding:8px 12px;background:white}
    button:focus-visible,select:focus-visible{outline:2px solid #245ac2}
  </style></head><body><main id="root"></main><script src="/review.js"></script></body></html>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const receipt = {
  source: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  fixture: "Actual ConnectionsReview and ConnectionsView; synthetic review states and minimal fixture CSS",
  providerCalls: false,
  cases: [], errors: [], externalRequests: [],
};
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin !== origin) {
        receipt.externalRequests.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", error => receipt.errors.push(String(error)));
    page.on("console", message => { if (message.type() === "error") receipt.errors.push(message.text()); });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    const state = page.getByLabel("Review state");
    const restore = page.getByRole("button", { name: "Check and restore this board’s Drive" });
    await state.selectOption("restore-unavailable");
    await expect(restore).toHaveCount(0);
    await expect(page.getByText("This board’s Drive needs attention.", { exact: false })).toBeVisible();
    await page.screenshot({ path: path.join(output, `restore-unavailable-${viewport.width}.png`), fullPage: true });
    receipt.cases.push({ viewport: viewport.width, state: "restore-unavailable", buttonCount: 0 });
    await state.selectOption("restore-ready");
    await expect(restore).toBeVisible();
    await expect(restore).toBeEnabled();
    await restore.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Review only. No Google request was made.")).toBeVisible();
    await page.screenshot({ path: path.join(output, `restore-ready-${viewport.width}.png`), fullPage: true });
    receipt.cases.push({ viewport: viewport.width, state: "restore-ready", buttonCount: 1, keyboardActivated: true, minimumHitHeight: await restore.evaluate(node => node.getBoundingClientRect().height) });
    await context.close();
  }
  if (receipt.errors.length || receipt.externalRequests.length) throw new Error("Browser console or external request failure");
  receipt.passed = true;
} catch (error) {
  receipt.passed = false;
  receipt.failure = String(error);
  throw error;
} finally {
  receipt.completedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({ passed: receipt.passed, cases: receipt.cases.length, errors: receipt.errors.length, externalRequests: receipt.externalRequests.length }));
