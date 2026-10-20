// Explicit browser probe, after Chromium installation; not an early App test
// stage. Explicit local HTTP result fixtures; no screenshots or real delivery.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { after, before, test } from "node:test";
import { chromium, expect } from "@playwright/test";

const root = process.cwd(), require = createRequire(path.join(root, "package.json"));
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");
const sourcePath = "src/modules/timeline/components/artifact/timeline-follow.tsx";
const sourceRef = process.env.TIMELINE_FOCUS_SOURCE_REF;
const controllerSource = sourceRef ? execFileSync("git", ["show", `${sourceRef}:${sourcePath}`], { encoding: "utf8" }) : readFileSync(sourcePath, "utf8");
const records = [];
let browser, server, origin;
const timeline = {
  version: 1, audienceKind: "couple", publicationId: "synthetic-focus-publication", label: "Alex & Sam",
  today: "2026-10-12", lastUpdatedAt: "2026-10-11T12:00:00Z", sections: [{ state: "later", label: "Dates", items: [
    { publicId: "final", title: "Wedding day", state: "later", date: "2026-11-20", presentation: { final: true } },
  ] }],
};

before(async () => {
  const bundle = await build({
    stdin: { resolveDir: root, loader: "tsx", contents: `
      import React from 'react';import {createRoot} from 'react-dom/client';
      import {TimelineFollow,TimelineFollowAction} from './${sourcePath}';
      const timeline=${JSON.stringify(timeline)};
      createRoot(document.getElementById('root')).render(location.search.includes('action')
        ? <TimelineFollowAction inline timeline={timeline} endpoint='/api/action/unsubscribe' undoEndpoint='/api/action/undo' proof='synthetic-proof' label='Following with p***@e***' actionLabel='Unfollow'/>
        : <TimelineFollow shareToken={'A'.repeat(43)} timeline={timeline}/>);` },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", outdir: "unused-focus-bundle",
    loader: { ".module.css": "local-css" }, define: { "process.env.NODE_ENV": '"production"' },
    plugins: sourceRef ? [{ name: "pinned-controller", setup(builder) {
      builder.onLoad({ filter: /[\\/]timeline-follow\.tsx$/ }, () => ({ contents: controllerSource, loader: "tsx", resolveDir: path.join(root, path.dirname(sourcePath)) }));
    } }] : [],
  });
  const js = bundle.outputFiles.find(file => file.path.endsWith(".js")).text;
  const css = bundle.outputFiles.find(file => file.path.endsWith(".css")).text;
  server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    response.setHeader("Cache-Control", "no-store");
    if (pathname === "/app.js") { response.setHeader("Content-Type", "text/javascript"); response.end(js); }
    else if (pathname === "/app.css") { response.setHeader("Content-Type", "text/css"); response.end(css); }
    else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html lang="en"><head><link rel="stylesheet" href="/app.css"></head><body><main><div id="root"></div><button id="outside">Another control</button></main><script src="/app.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, channel: process.env.CI ? undefined : "chrome" });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  if (process.env.TIMELINE_FOCUS_OUTPUT) {
    const output = path.resolve(process.env.TIMELINE_FOCUS_OUTPUT); mkdirSync(path.dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify({
      schemaVersion: "timeline-follow-focus-probe/1", sourceRef: sourceRef ?? "working-tree",
      controllerSha256: createHash("sha256").update(controllerSource.replace(/\r\n?/g, "\n")).digest("hex"),
      scope: "Actual React controller/CSS + explicit local HTTP result fixtures; deterministic early-frame scheduler stress. No backend/auth/email proof.",
      screenshots: 0, realEmailCalls: 0, records,
    }, null, 2) + "\n");
  }
});

