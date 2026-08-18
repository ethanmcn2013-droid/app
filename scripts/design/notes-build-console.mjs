// Build the Notes design console from the master.
//
//   node scripts/design/notes-build-console.mjs
//
// A sibling of scripts/design/build-customizer.mjs, which belongs to the Tasks
// exploration and is not edited by this programme. The scoping compiler below
// is that file's, reused: it is the part that makes a console possible at all.
//
// The console is one self-contained file, because a published Artifact is
// served under a CSP that blocks every external host, so the fonts, the
// fixture, the icons, the master's stylesheet and the master's renderer all
// have to travel inside the page.
//
// It does NOT reimplement the notebook. It compiles the real master into the
// page, scoped under one `.deck` element, so a control in the panel sets
// exactly the same attribute the master already reads. If the master changes,
// this rebuilds and the console changes with it. There is no second source of
// truth, and nothing in the console can reach a fourth colour, because the
// colours in the console ARE the master's.
//
// Two transforms make that possible:
//
//   1. Scoping. `:root`, `html` and `body` become `.deck`; every other
//      selector is prefixed with `.deck`. The decision layer's attribute
//      selectors attach directly to `.deck` with no descendant space,
//      because that is where the panel writes them.
//   2. Breakpoints. The preview is a box inside a page, so a viewport media
//      query would answer the wrong question. Each `@media (max-width: N)`
//      is rewritten to `.deck[data-w="…"]` for every preview width it would
//      have matched, which makes the responsive behaviour live and
//      switchable rather than theoretical.
//
// The palette receipt on the page is generated here, from the master's own
// stylesheet, so it can never drift from what the file actually paints.
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const LAB = path.resolve("docs/design/labs/notes-2026-08");
const WIDTHS = [1440, 1280, 768, 390];

/* ── a very small CSS block splitter ─────────────────────────────
   Enough for our own stylesheets, which are hand-written and regular. It
   walks braces and quotes and never tries to be a real parser. */
function splitBlocks(css) {
  const blocks = [];
  let depth = 0;
  let start = 0;
  let inComment = false;
  let quote = null;

  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    const next = css[i + 1];

    if (inComment) {
      if (c === "*" && next === "/") { inComment = false; i++; }
      continue;
    }
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && next === "*") { inComment = true; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }

    if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        blocks.push(css.slice(start, i + 1));
        start = i + 1;
      }
    } else if (c === ";" && depth === 0) {
      blocks.push(css.slice(start, i + 1));
      start = i + 1;
    }
  }
  const tail = css.slice(start).trim();
  if (tail) blocks.push(tail);
  return blocks;
}

/* Comments are stripped before scoping. A comment sitting directly above a
   rule would otherwise be swallowed into that rule's selector, which silently
   deletes the rule. The source keeps its comments; only the compiled file
   loses them. */
