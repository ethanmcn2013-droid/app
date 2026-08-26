// Build the interactive customizer from the master.
//
//   node scripts/design/build-customizer.mjs
//
// The customizer is the final deliverable and it must be one self-contained
// file: a published Artifact is served under a CSP that blocks every external
// host, so the fonts, the fixture, the icons, the master's stylesheet and the
// master's renderer all have to travel inside the page.
//
// It does NOT reimplement the board. It compiles the real master
// (floor.html) into the page, scoped under one `.deck` element, so a control
// in the panel sets exactly the same attribute the master already reads. If
// the master changes, this rebuilds and the customizer changes with it. There
// is no second source of truth.
//
// Two transforms make that possible:
//
//   1. Scoping. `:root`, `html` and `body` become `.deck`; every other
//      selector is prefixed with `.deck`. Attribute selectors that the
//      decision layer uses (`[data-cards="flat"] .card`) attach directly to
//      `.deck` with no descendant space, because that is where the panel
//      writes them.
//   2. Breakpoints. The preview is a box inside a page, so a viewport media
//      query would answer the wrong question. Each `@media (max-width: N)`
//      block is rewritten to `.deck[data-w="…"]` for every preview width it
//      would have matched, which makes the responsive behaviour live and
//      switchable rather than theoretical.
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const LAB = path.resolve("docs/design/labs/tasks-2026-08");
const WIDTHS = [1440, 1280, 768, 390];

/* ── a very small CSS block splitter ─────────────────────────────
   Enough for our own stylesheets, which are hand-written and regular.
   It walks braces and quotes and never tries to be a real parser. */
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
   deletes the rule: exactly how the token block went missing the first time
   this ran. The source keeps its comments, only the compiled file loses them. */
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

/* The splitter walks braces and trusts them, so one malformed rule in the
   master does not fail here — it silently shifts every rule after it and the
   console ships a stylesheet with a few hundred dead selectors in it. That is
   exactly what happened: a stranded `to {...}` left behind by an edit to
   @keyframes settleIn scoped 562 rules into nonsense, and the only visible
   symptom was an unstyled dock nobody was looking at. The browser recovers
   from bad CSS; this splitter must not have to. */
const LF = String.fromCharCode(10);
function assertBalanced(css, label) {
  let depth = 0;
  let line = 1;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === LF) line++;
    else if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth < 0) {
      throw new Error(label + ": unbalanced CSS — a closing brace with nothing open, at line " + line);
    }
  }
  if (depth !== 0) throw new Error(label + ": unbalanced CSS — " + depth + " block(s) left open");
}

/* A scoped selector that looks like a declaration is the splitter having lost
   its place. Catch it on the way out rather than in a screenshot. */
function assertScoped(css, label) {
  const bad = css.match(/^\.deck [a-z-]+:[^;{]*\{[^}]*\}$/gm) || [];
  const empty = css.match(/^\.[A-Za-z][\w-]* \{\}$/gm) || [];
  if (bad.length || empty.length) {
    throw new Error(label + ": scoping produced " + bad.length + " declaration-shaped selector(s) and " +
      empty.length + " empty rule(s); first: " + (bad[0] || empty[0]));
  }
}

function scopeCss(rawCss, { nested = false } = {}) {
  const css = nested ? rawCss : stripComments(rawCss);
  if (!nested) assertBalanced(css, "floor.html");
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

      /* prefers-reduced-motion and prefers-color-scheme still mean what
         they mean, so they stay real media queries. */
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
        for (const w of matching) {
          out.push(inner.replace(/(^|,\s*)\.deck/gm, `$1.deck[data-w="${w}"]`));
        }
        continue;
      }

      const min = head.match(/min-width:\s*(\d+)/);
      if (min) {
        const limit = Number(min[1]);
        const matching = WIDTHS.filter((w) => w >= limit);
        if (!matching.length) continue;
        for (const w of matching) {
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

async function build() {
  const foundation = await readFile(path.join(LAB, "foundation.css"), "utf8");
  const master = await readFile(path.join(LAB, "floor.html"), "utf8");
  const data = await readFile(path.join(LAB, "data.js"), "utf8");
  const icons = await readFile(path.join(LAB, "icons.js"), "utf8");
  const shell = await readFile(path.join(LAB, "customizer.shell.html"), "utf8");

  const sans = await dataUri(path.join(LAB, "fonts/Geist.woff2"), "font/woff2");
  const mono = await dataUri(path.join(LAB, "fonts/GeistMono.woff2"), "font/woff2");

  const foundationInlined = foundation
    .replace('url("./fonts/Geist.woff2")', `url(${sans})`)
    .replace('url("./fonts/GeistMono.woff2")', `url(${mono})`);

  const masterCss = master.split("<style>")[1].split("</style>")[0];
  const masterJs = master.split('<script src="./icons.js"></script>')[1].split("<script>")[1].split("</script>")[0];

  /* The renderer is taken verbatim. It already reads its decisions from
     `#deck` when that element exists, and it exports `window.__signal`, so
     the console drives the real thing with no rewriting at all. A rewritten
     copy would be a second implementation of the board, and a second
     implementation is how a design system starts to drift. */
  const renderer = masterJs;

  /* Inside the console the deck IS the viewport, so a height measured in
     dvh would be measuring the wrong box, and the absolutely positioned
     spine needs the deck to be the thing it is positioned against. */
  const css = [scopeCss(foundationInlined), scopeCss(masterCss)]
    .join("\n\n")
    .replace(/100dvh/g, "100%")
    + "\n.deck { position: relative; }\n";

  const page = shell
    .replace("/*__CSS__*/", () => css)
    .replace("/*__DATA__*/", () => data)
    .replace("/*__ICONS__*/", () => icons)
    .replace("/*__RENDERER__*/", () => renderer);

  const out = path.join(LAB, "customizer.html");
  await writeFile(out, page, "utf8");
  const { size } = await stat(out);
  process.stdout.write(`${out}\n${(size / 1024 / 1024).toFixed(2)} MB\n`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
