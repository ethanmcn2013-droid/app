// Compile the Design Console from the master.
//
//   node build-console.mjs --lab=<dir>
//
// The console is one self-contained file (published artifacts allow no
// external hosts) and it does NOT reimplement the product. The real master
// is compiled into the page, scoped under one `.deck` element, so a control
// in the panel sets exactly the attribute the master already reads. If the
// master changes, this rebuilds and the console changes with it. There is
// no second source of truth.
//
// Two transforms make that possible:
//   1. Scoping. `:root`, `html` and `body` become `.deck`; every other
//      selector is prefixed with `.deck`. Attribute selectors the decision
//      layer uses ([data-cards="flat"] .card) attach directly to `.deck`,
//      because that is where the panel writes them.
//   2. Breakpoints. The preview is a box inside a page, so a viewport media
//      query would answer the wrong question. Each @media width block is
//      rewritten to `.deck[data-w="…"]` for every preview width it would
//      have matched, which makes responsive behaviour live and switchable.
//
// Masters with a JS runtime export window.__elevate (presets, controls,
// states, setState, mount) and the console drives it. Static CSS-only
// masters work too: the body HTML becomes the deck's content and decisions
// land as data attributes. Console copy (controls, preset copy) can also
// come from elevate.config.json under `console.meta`.
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs, loadLab } from "./lib.mjs";

const args = parseArgs();
const { lab, config } = await loadLab(args);
const WIDTHS = config.console?.widths ?? [1440, 1280, 768, 390];

/* ── a very small CSS block splitter ─────────────────────────────
   Enough for hand-written, regular stylesheets. It walks braces and
   quotes and never tries to be a real parser. */
function splitBlocks(css) {
  const blocks = [];
  let depth = 0, start = 0, inComment = false, quote = null;
  for (let i = 0; i < css.length; i++) {
    const c = css[i], next = css[i + 1];
    if (inComment) { if (c === "*" && next === "/") { inComment = false; i++; } continue; }
    if (quote) { if (c === "\\") { i++; continue; } if (c === quote) quote = null; continue; }
    if (c === "/" && next === "*") { inComment = true; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { blocks.push(css.slice(start, i + 1)); start = i + 1; } }
    else if (c === ";" && depth === 0) { blocks.push(css.slice(start, i + 1)); start = i + 1; }
  }
  const tail = css.slice(start).trim();
  if (tail) blocks.push(tail);
  return blocks;
}

/* Comments are stripped before scoping: a comment directly above a rule
   would otherwise be swallowed into that rule's selector, which silently
   deletes the rule. The source keeps its comments; only the compiled file
   loses them. */
function stripComments(css) {
  let out = "", i = 0, quote = null;
  while (i < css.length) {
    const c = css[i];
    if (quote) {
      out += c;
      if (c === "\\") { out += css[i + 1] ?? ""; i += 2; continue; }
      if (c === quote) quote = null;
      i++; continue;
    }
    if (c === '"' || c === "'") { quote = c; out += c; i++; continue; }
    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    out += c; i++;
  }
  return out;
}

function headAndBody(block) {
  const open = block.indexOf("{");
  return { head: block.slice(0, open).trim(), body: block.slice(open + 1, block.lastIndexOf("}")) };
}

function scopeSelector(selector) {
  return selector.split(",").map((raw) => {
    const one = raw.trim();
    if (!one) return one;
    if (one === ":root" || one === "html" || one === "body" || one === "html, body") return ".deck";
    if (one.startsWith(":root")) return ".deck" + one.slice(5);
    if (one.startsWith("html")) return ".deck" + one.slice(4);
    if (one.startsWith("body")) return ".deck" + one.slice(4);
    /* The decision layer writes its attributes onto .deck itself. */
    if (one.startsWith("[data-")) return ".deck" + one;
    if (one.startsWith("*")) return ".deck " + one;
    return ".deck " + one;
  }).join(", ");
}