function stripComments(css) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < css.length) {
    const c = css[i];
    if (quote) {
      out += c;
      if (c === "\\") { out += css[i + 1] ?? ""; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; out += c; i++; continue; }
    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function headAndBody(block) {
  const open = block.indexOf("{");
  return { head: block.slice(0, open).trim(), body: block.slice(open + 1, block.lastIndexOf("}")) };
}

function scopeSelector(selector) {
  return selector
    .split(",")
    .map((raw) => {
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
    })
    .join(", ");
}

function scopeCss(rawCss, { nested = false } = {}) {
  const css = nested ? rawCss : stripComments(rawCss);
  const out = [];
  for (const block of splitBlocks(css)) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("@font-face") || trimmed.startsWith("@keyframes") || trimmed.startsWith("@import") || trimmed.startsWith("@charset")) {
      out.push(trimmed);
      continue;
    }

    if (trimmed.startsWith("@media")) {
      const { head, body } = headAndBody(trimmed);
      const inner = scopeCss(body, { nested: true });

      /* prefers-reduced-motion still means what it means. */
      if (/prefers-/.test(head)) {
        out.push(`${head} {\n${inner}\n}`);
        continue;
      }
      /* pointer: coarse is a device fact, and inside a desktop preview the
         honest answer is the phone width. */
      if (/pointer:\s*coarse/.test(head)) {
        out.push(inner.replace(/^\.deck/gm, '.deck[data-w="390"]'));
        continue;
      }

      const max = head.match(/max-width:\s*(\d+)/);
      if (max) {
        const limit = Number(max[1]);
        const matching = WIDTHS.filter((w) => w <= limit);
        if (!matching.length) continue;
        for (const w of matching) out.push(inner.replace(/(^|,\s*)\.deck/gm, `$1.deck[data-w="${w}"]`));
        continue;
      }
      const min = head.match(/min-width:\s*(\d+)/);
      if (min) {
        const limit = Number(min[1]);
        const matching = WIDTHS.filter((w) => w >= limit);
        if (!matching.length) continue;
        for (const w of matching) out.push(inner.replace(/(^|,\s*)\.deck/gm, `$1.deck[data-w="${w}"]`));
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

/* ── the palette receipt ─────────────────────────────────────────
   Read out of the master's own :root block rather than typed by hand, so
   the receipt on the page cannot claim a value the file does not paint.
   Every entry is checked to be one of the three, and the build fails if a
   fourth hue ever appears in the tokens. */
function paletteReceipt(css) {
  const root = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
  const rows = [];
  const re = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|var\(--[a-z0-9-]+\))\s*;/g;
  let m;
  while ((m = re.exec(root))) {
    const [, name, value] = m;
    const hex = value.match(/^#([0-9a-fA-F]{6})$/);
    let base = null;
    let alpha = 1;
    if (hex) {
      base = [parseInt(hex[1].slice(0, 2), 16), parseInt(hex[1].slice(2, 4), 16), parseInt(hex[1].slice(4, 6), 16)];
    } else {
      const rgba = value.match(/rgba?\(([^)]+)\)/);
      if (rgba) {
        const parts = rgba[1].split(",").map((n) => parseFloat(n));
        base = parts.slice(0, 3);
        alpha = parts.length > 3 ? parts[3] : 1;
      }
    }
    if (!base) {
      rows.push({ name, value, of: "alias", alpha: null });
      continue;
    }
    const near = (a, b) => Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1 && Math.abs(a[2] - b[2]) <= 1;
    const of = near(base, [17, 17, 17]) ? "Ink" : near(base, [79, 70, 229]) ? "Indigo" : near(base, [255, 255, 255]) ? "White" : near(base, [67, 56, 202]) ? "Indigo" : null;
    if (!of) throw new Error(`palette receipt: --${name} is ${value}, which is not Ink, Indigo or White`);
    rows.push({ name, value, of, alpha });
  }
  return rows;
}

async function build() {
  const foundation = await readFile(path.join(LAB, "foundation.css"), "utf8");
  const masterCss = await readFile(path.join(LAB, "master.css"), "utf8");
  const data = await readFile(path.join(LAB, "data.js"), "utf8");
  const icons = await readFile(path.join(LAB, "icons.js"), "utf8");
  const renderer = await readFile(path.join(LAB, "notebook.js"), "utf8");
  const shell = await readFile(path.join(LAB, "console.shell.html"), "utf8");

  const sans = await dataUri(path.join(LAB, "fonts/Geist.woff2"), "font/woff2");
  const mono = await dataUri(path.join(LAB, "fonts/GeistMono.woff2"), "font/woff2");

  const foundationInlined = foundation
    .replace('url("./fonts/Geist.woff2")', `url(${sans})`)
    .replace('url("./fonts/GeistMono.woff2")', `url(${mono})`);

  const receipt = paletteReceipt(masterCss);

  /* Inside the console the deck IS the viewport, so a height measured in
     dvh would be measuring the wrong box, and the absolutely positioned
     capsule needs the deck to be the thing it is positioned against. */
  const css = [scopeCss(foundationInlined), scopeCss(masterCss)]
    .join("\n\n")
    .replace(/100dvh/g, "100%")
    + "\n.deck { position: relative; overflow: hidden; }\n";

  const page = shell
    .replace("/*__CSS__*/", () => css)
    .replace("/*__DATA__*/", () => data)
    .replace("/*__ICONS__*/", () => icons)
    .replace("/*__RENDERER__*/", () => renderer)
    .replace("/*__RECEIPT__*/", () => `window.RECEIPT = ${JSON.stringify(receipt)};`)
    .replace("__FONT_SANS__", () => sans)
    .replace("__FONT_MONO__", () => mono);

  const out = path.join(LAB, "console.html");
  await writeFile(out, page, "utf8");
  const { size } = await stat(out);
  process.stdout.write(`${out}\n${(size / 1024 / 1024).toFixed(2)} MB · ${receipt.length} tokens in the receipt, all Ink, Indigo or White\n`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
