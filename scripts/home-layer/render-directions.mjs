#!/usr/bin/env node
/**
 * Home operating-layer · offline direction captures.
 *
 * WHY THIS EXISTS AT ALL. The four directions cannot be reached over HTTP on a
 * development machine, and that is correct rather than broken. `lab/policy.ts`
 * refuses in this order — flag-off, seed-data-posture, not-authenticated,
 * not-a-reviewer, granted — and every local server runs in a seed-data access
 * posture, so `labAccessDecision` returns `seed-data-posture` and the route
 * renders a genuine 404. A live 200 needs production posture, real Clerk keys
 * and a signed-in reviewer. Nothing here weakens that: this script never asks
 * the guard anything, because it never makes a request. It drives the same
 * components the route drives, in process, and supplies the guard's decision
 * inputs by not having a guard in the path at all.
 *
 * WHAT IT DOES, in the order it does it.
 *
 *   1. Assembles props through the REAL lab shell — `parseLabUrl` then
 *      `assembleCandidateProps` then `withCandidateVariant` — exactly as
 *      `src/app/lab/home-operating-layer/page.tsx` does. `assembleCandidateProps`
 *      takes a `LabViewState`, which has no `v` on it, so the four directions
 *      are provably handed one object built from one input. That fairness
 *      guarantee is enforced by the type; this script does not go around it.
 *   2. Renders the real candidate components with `react-dom/server`.
 *   3. Writes one standalone HTML file per capture with the real styling
 *      inlined: `src/app/globals.css` compiled through the app's own Tailwind
 *      pipeline (which resolves `@import "tailwindcss"`, `src/ds/tokens.css`,
 *      `src/ds/theme-overrides.css` and `src/ds/tailwind.css`), then
 *      `lab-chrome.css`, then the candidate's own stylesheet, in the same
 *      order the Next build would cascade them. Geist and Geist Mono are
 *      embedded as data URIs from the `geist` package, so `var(--font-sans)`
 *      resolves to the real face rather than to a system fallback.
 *   4. Screenshots each file with Playwright's chromium at 1440x960 and
 *      390x844, full page and again clipped to the fold.
 *
 * WHY THE STYLING IS FAITHFUL AND NOT APPROXIMATED. The four candidate
 * stylesheets are plain CSS: no `@import`, no `@apply`, no `@theme`, no
 * nesting, and the candidates use no Tailwind utility classes at all (every
 * class is prefixed `ed-`, `rl-`, `ri-`/`ix-` or `dk-`). So inlining them
 * verbatim is not an approximation of the build output, it IS the build
 * output. The only stylesheet that needs compiling is `globals.css`, and it is
 * compiled by the same `@tailwindcss/postcss` plugin `postcss.config.mjs`
 * names. If that compile ever fails this script exits non-zero rather than
 * writing an unstyled page, because a beautiful direction captured without its
 * CSS looks broken, and shipping that as design evidence would misinform a
 * decision.
 *
 * RUN IT:
 *   node scripts/home-layer/render-directions.mjs
 *
 * It re-executes itself under tsx (the candidates are TypeScript), so there is
 * no loader flag to remember.
 *
 * OPTIONS:
 *   --out <dir>          output directory (default docs/projects/home-operating-layer/design/lab-evidence)
 *   --candidates a,b     restrict to these candidate slugs
 *   --no-screenshots     write HTML only
 *   --no-fold            skip the fold-clipped screenshots
 *   --scale <n>          device scale factor (default 1)
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(HERE), "..", "..");

// ── Re-exec under tsx ───────────────────────────────────────────────────────
//
// The candidates are .tsx. tsx transpiles them to CommonJS, which is also what
// makes the synchronous `registerHooks` resolver below able to intercept their
// stylesheet imports: those become `require` calls, and the async loader chain
// does not see them. Same technique, and the same reason, as
// `src/lib/home-layer/lab/testing/register-lab-stubs.mjs`.
if (process.env.HOME_LAYER_RENDER_CHILD !== "1") {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", HERE, ...process.argv.slice(2)],
    {
      stdio: "inherit",
      cwd: REPO_ROOT,
      env: { ...process.env, HOME_LAYER_RENDER_CHILD: "1" },
    },
  );
  process.exit(result.status ?? 1);
}

// ── Arguments ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const flags = new Set();
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`unexpected argument "${token}"`);
    const name = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) flags.add(name);
    else {
      values[name] = next;
      index += 1;
    }
  }
  return { flags, values };
}

const args = parseArgs(process.argv.slice(2));
const OUT_DIR = path.resolve(
  REPO_ROOT,
  args.values.out ?? "docs/projects/home-operating-layer/design/lab-evidence",
);
const WANT_SCREENSHOTS = !args.flags.has("no-screenshots");
const WANT_FOLD = !args.flags.has("no-fold");
const SCALE = Number(args.values.scale ?? 1);

// ── The capture matrix ──────────────────────────────────────────────────────
//
// Every candidate gets the identical list, because the point of the exercise is
// comparison and a matrix that differs per direction is not one.

const SIGNATURE_SCENARIO = "owner_signature";
const MODES = ["today", "inbox", "my-work", "analytics", "briefing"];
const SCENARIOS = ["owner_quiet", "partial_coverage", "provider_failure", "new_user", "scale"];
const VIEWPORTS = [
  { name: "1440x960", width: 1440, height: 960 },
  { name: "390x844", width: 390, height: 844 },
];

const CAPTURES = [
  ...MODES.map((mode) => ({ mode, scenario: SIGNATURE_SCENARIO })),
  ...SCENARIOS.map((scenario) => ({ mode: "today", scenario })),
];

// ── Module resolution for an in-process render ──────────────────────────────
//
// Three specifiers have to be swapped so real route components can run outside
// a Next build. Nothing about the lab's own logic is stubbed: the shell, the
// fixtures and the four candidates are the real modules.
//
//   *.css                     → empty module. Next turns these imports into
//                               stylesheet emission; here they carry no runtime
//                               value and the CSS is inlined separately, read
//                               from the same files.
//   server-only / client-only → empty module. There is no client bundle here.
//   @/…                       → the tsconfig path alias. tsx resolves it for
//                               files inside the `include` globs, and `scripts`
//                               is explicitly excluded from tsconfig.json, so
//                               this entry point has to resolve it itself.

const EMPTY_MODULE = pathToFileURL(path.join(REPO_ROOT, "src/test/server-only-stub.cjs")).href;
const ALIAS_EXTENSIONS = ["", ".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only" || specifier === "client-only") {
      return { url: EMPTY_MODULE, shortCircuit: true };
    }
    if (specifier.endsWith(".css")) {
      return { url: EMPTY_MODULE, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const base = path.join(REPO_ROOT, "src", specifier.slice(2));
      for (const extension of ALIAS_EXTENSIONS) {
        if (existsSync(base + extension)) {
          return { url: pathToFileURL(base + extension).href, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

const fromRoot = (relative) => pathToFileURL(path.join(REPO_ROOT, relative)).href;

// ── The stylesheet ──────────────────────────────────────────────────────────

/**
 * Compile `src/app/globals.css` through the app's own Tailwind pipeline.
 *
 * Throws rather than degrades. A caller that catches this and writes the page
 * anyway would be publishing a screenshot of unstyled HTML under a filename
 * that says it is a design capture.
 */