function scopeCss(rawCss, { nested = false } = {}) {
  const css = nested ? rawCss : stripComments(rawCss);
  const out = [];
  for (const block of splitBlocks(css)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("@font-face") || trimmed.startsWith("@keyframes") || trimmed.startsWith("@import") || trimmed.startsWith("@charset")) {
      out.push(trimmed); continue;
    }
    if (trimmed.startsWith("@media")) {
      const { head, body } = headAndBody(trimmed);
      const inner = scopeCss(body, { nested: true });
      /* prefers-* still mean what they mean, so they stay real queries. */
      if (/prefers-/.test(head)) { out.push(`${head} {\n${inner}\n}`); continue; }
      /* pointer: coarse is a device fact; inside a desktop preview the
         honest answer is the phone width. */
      if (/pointer:\s*coarse/.test(head)) {
        out.push(inner.replace(/^\.deck/gm, `.deck[data-w="${Math.min(...WIDTHS)}"]`));
        continue;
      }
      const max = head.match(/max-width:\s*(\d+)/);
      if (max) {
        const limit = Number(max[1]);
        for (const w of WIDTHS.filter((w) => w <= limit)) {
          out.push(inner.replace(/(^|,\s*)\.deck/gm, `$1.deck[data-w="${w}"]`));
        }
        continue;
      }
      const min = head.match(/min-width:\s*(\d+)/);
      if (min) {
        const limit = Number(min[1]);
        for (const w of WIDTHS.filter((w) => w >= limit)) {
          out.push(inner.replace(/(^|,\s*)\.deck/gm, `$1.deck[data-w="${w}"]`));
        }
        continue;
      }
      out.push(`${head} {\n${inner}\n}`);
      continue;
    }
    if (trimmed.startsWith("@")) { out.push(trimmed); continue; }
    const { head, body } = headAndBody(trimmed);
    out.push(`${scopeSelector(head)} {${body}}`);
  }
  return out.join("\n");
}

async function dataUri(file, mime) {
  const buffer = await readFile(file);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

const master = await readFile(path.join(lab, config.master), "utf8");
const shell = await readFile(path.join(lab, "console.shell.html"), "utf8");

/* Extract every <style> block, every src-less <script>, and the body. */
const styleBlocks = [...master.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
const scriptBlocks = [...master.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const bodyMatch = master.match(/<body[^>]*>([\s\S]*?)<\/body>/) ?? master.match(/<\/style>([\s\S]*)$/);
let deckHtml = (bodyMatch ? bodyMatch[1] : "")
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .trim();

/* Extra CSS/JS files the engagement lists (fixtures, icon sets, shared
   foundations), inlined in order before the master's own. */
let inlineCss = "";
let inlineJs = "";
for (const rel of config.console?.inline ?? []) {
  const content = await readFile(path.join(lab, rel), "utf8");
  if (rel.endsWith(".css")) inlineCss += content + "\n";
  else inlineJs += content + "\n";
}

/* Fonts: any local woff2 the css references gets inlined as a data URI. */
let allCss = inlineCss + styleBlocks.join("\n");
for (const m of [...allCss.matchAll(/url\(["']?(\.\/[^"')]+\.woff2)["']?\)/g)]) {
  try {
    const uri = await dataUri(path.join(lab, m[1]), "font/woff2");
    allCss = allCss.split(m[0]).join(`url(${uri})`);
  } catch { /* font not in the lab — leave the reference */ }
}

/* Inside the console the deck IS the viewport, so viewport units would
   measure the wrong box, and positioned chrome needs the deck as its
   containing block. */
const css = scopeCss(allCss).replace(/100dvh|100vh/g, "100%") + "\n.deck { position: relative; overflow: hidden; }\n";

const meta = {
  name: config.name,
  palette: config.palette,
  widths: WIDTHS,
  heights: Object.fromEntries(config.viewports.map((v) => [v.width, v.height])),
  states: config.states,
  ...(config.console?.meta ?? {}),
};

const page = shell
  .replace("/*__CSS__*/", () => css)
  .replace("<!--__DECK__-->", () => deckHtml)
  .replace("/*__DATA__*/", () => inlineJs)
  .replace("/*__ICONS__*/", () => "")
  .replace("/*__RENDERER__*/", () => scriptBlocks.join("\n;\n"))
  /* Copy in meta can contain "<" — escaped so it can't close the script block. */
  .replace("/*__META__*/", () => JSON.stringify(meta).replace(/</g, "\\u003c"));

const out = path.join(lab, "console.html");
await writeFile(out, page, "utf8");
const { size } = await stat(out);
process.stdout.write(`${out}\n${(size / 1024 / 1024).toFixed(2)} MB · ${WIDTHS.length} widths · ${config.states.length} states\nRun verify-console.mjs before publishing.\n`);