async function fixture({ viewport = { width: 1280, height: 800 }, colorScheme = "light", mode = "normal", hold = false, action = false } = {}) {
  const context = await browser.newContext({ viewport, colorScheme });
  const page = await context.newPage(), calls = [], errors = [];
  page.setDefaultTimeout(5000);
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-10-18T12:00:00Z") });
  let release;
  const responseGate = hold ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  await page.route("**/api/**", async route => {
    const request = route.request();
    if (request.method() === "GET") return route.fulfill({ json: { available: true, followAvailable: true, calendar: null } });
    const body = request.postDataJSON(), pathname = new URL(request.url()).pathname;
    const operation = pathname.endsWith("/undo") ? "undo" : pathname.endsWith("/unsubscribe") ? "unsubscribe" : body.operation;
    calls.push(operation);
    if (operation === "subscribe") await responseGate;
    let result;
    if (mode === "unknown") result = { ok: false, code: "delivery_unknown", message: "Delivery could not be confirmed. Use the email link if it arrives.", managementToken: "M".repeat(43) };
    else if (mode === "invalid") result = { ok: false, code: "email_invalid", message: "Enter a valid email address." };
    else if (["subscribe", "change_email", "resend"].includes(operation)) result = { ok: true, state: "pending", confirmationSent: true, managementToken: "M".repeat(43), retryAfterSeconds: 3600 };
    else if (operation === "unsubscribe") result = { ok: true, state: "unsubscribed", undoToken: "U".repeat(43), undoUntil: new Date(await page.evaluate(() => Date.now()) + 10_000).toISOString() };
    else result = { ok: true, state: "confirmed", emailHint: "p***@e***" };
    await route.fulfill({ json: result });
  });
  await page.goto(`${origin}/${action ? "?action" : ""}`);
  if (!action) await page.getByRole("textbox", { name: "Email address" }).waitFor();
  // Install after the controlled clock so that it cannot replace this probe.
  // Service only focus callbacks early; leave browser/test actionability frames
  // untouched. This is a deliberate ordering stress, not native rAF timing.
  await page.evaluate(() => {
    window.__earlyFrames = [];
    const nativeFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      if (!callback.toString().includes(".focus")) return nativeFrame(callback);
      window.__earlyFrames.push({ pendingMounted: !!document.querySelector('[data-follow-state="pending"]'), active: document.activeElement?.tagName });
      callback(performance.now()); return 1;
    };
  });
  return { page, calls, release, close: async () => { release?.(); await context.close(); assert.deepEqual(errors, []); } };
}

const focused = locator => expect(locator).toBeFocused({ timeout: 1500 });
async function subscribe(page, submitLabel = "Follow") {
  await page.getByRole("textbox", { name: "Email address" }).fill("person@example.invalid");
  await page.getByRole("button", { name: submitLabel, exact: true }).click();
  await page.locator('[data-follow-state="pending"]').waitFor();
}

for (const scenario of [
  { name: "light laptop1280", viewport: { width: 1280, height: 800 }, colorScheme: "light" },
  { name: "dark desktop1440", viewport: { width: 1440, height: 810 }, colorScheme: "dark" },
]) test(`pending focus survives a frame before commit: ${scenario.name}`, async () => {
  const f = await fixture(scenario);
  const result = { test: scenario.name, pendingFocus: false };
  try {
    await subscribe(f.page);
    const pending = f.page.getByText(/Check your inbox for/);
    await focused(pending);
    assert.deepEqual(f.calls, ["subscribe"]);
    result.pendingFocus = true;
  } finally {
    records.push({ ...result, calls: [...f.calls], ...await f.page.evaluate(() => ({
      earlyFrames: window.__earlyFrames,
      pendingMounted: !!document.querySelector('[data-follow-state="pending"]'),
      activeElement: { tag: document.activeElement?.tagName, id: document.activeElement?.id, text: document.activeElement?.textContent?.slice(0, 100) },
    })) });
    await f.close();
  }
});

test("validation, repeated invalid button submission and server rejection focus the described field", async () => {
  const f = await fixture();
  try {
    const input = f.page.getByRole("textbox", { name: "Email address" });
    await input.press("Enter"); await expect(f.page.getByRole("alert")).toHaveText("Enter your email address."); await focused(input);
    for (let attempt = 0; attempt < 2; attempt++) {
      await input.fill("not-an-email"); await f.page.getByRole("button", { name: "Follow", exact: true }).click();
      await expect(f.page.getByRole("alert")).toHaveText("Enter a valid email address."); await focused(input);
      assert.ok((await input.getAttribute("aria-describedby")).includes(await f.page.getByRole("alert").getAttribute("id")));
    }
    assert.equal(f.calls.length, 0);
  } finally { await f.close(); }
  const rejected = await fixture({ mode: "invalid" });
  try {
    const input = rejected.page.getByRole("textbox", { name: "Email address" });
    await input.fill("person@example.invalid"); await rejected.page.getByRole("button", { name: "Follow", exact: true }).click();
    await expect(rejected.page.getByRole("alert")).toHaveText("Enter a valid email address."); await focused(input);
    assert.deepEqual(rejected.calls, ["subscribe"]); records.push({ test: "validation", clientPosts: 0, serverRejectionFocused: true });
  } finally { await rejected.close(); }
});