async function compileGlobals() {
  const require = createRequire(path.join(REPO_ROOT, "package.json"));
  const pluginPath = require.resolve("@tailwindcss/postcss");
  const postcss = createRequire(pluginPath)("postcss");
  const loaded = require("@tailwindcss/postcss");
  const tailwind = loaded.default ?? loaded;
  const input = path.join(REPO_ROOT, "src/app/globals.css");
  const result = await postcss([tailwind({ optimize: true })]).process(readFileSync(input, "utf8"), {
    from: input,
    to: path.join(OUT_DIR, "globals.css"),
  });
  if (!result.css.includes("--paper")) {
    throw new Error("globals.css compiled without the design tokens; refusing to write unstyled captures");
  }
  return result.css;
}

/**
 * Geist and Geist Mono, embedded.
 *
 * The app exposes them through next/font as `--font-geist-sans` and
 * `--font-geist-mono`, which do not exist outside a Next render. `tokens.css`
 * writes `var(--font-geist-sans, "Geist"), "Geist", system-ui, …`, so declaring
 * the family under its plain name is enough for the real face to win — the
 * fallback chain in the vendored tokens is doing the work, not a substitution
 * invented here.
 */
function fontFaces() {
  // Read straight out of node_modules rather than through `require.resolve`:
  // the `geist` package's `exports` map does not expose `./package.json` or the
  // font directory, so there is no specifier to resolve. The files are a
  // published part of the package and their paths are stable.
  const geistRoot = path.join(REPO_ROOT, "node_modules/geist");
  const faces = [
    { family: "Geist", file: "dist/fonts/geist-sans/Geist-Variable.woff2" },
    { family: "Geist Mono", file: "dist/fonts/geist-mono/GeistMono-Variable.woff2" },
  ];
  return faces
    .map(({ family, file }) => {
      const full = path.join(geistRoot, file);
      if (!existsSync(full)) throw new Error(`missing font file ${full}`);
      const base64 = readFileSync(full).toString("base64");
      return [
        "@font-face{",
        `font-family:"${family}";`,
        "font-style:normal;",
        "font-weight:100 900;",
        "font-display:block;",
        `src:url(data:font/woff2;base64,${base64}) format("woff2");`,
        "}",
      ].join("");
    })
    .join("\n");
}

