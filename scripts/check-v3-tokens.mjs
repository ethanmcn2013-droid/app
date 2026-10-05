#!/usr/bin/env node
/**
 * The v3 token layer reaches the stylesheet people are served.
 *
 * WHY THIS EXISTS. On 5 October 2026 the v3 shell went to production and
 * every surface lost its background, border and card: the global stylesheet
 * the deployment served used `var(--v3-*)` in dozens of places and defined
 * none of them, because the contents of src/ds/v3.css were not in it. The
 * same commit rendered correctly in `next dev` and in a local production
 * build, and no gate looked at the compiled CSS, so nothing failed.
 *
 * WHAT IT CHECKS, in two modes:
 *
 *   node scripts/check-v3-tokens.mjs
 *     Compiles src/app/globals.css the way production does (the project's
 *     PostCSS plugin, NODE_ENV=production) and reads the result. Part of
 *     `pnpm test`.
 *
 *   node scripts/check-v3-tokens.mjs --built [dir]
 *     Reads the CSS a finished `next build` emitted (default .next/static).
 *     Runs before the browser checks that use that build.
 *
 * Both fail when:
 *   1. a token src/ds/v3.css defines is not defined in the output;
 *   2. the output has no light block, no dark block or no in-app light block;
 *   3. any `var(--v3-*)` used in the output, or in a stylesheet or component
 *      under src/, names a token that is defined nowhere.
 *
 * A custom property that is used and never defined is not an error to a
 * browser: the declaration is quietly dropped. That is why this is a gate.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const built = args.includes("--built");
const builtDir = path.resolve(root, args.find((a) => !a.startsWith("--")) ?? path.join(".next", "static"));

const V3_SOURCE = path.join(root, "src", "ds", "v3.css");
const GLOBALS = path.join(root, "src", "app", "globals.css");

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const definedIn = (css) => new Set([...css.matchAll(/(--v3-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
// A complete name only: `var(--v3-project-${n})` in a template is a family,
// not a token, and its members are checked where they are written out.
const usedIn = (text) => new Set([...text.matchAll(/var\(\s*(--v3-[a-z0-9-]+)\s*[,)]/g)].map((m) => m[1]));

function walk(dir, test, out = []) {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) walk(file, test, out);
    else if (test(file)) out.push(file);
  }
  return out;
}

async function compileGlobals() {
  process.env.NODE_ENV = "production";
  const req = createRequire(path.join(root, "package.json"));
  const pluginPath = req.resolve("@tailwindcss/postcss");
  const postcss = createRequire(pluginPath)("postcss");
  const plugin = req("@tailwindcss/postcss");
  const result = await postcss([(plugin.default ?? plugin)()]).process(readFileSync(GLOBALS, "utf8"), {
    from: GLOBALS,
  });
  return result.css;
}

function readBuilt() {
  if (!existsSync(builtDir)) {
    throw new Error(`no build output at ${path.relative(root, builtDir)}: run next build first`);
  }
  const files = walk(builtDir, (file) => file.endsWith(".css"));
  if (files.length === 0) throw new Error(`no CSS under ${path.relative(root, builtDir)}`);
  return { css: files.map((file) => readFileSync(file, "utf8")).join("\n"), files };
}

const failures = [];
const label = built ? `built CSS (${path.relative(root, builtDir)})` : "compiled src/app/globals.css";

let output;
let fileCount = 1;
try {
  if (built) {
    const read = readBuilt();
    output = read.css;
    fileCount = read.files.length;
  } else {
    output = await compileGlobals();
  }
} catch (error) {
  console.error(`check-v3-tokens: FAILED to read the ${label}: ${error.message}`);
  process.exit(1);
}
output = stripComments(output);

// 1. Every token the layer defines is defined in the output.
const source = stripComments(readFileSync(V3_SOURCE, "utf8"));
const sourceTokens = definedIn(source);
if (sourceTokens.size < 40) failures.push(`src/ds/v3.css defines only ${sourceTokens.size} tokens; the layer looks truncated`);
const outputTokens = definedIn(output);
const missing = [...sourceTokens].filter((token) => !outputTokens.has(token)).sort();
if (missing.length > 0) {
  failures.push(
    `${missing.length} of ${sourceTokens.size} tokens defined in src/ds/v3.css are not defined in the ${label}: ` +
      `${missing.slice(0, 12).join(", ")}${missing.length > 12 ? ", ..." : ""}`,
  );
}

// 2. All three blocks are present, each carrying the page ground.
const blocks = [
  ["light (every document)", /html:root\{[^}]*--v3-canvas:/],
  ["dark", /html:root\[data-theme="?dark"?\]\{[^}]*--v3-canvas:/],
  ["light inside the app", /html:root\[data-theme="?light"?\]\{[^}]*--v3-canvas:/],
];
const compact = output.replace(/\s+/g, " ").replace(/\s*([{}:;,])\s*/g, "$1");
for (const [name, pattern] of blocks) {
  if (!pattern.test(compact)) failures.push(`the ${name} block is missing from the ${label}`);
}

// 3. Nothing uses a v3 token that is defined nowhere. Components may scope
// a token of their own (the sidebar does), so definitions are gathered from
// the output and from every stylesheet under src/.
const sourceFiles = walk(path.join(root, "src"), (file) => /\.(css|tsx|ts)$/.test(file) && !/\.test\./.test(file));
const allDefined = new Set(outputTokens);
const usedBy = new Map();
const note = (token, where) => {
  if (!usedBy.has(token)) usedBy.set(token, where);
};
for (const token of usedIn(output)) note(token, label);
for (const file of sourceFiles) {
  const text = stripComments(readFileSync(file, "utf8"));
  if (file.endsWith(".css")) for (const token of definedIn(text)) allDefined.add(token);
  // Inline styles and Tailwind arbitrary values define tokens too: [--v3-x:...]
  for (const match of text.matchAll(/["'[\s{](--v3-[a-z0-9-]+)["']?\s*:/g)) allDefined.add(match[1]);
  for (const token of usedIn(text)) note(token, path.relative(root, file));
}
const undefinedTokens = [...usedBy.keys()].filter((token) => !allDefined.has(token)).sort();
for (const token of undefinedTokens) {
  failures.push(`${token} is used (${usedBy.get(token)}) and defined nowhere`);
}

if (failures.length > 0) {
  console.error(`check-v3-tokens: ${failures.length} failure(s) in the ${label}`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(
    "  A page built from this stylesheet renders with no surfaces, borders or chrome. Do not ship it.",
  );
  process.exit(1);
}
console.log(
  `check-v3-tokens: ok - ${sourceTokens.size} tokens from src/ds/v3.css defined in the ${label}` +
    `${built ? ` (${fileCount} files)` : ""}; light, dark and in-app light blocks present; ` +
    `${usedBy.size} tokens in use, none undefined`,
);
