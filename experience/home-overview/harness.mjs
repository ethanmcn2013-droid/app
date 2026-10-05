/**
 * Shared by the Home and Overview browser checks: bundle a fixture page with
 * the real components, styles and v3 tokens, stub only the seams that need a
 * server, and serve it to Chromium from memory. No dev server, no database,
 * no network.
 */

import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx/package.json"))("esbuild");
const { chromium } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");

export const VIEWPORTS = {
  wide: { width: 1920, height: 1080 },
  desk: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 390, height: 844 },
};

/** Words the product does not say, plus the two marks it does not use. */
export const BANNED = /\b(sprint|epic|backlog|stakeholder|kanban|burndown|velocity|workflow|dashboard|deliverable|okr|swimlane|ledger|milestone|roadmap|overdue)\b|!|—/i;

const FONTS = {
  "Geist-Variable.woff2": "node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  "GeistMono-Variable.woff2": "node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
};

export function captureArgs(defaultDir) {
  const at = process.argv.indexOf("--capture");
  const arg = at !== -1 ? process.argv[at + 1] : undefined;
  return { capture: at !== -1, outDir: path.resolve(root, arg && !arg.startsWith("--") ? arg : defaultDir) };
}

export async function bundleFixture(entry, stubs) {
  const plugin = {
    name: "server-seams",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => (stubs.has(args.path) ? { path: args.path, namespace: "fixture-stub" } : undefined));
      build.onLoad({ filter: /.*/, namespace: "fixture-stub" }, (args) => ({ contents: stubs.get(args.path), loader: "js", resolveDir: root }));
    },
  };
  const bundle = await esbuild.build({
    entryPoints: [path.join(root, entry)],
    absWorkingDir: root,
    outdir: path.join(root, "experience/output/home-overview/bundle"),
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    alias: { "@": path.join(root, "src") },
    loader: { ".module.css": "local-css", ".css": "css" },
    external: ["/fonts/*"],
    plugins: [plugin],
    logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  return {
    js: bundle.outputFiles.find((file) => file.path.endsWith(".js")).text,
    css: bundle.outputFiles.find((file) => file.path.endsWith(".css")).text,
  };
}

export function createRunner({ js, css, origin, title, capture, outDir }) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
  const run = { checks: 0, shots: [], browser: null };

  run.launch = async () => {
    run.browser = await chromium.launch({ headless: true });
  };
  run.close = async () => run.browser?.close();

  run.open = async ({ viewport, theme, state = "busy", query = "", reducedMotion = "reduce", timezoneId }) => {
    const phone = viewport === "phone";
    const context = await run.browser.newContext({
      viewport: VIEWPORTS[viewport],
      colorScheme: theme,
      reducedMotion,
      deviceScaleFactor: 1,
      hasTouch: phone,
      isMobile: phone,
      ...(timezoneId ? { timezoneId } : {}),
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.route(`${origin}/**`, (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/app.js") return route.fulfill({ contentType: "text/javascript", body: js });
      if (url.pathname === "/app.css") return route.fulfill({ contentType: "text/css", body: css });
      const font = FONTS[url.pathname.replace("/fonts/", "")];
      if (font) return route.fulfill({ contentType: "font/woff2", body: readFileSync(path.join(root, font)) });
      return route.fulfill({ contentType: "text/html", body: html });
    });
    await page.goto(`${origin}/?state=${state}&theme=${theme}${query}`);
    await page.evaluate(() => document.fonts.ready);
    return { page, context, errors, label: `${state}-${viewport}-${theme}` };
  };

  run.shot = async (page, name, { fullPage = false } = {}) => {
    if (!capture) return;
    mkdirSync(outDir, { recursive: true });
    if (fullPage) {
      // The page scrolls inside its own frame, as it does in the app's shell;
      // let the frame grow so the capture holds all of it.
      await page.addStyleTag({ content: ".fixture-shell{height:auto !important}.fixture-page-flush{overflow:visible !important}.fixture-page-flush > *{overflow:visible !important;flex:none !important}" });
    }
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage });
    run.shots.push(`${name}.png`);
  };

  run.axe = async (page, label) => {
    const result = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(
      result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => node.target.join(" ")).slice(0, 4) })),
      [],
      `axe: ${label}`,
    );
    run.checks += 1;
  };

  run.noSidewaysScroll = async (page, label) => {
    const overflow = await page.evaluate(() => {
      const wide = [...document.querySelectorAll("#root *")].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "hidden" && getComputedStyle(el).overflowX !== "clip" && !el.closest("[data-scrolls-sideways]"));
      return { page: document.scrollingElement.scrollWidth - window.innerWidth, inner: wide.map((el) => el.className).slice(0, 3) };
    });
    assert.ok(overflow.page <= 0, `${label}: the page scrolls sideways by ${overflow.page}px`);
    assert.deepEqual(overflow.inner, [], `${label}: something inside the page scrolls sideways`);
    run.checks += 2;
  };

  return run;
}

export const text = (value) => value.replace(/\s+/g, " ").trim();
