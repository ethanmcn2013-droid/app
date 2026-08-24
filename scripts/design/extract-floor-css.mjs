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
/* The panel's standing list — the filtered state, the ring on the column
   scrollers and the empty board — now lives in the MASTER, where a design
   decision belongs. What stays here is host plumbing only: things that are
   true because the board sits inside the app's shell rather than owning a
   page of its own. */

/* Typography · the Done column measured as the darkest thing on the sheet, so
   the eye landed on finished work before the work in hand. The tick states
   done; it does not have to shout it. */
.root .card[data-done] .tick { background: var(--ink-2); }

/* The board draws as many columns as the workspace has.
 *
 * The master is a five-lane fixture, so its track list is repeat(5, …). A
 * workspace with four columns then rendered a fifth empty 312px track, which
 * is the dead sheet to the right of Done. The count comes from the render. */
.root .board { grid-template-columns: repeat(var(--lanes, 5), minmax(258px, 312px)); }

/* A card that has nothing to say says nothing.
 *
 * The foot reserves a 24px band for the actions button, which is hidden until
 * hover — so a task carrying only a title rendered as a title over an empty
 * white band, roughly 60% of the card. The demo fixture never showed it
 * because every fixture task carries a label and a priority; real ones do
 * not. The button leaves the flow and the band collapses, and the row is
 * still there the moment the card has a fact to put in it. */
.card[data-bare] .cardFoot { min-height: 0; }
.card[data-bare] .cardDots {
  position: absolute; right: 10px; bottom: 8px; margin: 0;
}
.card[data-bare] { row-gap: 4px; }

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
const sheet = alias((head + tokens + "\n" + kept.join("") + host)
  .replace(/(^|[\s,(])\.floor\b/g, "$1.root"),
);

/* `--check` makes this a gate rather than a generator.
 *
 * The master is the source of the board's stylesheet, and re-running this was
 * a step somebody had to remember. Nobody did: round 12 opened with the app
 * carrying round-11 CSS, 209 lines behind the master it is supposed to be
 * generated from, and nothing anywhere said so. A gate says so. */
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = await readFile(OUT, "utf8");
  } catch {
    process.stdout.write(`${OUT} does not exist. Run: node scripts/design/extract-floor-css.mjs\n`);
    process.exit(1);
  }
  if (current === sheet) {
    process.stdout.write(`in sync  ${OUT} matches the master\n`);
    process.exit(0);
  }
  const a = current.split("\n");
  const b = sheet.split("\n");
  let first = 0;
  while (first < a.length && first < b.length && a[first] === b[first]) first += 1;
  process.stdout.write(
    `OUT OF SYNC  ${OUT} is not what the master would generate.\n` +
    `  first difference at line ${first + 1}\n` +
    `    shipped: ${JSON.stringify((a[first] || "").trim().slice(0, 76))}\n` +
    `    master : ${JSON.stringify((b[first] || "").trim().slice(0, 76))}\n` +
    `  ${Math.abs(a.length - b.length)} lines of length difference\n` +
    "  Run: node scripts/design/extract-floor-css.mjs\n",
  );
  process.exit(1);
}

await writeFile(OUT, sheet, "utf8");
process.stdout.write(`${OUT}\n  tokens: ${tokens ? "yes" : "MISSING"}  kept: ${kept.length}  dropped: ${dropped}\n`);

/**
 * The palette, sourced rather than restated.
 *
 * The master is a standalone file and states its three colours literally, so
 * it opens without the app around it. The stylesheet the app ships must not:
 * the design system already holds these exact values, and a second copy of a
 * value is a second place it can drift from. Every literal in the palette
 * block becomes the token that already carries it.
 */
function alias(css) {
  const SAME = [
    /* --ink is dropped, not aliased: `--ink: var(--ink)` is a cycle, which
       makes the property invalid at computed-value time and unsets the whole
       board's ink. Removing it lets the identical value inherit from
       tokens.css, which is where it should have come from all along. */
    [/\n *--ink: *#111111;.*/, ""],
    [/(--indigo:\s*)#4f46e5/, "$1var(--indigo-600)"],
    [/(--indigo-deep:\s*)#4338ca/, "$1var(--indigo-700)"],
    [/(--white:\s*)#ffffff/, "$1var(--paper)"],
    [/(--on-ink-1:\s*)#ffffff/, "$1var(--paper)"],
  ];
  let out = css;
  for (const [find, put] of SAME) {
    if (!find.test(out)) throw new Error(`palette alias missed: ${find}`);
    out = out.replace(find, put);
  }
  /* A colour named in prose is still a second copy of the value. */
  out = out.replace(
    /locked to Ink #111111, Indigo #4f46e5 and White #ffffff/,
    "locked to three: --ink, --indigo-600 and --paper, all from tokens.css",
  );
  return out;
}
