/**
 * Extract the board stylesheet from the design master into a CSS Module.
 *
 *   node scripts/design/extract-floor-css.mjs
 *
 * The master at docs/design/labs/tasks-2026-08/floor.html is the reference
 * for the Tasks board. This lifts the sheet-inward rules out of it, drops the
 * lab page's own shell (the ink floor, the spine, the specimen sheet and the
 * customizer's decision layer), scopes the token block to the board root, and
 * makes every selector "pure" for CSS Modules by prefixing the ones that name
 * only elements or attributes. Re-run it whenever the master changes.
 */
import { readFile, writeFile } from "node:fs/promises";

const MASTER = "docs/design/labs/tasks-2026-08/floor.html";
const OUT = "src/components/floor/floor.module.css";

/** The lab page's own shell; production supplies all of it. */
const DROP = [".spec", "html", "body", "@font-face"];

function blocks(css) {
  const out = [];
  let depth = 0;
  let buf = "";
  for (const ch of css) {
    buf += ch;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) { out.push(buf); buf = ""; }
    }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/** CSS Modules rejects a selector with no local class. One that names only
 *  elements, attributes or pseudo-classes belongs to the board root anyway. */
function pure(selector) {
  return selector
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const bare = stripComments(part).trim();
      /* Two reasons a selector gets scoped to the board root. CSS Modules
         rejects one with no local class at all; and one that leads with a
         decision attribute — [data-density], [data-cards] — would otherwise
         match an ancestor of the mount that happens to carry the same
         attribute, which is how production's own density reached in and
         fixed the header at 52px. The decision layer belongs to the board. */
      if (bare.startsWith("[data-")) return `.root${bare}`;
      return /\.[A-Za-z_-]/.test(bare) ? part : `.root ${part}`;
    })
    .join(", ");
}

const src = await readFile(MASTER, "utf8");
const css = src.split("<style>")[1].split("</style>")[0];

let tokens = "";
const kept = [];
let dropped = 0;

for (const block of blocks(css)) {
  const head = block.slice(0, block.indexOf("{"));
  const selector = stripComments(head).trim();
  const comment = head.slice(0, head.length - head.trimStart().length) +
    (head.match(/^\s*((?:\/\*[\s\S]*?\*\/\s*)+)/)?.[1] ?? "");
  const body = block.slice(block.indexOf("{"));

  if (selector === ":root") { tokens = `.root ${body}`; continue; }

  if (selector.startsWith("@")) {
    // Recurse one level: media and supports blocks hold their own rules.
    const inner = body.slice(1, body.lastIndexOf("}"));
    const rewritten = blocks(inner).map((sub) => {
      const subHead = sub.slice(0, sub.indexOf("{"));
      const subSel = stripComments(subHead).trim();
      if (!subSel || subSel.startsWith("@")) return sub;
      const subComment = subHead.match(/^\s*((?:\/\*[\s\S]*?\*\/\s*)+)/)?.[1] ?? "";
      return `\n  ${subComment}${pure(stripComments(subHead))} ${sub.slice(sub.indexOf("{"))}`;
    }).join("");
    kept.push(`${comment}${selector} {${rewritten}\n}\n`);
    continue;
  }

  const parts = selector.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length && parts.every((p) => DROP.some((d) => p.startsWith(d)) && !p.includes("has("))) {
    dropped += 1;
    continue;
  }

  const scoped = pure(selector).replace(/\.floor/g, ".root");
  kept.push(`${comment}${scoped} ${body}`);
}

const head = `/* Studio Floor — the Tasks board surface.
 *
 * GENERATED from ${MASTER} by scripts/design/extract-floor-css.mjs.
 * Do not hand-edit: change the master and re-run, so the shipped board and
 * the design reference cannot drift apart.
 *
 * The palette is locked to Ink #111111, Indigo #4f46e5 and White #ffffff.
 * Every value here is one of those three at a stated alpha; status is carried
 * by ink density and fill, never by hue. The token block is scoped to .root
 * so the board carries its own ladders without reaching into the rest of the
 * app.
 */

`;

/* The master is a whole page: its .floor rule supplied the ink ground, the
 * height and the inset. In production the mount sits inside the app's own
 * <main>, so the host layout is declared here rather than lifted. */
const host = `
/* ── the production host ────────────────────────────────────────────
   The master owned the viewport with 100dvh. Here the page fills the stage
   the app gives it; everything else about the shell — the ink ground, the
   18px inset, the spine and the sheet — is the master's own. */
.root {
  /* The master owned the viewport with 100dvh; here the page fills the stage
     the app hands it. Everything else about the shell — the ink ground, the
     18px inset, the spine's gutter — is the master's own, declared above. */
  height: 100%;
  min-height: 0;
  /* A flex child does not shrink below its content by default, and the board
     declares a 1290px floor — so without these the page ran 118px past the
     viewport and the last column was cut rather than scrolled. */
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  /* The master painted the ink ground on <body>; that rule does not come
     across, so the page paints its own. Without it the spine is white on
     white and the sheet has nothing to be lifted off. */
  background: var(--ink);
  font-family: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
}

/* The workspace owns the shell; the board component renders the board and its
   foot strip into the sheet, so it is a plain flex column with no inset, no
   ground and no second sheet of its own. */
.boardHost {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  position: relative;
}

/* The phone header is a three-row grid and the desktop rule fixes the row to
   60px. Restated here, after every media block, so the grid sizes to its own
   content instead of overflowing into the view switcher. */
@media (max-width: 720px) {
  .head { height: auto; min-height: 0; align-content: start; }
  .headRule { display: none; }
}

`;

/* The master's page shell is `.floor`; in the module it is the component's own
 * root. Renaming on the emitted text rather than per-selector catches it
 * wherever it appears, including inside :has() and media blocks. The host
 * block goes last so it wins on the properties it deliberately overrides. */
const sheet = (head + tokens + "\n" + kept.join("") + host)
  .replace(/(^|[\s,(])\.floor\b/g, "$1.root");

await writeFile(OUT, sheet, "utf8");
process.stdout.write(`${OUT}\n  tokens: ${tokens ? "yes" : "MISSING"}  kept: ${kept.length}  dropped: ${dropped}\n`);