test("confirmed, change-email, Undo and ten-second expiry focus only committed targets", async () => {
  const f = await fixture();
  try {
    await subscribe(f.page);
    await f.page.getByRole("button", { name: "Use a different email" }).click();
    await focused(f.page.getByRole("textbox", { name: "Email address" }));
    await subscribe(f.page, "Change email");
    await f.page.getByRole("button", { name: "Check confirmation" }).click();
    await focused(f.page.getByText("Following as p***@e***"));
    await f.page.getByRole("button", { name: "Unfollow", exact: true }).click();
    await focused(f.page.getByRole("button", { name: "Undo", exact: true }));
    await f.page.getByRole("button", { name: "Undo", exact: true }).click();
    await focused(f.page.getByText("Following as p***@e***"));
    await f.page.getByRole("button", { name: "Unfollow", exact: true }).click();
    await focused(f.page.getByRole("button", { name: "Undo", exact: true }));
    await f.page.clock.fastForward(10_100);
    await focused(f.page.getByRole("textbox", { name: "Email address" }));
    await expect(f.page.getByRole("status")).toHaveText("Undo closed. You can follow again here.");
    records.push({ test: "state-transitions", confirmedFocus: true, undoFocus: true, expiryFocus: true, calls: [...f.calls] });
  } finally { await f.close(); }
});

test("an async response does not steal focus from another control", async () => {
  const f = await fixture({ hold: true });
  try {
    await f.page.getByRole("textbox", { name: "Email address" }).fill("person@example.invalid");
    await f.page.getByRole("button", { name: "Follow", exact: true }).click();
    await expect.poll(() => f.calls.length).toBe(1);
    await f.page.locator("#outside").focus(); f.release();
    await f.page.locator('[data-follow-state="pending"]').waitFor();
    await focused(f.page.locator("#outside")); records.push({ test: "user-moved-focus", preserved: true });
  } finally { await f.close(); }
});

test("unknown delivery focuses its status and never automatically sends again", async () => {
  const f = await fixture({ mode: "unknown" });
  try {
    await f.page.getByRole("textbox", { name: "Email address" }).fill("person@example.invalid");
    await f.page.getByRole("button", { name: "Follow", exact: true }).click();
    await f.page.locator('[data-follow-state="unknown"]').waitFor(); await focused(f.page.getByRole("status"));
    await expect(f.page.getByRole("button", { name: "Resend confirmation" })).toHaveCount(0);
    await f.page.clock.fastForward(60_000); assert.deepEqual(f.calls, ["subscribe"]);
    records.push({ test: "unknown-send", statusFocused: true, posts: [...f.calls], automaticRetries: 0 });
  } finally { await f.close(); }
});

test("signed subscriber actions focus Undo, restored label and expiry status after commit", async () => {
  const f = await fixture({ action: true });
  try {
    await f.page.getByRole("button", { name: "Unfollow", exact: true }).click();
    await focused(f.page.getByRole("button", { name: "Undo", exact: true }));
    await f.page.getByRole("button", { name: "Undo", exact: true }).click();
    await focused(f.page.getByText("Following with p***@e***"));
    await f.page.getByRole("button", { name: "Unfollow", exact: true }).click();
    await focused(f.page.getByRole("button", { name: "Undo", exact: true }));
    await f.page.clock.fastForward(10_100); await focused(f.page.getByRole("status"));
    records.push({ test: "signed-actions", undoAndExpiryFocus: true, calls: [...f.calls] });
  } finally { await f.close(); }
});