const CANDIDATE_CSS = {
  editorial: "src/app/lab/home-operating-layer/candidates/editorial/editorial.css",
  rail: "src/app/lab/home-operating-layer/candidates/rail/rail.css",
  index: "src/app/lab/home-operating-layer/candidates/index/reading-index.css",
  desk: "src/app/lab/home-operating-layer/candidates/desk/desk.css",
};

// ── The page ────────────────────────────────────────────────────────────────

const escapeHtml = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The document the route would have produced, minus Next.
 *
 * `<html>` and `<body>` carry the same classes `src/app/layout.tsx` sets, and
 * the stage carries the same wrapper `page.tsx` renders in capture mode:
 * `<div class="lab-stage">` with the theme's colour-scheme on it and no review
 * chrome in the document at all.
 */
function documentFor({ title, styles, markup, theme }) {
  return `<!doctype html>
<html lang="en" class="h-full antialiased"${theme === "dark" ? ' data-theme="dark"' : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(title)}</title>
<style>${styles.fonts}</style>
<style>${styles.globals}</style>
<style>${styles.labChrome}</style>
<style>${styles.candidate}</style>
</head>
<body class="min-h-full flex flex-col">
<div class="lab-stage"${theme === "dark" ? ' data-theme="dark"' : ""} style="color-scheme:${theme}">${markup}</div>
</body>
</html>
`;
}

// ── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const shell = await import(fromRoot("src/lib/home-layer/lab-shell/index.ts"));
  const {
    LAB_VARIANTS,
    assembleCandidateProps,
    parseLabUrl,
    scenarioScopeOf,
    withCandidateVariant,
  } = shell;

  const wanted = args.values.candidates
    ? new Set(args.values.candidates.split(",").map((entry) => entry.trim()))
    : null;
  const variants = LAB_VARIANTS.filter((variant) => !wanted || wanted.has(variant.slug));

  console.log("compiling src/app/globals.css through @tailwindcss/postcss …");
  const globals = await compileGlobals();
  const fonts = fontFaces();
  const labChrome = readFileSync(
    path.join(REPO_ROOT, "src/app/lab/home-operating-layer/lab-chrome.css"),
    "utf8",
  );
  console.log(`  globals ${globals.length} bytes · fonts ${fonts.length} bytes · lab chrome ${labChrome.length} bytes`);

  /**
   * The props, assembled ONCE per capture and shared by all four directions.
   *
   * This is the fairness guarantee made operational: the same frozen object
   * reaches every candidate, decorated only with which candidate is on screen,
   * which changes navigation and never a number or a sentence.
   */
  const propsFor = new Map();
  for (const capture of CAPTURES) {
    const key = `${capture.mode}__${capture.scenario}`;
    const parsed = parseLabUrl(`mode=${capture.mode}&scenario=${capture.scenario}`, scenarioScopeOf);
    propsFor.set(key, {
      state: parsed.state,
      notices: parsed.notices,
      base: assembleCandidateProps({ state: parsed.state }),
    });
  }

  const results = [];

  for (const variant of variants) {
    let component = null;
    let loadError = null;
    try {
      const module = await import(
        fromRoot(`src/app/lab/home-operating-layer/candidates/${variant.slug}/candidate.tsx`)
      );
      component = module.default;
      if (typeof component !== "function") {
        loadError = `candidate.tsx default export is ${typeof component}, not a component`;
        component = null;
      }
    } catch (error) {
      loadError = error?.stack ?? String(error);
    }

    const cssPath = CANDIDATE_CSS[variant.slug];
    const candidateCss = cssPath ? readFileSync(path.join(REPO_ROOT, cssPath), "utf8") : "";

    for (const capture of CAPTURES) {
      const key = `${capture.mode}__${capture.scenario}`;
      const slug = `${variant.slug}__${capture.mode}__${capture.scenario}`;
      const record = {
        candidate: variant.slug,
        label: variant.label,
        mode: capture.mode,
        scenario: capture.scenario,
        html: null,
        htmlBytes: 0,
        markupBytes: 0,
        shots: [],
        error: loadError,
      };

      if (component) {
        try {
          const held = propsFor.get(key);
          const props = withCandidateVariant(held.base, variant.v);
          const markup = renderToStaticMarkup(React.createElement(component, props));
          record.markupBytes = markup.length;
          const html = documentFor({
            title: `${variant.label} · ${capture.mode} · ${capture.scenario}`,
            styles: { fonts, globals, labChrome, candidate: candidateCss },
            markup,
            theme: "light",
          });
          const htmlPath = path.join(OUT_DIR, `${slug}.html`);
          writeFileSync(htmlPath, html);
          record.html = path.basename(htmlPath);
          record.htmlBytes = html.length;
        } catch (error) {
          record.error = error?.stack ?? String(error);
        }
      }

      if (record.error) console.error(`  FAIL ${slug}: ${String(record.error).split("\n")[0]}`);
      else console.log(`  ok   ${slug} (${record.markupBytes} bytes of markup)`);
      results.push(record);
    }
  }

  if (WANT_SCREENSHOTS) await screenshot(results);

  writeFileSync(
    path.join(OUT_DIR, "index.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        generator: "scripts/home-layer/render-directions.mjs",
        note: "Rendered offline with react-dom/server. No HTTP request, no guard bypass, no fixture edited.",
        matrix: { modes: MODES, signatureScenario: SIGNATURE_SCENARIO, scenarios: SCENARIOS, viewports: VIEWPORTS },
        captures: results.map((entry) => ({ ...entry, error: entry.error ? String(entry.error).split("\n")[0] : null })),
      },
      null,
      2,
    )}\n`,
  );

  const failed = results.filter((entry) => entry.error);
  console.log(
    `\n${results.length - failed.length}/${results.length} pages rendered · ` +
      `${results.reduce((total, entry) => total + entry.shots.length, 0)} screenshots`,
  );
  if (failed.length > 0) {
    console.error(`${failed.length} captures failed:`);
    for (const entry of failed) console.error(`  ${entry.candidate}/${entry.mode}/${entry.scenario}`);
    process.exitCode = 1;
  }
}

async function screenshot(results) {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: SCALE,
        colorScheme: "light",
      });
      const page = await context.newPage();
      for (const record of results) {
        if (!record.html) continue;
        const file = pathToFileURL(path.join(OUT_DIR, record.html)).href;
        try {
          await page.goto(file, { waitUntil: "load" });
          // Fonts first, then a beat for entrance animations to land on their
          // final frame. A capture taken mid-animation is a capture of a state
          // no reader ever sees.
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(700);
          const stem = record.html.replace(/\.html$/, "");
          const full = `${stem}__${viewport.name}.png`;
          await page.screenshot({ path: path.join(OUT_DIR, full), fullPage: true });
          record.shots.push(full);
          if (WANT_FOLD) {
            const fold = `${stem}__${viewport.name}__fold.png`;
            await page.screenshot({ path: path.join(OUT_DIR, fold), fullPage: false });
            record.shots.push(fold);
          }
        } catch (error) {
          console.error(`  shot FAIL ${record.html} @ ${viewport.name}: ${String(error).split("\n")[0]}`);
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

await main();
