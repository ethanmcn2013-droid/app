/* Derive src/ from the three frozen labs. ONE SHOT, then src/ is the source.
 *
 *   node tools/split.mjs --force
 *
 * The labs are history. `_source/` holds the exact bytes they were frozen at;
 * this turns them into the suite's parts and then gets out of the way. It
 * refuses to overwrite without --force, because after the first run src/ is
 * the living source and re-deriving would throw away every edit since.
 *
 * Everything it does is a measurement or a named, asserted patch. There is no
 * "clean up while you are in there": a patch that does not match its source
 * exactly once throws, so a lab that moved under us fails loudly rather than
 * producing a master that is quietly a different product.
 *
 * ── what it does to CSS ──────────────────────────────────────────────
 * Each product's stylesheet is scoped to its own app element, so the three
 * can share one document without any of them resolving a token the other
 * one's way. `--paper` is the case that proves it is necessary: Notes
 * declares it as a three-layer shadow and Timeline declares it as #ffffff,
 * both at :root. Unscoped, one of them is wrong on every surface it paints.
 *
 *   :root | html | body      →  [data-app="…"]
 *   a root decision attribute →  [data-app="…"][data-cards="elevated"] …
 *   anything else             →  [data-app="…"] …
 *   @keyframes                →  UNTOUCHED. A keyframe selector is a
 *                                position on a timeline, not an element;
 *                                prefixed, the list parses as empty and
 *                                every animation in the product dies
 *                                silently. That is the third defect in the
 *                                Tasks lock, and it is not repeated here.
 *
 * Rules whose every class is a shell class are dropped: shell.css owns the
 * floor, the spine and the screen-reader utility once, for the whole suite.
 * A selector list is cut apart rather than dropped whole, so
 * `.railTile, .segItem, .late` keeps its two product halves.
 */
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, selectors, classesIn, norm } from "./css.mjs";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(LAB, "_source");
const OUT = path.join(LAB, "src");
const force = process.argv.includes("--force");

const read = (f) => readFile(path.join(SRC, f), "utf8").then((s) => s.replace(/\r\n/g, "\n"));

/* WHAT --force DESTROYED ONCE, AND WILL NOT AGAIN.
   src/ is the living source after the first derivation. Round 1 was
   mid-remediation when this ran with --force out of habit, and it silently
   replaced six hand-edited files — the whole horizontal Timeline, four
   defect fixes and two days of argued comments — with the frozen labs
   again. Nothing errored. The behaviour gate then PASSED the seam's
   privacy assertion, because the field the fix reads had gone with the
   fix and an absent field reads as "sent nothing", which is the one
   outcome that looks like success from the outside.

   So --force now takes a copy first, and says where it went. A one-shot
   derivation that can eat a round's work without leaving a trace is not a
   tool, it is a trap. */
async function guard(name) {
  if (!force) {
    try {
      await access(path.join(OUT, name));
      throw new Error(
        `src/${name} already exists. src/ is the living source after the first derivation — ` +
        `pass --force only if you mean to throw away every edit made since.`,
      );
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
    return;
  }
  try {
    const was = await readFile(path.join(OUT, name), "utf8");
    const backup = path.join(SRC, ".replaced");
    await mkdir(backup, { recursive: true });
    await writeFile(path.join(backup, name), was);
    process.stdout.write(`   --force is replacing src/${name} · the copy it replaced is in _source/.replaced/
`);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

/* ── the shell's own classes ─────────────────────────────────────────
   The floor, the spine, and the one utility every surface needs. These are
   suite chrome: rendered once, outside all three products, so no product
   sheet may declare them. `.sheet` is NOT in this list — shell.css owns its
   base rule by name (below) and each product keeps its own additions. */
const SHELL_CLASSES = new Set(
  "floor rail railMark railDivider railGroup railUtil railTile railSpacer railAvatar railAdd sr".split(" "),
);

/* The two rules shell.css lifts by text rather than by class, because
   `.sheet` carries product surface as well as shell geometry. Matched on
   normalised text so a whitespace edit in a lab cannot silently miss. */
const SHEET_BASE =
  "height: 100%; background: var(--white); border-radius: var(--r-sheet); " +
  "display: flex; flex-direction: column; position: relative; min-width: 0; overflow: hidden;";

const PRODUCTS = {
  tasks: {
    /* Attributes the decision layer writes onto the product's own root. A
       selector anchored on one of these attaches to the app element itself;
       anything else is a descendant of it. Getting this wrong is silent:
       `[data-app="tasks"] [data-cards="elevated"] .card` matches nothing,
       because the two attributes are on the same element. */
    rootAttrs: ["data-variant", "data-cards", "data-radius", "data-density", "data-indigo", "data-type"],
  },
  notes: {
    rootAttrs: ["data-variant", "data-paper", "data-index", "data-radius", "data-indigo", "data-type",
      "data-group", "data-searching", "style"],
  },
  timeline: {
    rootAttrs: ["data-variant", "data-v", "data-state", "data-ground", "data-past", "data-accent",
      "data-spacing", "data-medium", "data-undo", "data-editor-open"],
  },
};

/* ── selector surgery ────────────────────────────────────────────── */

/* The first compound of a selector — everything up to the first combinator
   that is not inside brackets or parentheses. */
function firstCompound(sel) {
  let depth = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (depth === 0 && /[\s>+~]/.test(c)) return sel.slice(0, i);
  }
  return sel;
}

function scopeOne(sel, scope, rootAttrs) {
  const s = sel.trim();
  const head = firstCompound(s);
  const rest = s.slice(head.length);

  /* The document's own three names all mean "the product's root" here. */
  const m = head.match(/^(:root|html|body)(.*)$/);
  if (m) return scope + m[2] + rest;

  /* A decision attribute is ON the root, so it must be concatenated. */
  if (head.startsWith("[")) {
    const name = (head.match(/^\[([\w-]+)/) || [])[1];
    if (name && rootAttrs.includes(name)) return scope + head + rest;
  }
  return scope + " " + s;
}

/* True when the selector is shell chrome and nothing else. A selector with
   no class at all (`html`, `[aria-disabled="true"]`) is never shell-only:
   it belongs to whichever product declared it. */
function isShellOnly(sel) {
  const cs = [...classesIn(sel)];
  return cs.length > 0 && cs.every((c) => SHELL_CLASSES.has(c));
}

/* The original text, with the selectors rewritten and everything else —
   the formatting, the section headers, and two thousand lines of the
   reasoning behind each rule — left exactly where it was.
   Not cosmetic: Timeline's own gate reads trailing `off-ladder` markers out
   of the stylesheet, so a comment-free copy fails a gate it should pass. */
function scopeCss(src, nodes, product, report) {
  const scope = `[data-app="${product}"]`;
  const { rootAttrs } = PRODUCTS[product];
  const out = [];
  let cursor = 0;
  /* The gap before a node is its own leading comment. It is held until the
     node is emitted, so a rule that goes to shell.css takes the paragraph
     explaining it along rather than leaving the prose behind. */
  let pending = "";

  for (const node of nodes) {
    pending += src.slice(cursor, node.start);
    cursor = node.end;

    /* Structure, @keyframes and @font-face travel untouched. A keyframe
       selector is a position on a timeline, not an element. */
    if (node.kind !== "rule") {
      out.push(pending, src.slice(node.start, node.end));
      pending = "";
      continue;
    }

    const parts = selectors(node.selector);
    const kept = parts.filter((s) => !isShellOnly(s));
    const dropped = parts.filter((s) => isShellOnly(s));
    if (dropped.length) report.dropped.push({ product, at: node.at, sel: dropped.join(", ") });
    const isSheetBase = !node.at.length && norm(node.body) === SHEET_BASE && kept.join(",").trim() === ".sheet";
    if (isSheetBase) report.dropped.push({ product, at: [], sel: ".sheet (base — shell.css owns it)" });
    if (!kept.length || isSheetBase) { pending = ""; continue; }

    out.push(pending);
    pending = "";
    /* The selector list is rebuilt; the body is the original slice. */
    const indent = (src.slice(0, node.start).match(/[^\n]*$/) || [""])[0].replace(/\S/g, "");
    out.push(kept.map((s) => scopeOne(s, scope, rootAttrs)).join(",\n" + indent) + " {" + node.raw + "}");
  }
  out.push(pending, src.slice(cursor));
  return out.join("");
}

/* ── an asserted patch ───────────────────────────────────────────── */
function patch(text, edits, label) {
  let out = text;
  for (const [from, to, why] of edits) {
    const hits = out.split(from).length - 1;
    if (hits !== 1) throw new Error(`${label}: expected exactly 1 match for «${from.slice(0, 90)}…», found ${hits}`);
    out = out.replace(from, to);
    process.stdout.write(`   patched ${label}: ${why}\n`);
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════ */
await mkdir(OUT, { recursive: true });
const report = { dropped: [] };

/* ── CSS ─────────────────────────────────────────────────────────── */
const floorHtml = await read("tasks.floor.html");
const tasksCss = floorHtml.slice(floorHtml.indexOf("<style>") + 7, floorHtml.indexOf("</style>"));
const notesCss = await read("notes.master.css");
/* fonts.css is NOT carried: Timeline's three static faces are replaced by
   the variable Geist the other two labs use. verify.mjs proves the swap is
   invisible at 400 and 600 before this is allowed to stand. */
const tlCss = (await read("timeline.shell.css")) + "\n\n" + (await read("timeline.b.css"));

const HEAD = (key, title, from) =>
  `/* ${title} — GENERATED ONCE by tools/split.mjs from ${from}, then hand-edited.\n` +
  `   Every selector is scoped to [data-app="${key}"] so the three products\n` +
  `   share one document without sharing one :root. Do not remove the scope.\n` +
  `   The floor, the spine and the sheet's base geometry are shell.css's. */\n\n`;

/* Comments carried the blank lines that separated the token groups, so
   stripping them leaves runs of nothing. */
const tidy = (css) => css.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");

await guard("tasks.css");
await writeFile(path.join(OUT, "tasks.css"),
  HEAD("tasks", "Tasks · Studio Floor", "floor.html <style>") + tidy(scopeCss(tasksCss, parse(tasksCss, "tasks"), "tasks", report)) + "\n");

await guard("notes.css");
await writeFile(path.join(OUT, "notes.css"),
  HEAD("notes", "Notes · The Stack", "master.css") + tidy(scopeCss(notesCss, parse(notesCss, "notes"), "notes", report)) + "\n");

await guard("timeline.css");
let tl = tidy(scopeCss(tlCss, parse(tlCss, "timeline"), "timeline", report));
/* Inside the suite the Timeline artifact stands on the sheet, not on the
   viewport, so viewport units would measure the wrong box — the same
   correction the compiled Timeline console already makes. */
const vh = tl.split(/100dvh|100vh/).length - 1;
tl = tl.replace(/100dvh|100vh/g, "100%");
process.stdout.write(`   timeline: ${vh} viewport-height values re-based on the sheet\n`);
await writeFile(path.join(OUT, "timeline.css"),
  HEAD("timeline", "Timeline · B · The Approach", "shell.css + b.css") + tl + "\n");

/* ── JS ──────────────────────────────────────────────────────────── */
const S_ = "window.__SUITE";

await guard("tasks.js");
const tasksJs = floorHtml.slice(floorHtml.lastIndexOf("<script>") + 8, floorHtml.lastIndexOf("</script>"));
await writeFile(path.join(OUT, "tasks.js"), patch(tasksJs, [
  [
    'const params = new URLSearchParams(location.search);\nlet state = params.get("state") || "board";\nconst variant = params.get("v") || "locked";',
    `const params = ${S_}.params("tasks");\nlet state = params.get("state") || "board";\nconst variant = params.get("v") || "locked";`,
    "the URL is read through the suite, which owns one query string for three products",
  ],
  [
    'const root = document.getElementById("deck") || document.documentElement;',
    `const root = ${S_}.root("tasks");`,
    "the decisions live on this product's own app element, not on the document",
  ],
  [
    `return '<div class="floor">' + rail() + sheet + (state === "planning" ? drawer() : "") + cardMenu() + "</div>";`,
    `return sheet + (state === "planning" ? drawer() : "") + cardMenu();`,
    "the floor and the spine are the suite's, rendered once — this renders the sheet",
  ],
  [
    `/* The region is in the tree before the first paint. Creating it and writing
   to it in the same frame is the classic pattern a screen reader skips, so
   the announcement lost was always the first one of the session — the tick
   or the pick-up that teaches the model. */
if (!document.getElementById("say")) {
  const region = document.createElement("p");
  region.id = "say";
  region.className = "sr";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  document.body.appendChild(region);
}

/* One delegated listener per event`,
    `/* One live region for the suite, created before the first paint. Two
   products each appending their own would put two elements with id="say"
   in one document, and the second one would never be read. */
${S_}.region();

/* One delegated listener per event`,
    "the live region belongs to the suite, so three products announce on one",
  ],
  [
    `  document.addEventListener("keydown", onKey);`,
    `  /* The board that is not on screen keeps its DOM, so it would keep
     answering the keyboard as well. A product's keys are its own. */
  document.addEventListener("keydown", (event) => { if (${S_}.active("tasks")) onKey(event); });`,
    "the keyboard belongs to the product that is on the floor",
  ],
  [
    `/* The rail is one stop the arrows walk, and for eleven rounds it was four.`,
    `/* ── what the suite may ask of this board ────────────────────────
   A narrow, named surface, and the only way in. Everything below is the
   board's own vocabulary — allTasks(), applyLaneFacts(), tasksFor(),
   focusId, mount() — so a task that crossed from Notes arrives exactly
   the way one typed into a column does, and every rule the board already
   enforces about a new card enforces itself here too. */
const TASKS_API = {
  rows: () => allTasks(),
  byId: (id) => taskById(id),
  /* The seam names a lane in the words a person reads ("To do"); the board
     knows it by id. One translation, here. */
  laneIdFor(name) {
    const column = B.columns.find((c) => c.id === name || c.name === name);
    return column ? column.id : null;
  },
  add(spec) {
    const rows = allTasks();
    const task = { tag: "", priority: "", comments: 0, ...spec };
    /* A task arriving in a lane takes that lane's facts, the same as one
       created in it: a card that lands in Done with no completion date is
       a receipt-less card in the column that exists to be the memory. */
    applyLaneFacts(task, null, task.lane);
    const inLane = tasksFor(task.lane);
    const before = inLane.length ? inLane[inLane.length - 1] : null;
    const at = before ? rows.findIndex((t) => t.id === before.id) + 1 : rows.length;
    rows.splice(at, 0, task);
    mount();
    return task;
  },
  remove(id) {
    const rows = allTasks();
    const at = rows.findIndex((t) => t.id === id);
    if (at === -1) return false;
    rows.splice(at, 1);
    if (focusId === id) focusId = null;
    if (openNoteId === id) openNoteId = null;
    if (carriedId === id) carriedId = null;
    mount();
    return true;
  },
  reveal(id) {
    if (!taskById(id)) return false;
    /* A filter can hide the card the seam just made, and being sent to a
       card you cannot see is worse than not being sent at all. */
    lateOnly = false;
    todayOnly = false;
    clientOnly = null;
    openNoteId = null;
    focusId = id;
    refocus = true;
    refocusPart = "card";
    mount();
    return true;
  },
  /* The add verb on the phone capsule. The capsule is the suite's, the
     verb is the board's. */
  add0() {
    draftLane = B.columns[0].id;
    draftText = "";
    mount();
    const field = ${S_}.host("tasks").querySelector(".card[data-draft] .cardTitle");
    if (field) field.focus();
  },
};

/* The rail is one stop the arrows walk, and for eleven rounds it was four.`,
    "the board grows one narrow surface for the suite to reach it through",
  ],
], "tasks.js")
  .replace(/document\.getElementById\("root"\) \|\| document\.getElementById\("deck"\)/g, `${S_}.host("tasks")`)
  + `\n\n${S_}.register("tasks", {\n` +
  "  /* `show` is the board's own repaint, deliberately the same one every\n" +
  "     other change goes through: it restores scroll, focus and caret, so\n" +
  "     arriving back on the board costs nothing you were holding. */\n" +
  "  show: mount,\n" +
  "  setState: window.__signal.setState,\n" +
  "  presets: PRESETS,\n" +
  "  decisions: DECISIONS,\n" +
  "  api: TASKS_API,\n" +
  "});\n");

await guard("notes.js");
await writeFile(path.join(OUT, "notes.js"), patch(await read("notes.notebook.js"), [
  [
    "  const params = new URLSearchParams(location.search);",
    `  const params = ${S_}.params("notes");`,
    "the URL is read through the suite",
  ],
  [
    '  const root = document.getElementById("deck") || document.documentElement;',
    `  const root = ${S_}.root("notes");`,
    "the decisions live on this product's own app element",
  ],
  [
    '  const mount = document.getElementById("root");',
    `  const mount = ${S_}.host("notes");`,
    "the notebook paints into its own app element",
  ],
  [
    `    mount.innerHTML = \`
      <div class="floor">
        \${phone.matches ? "" : rail()}
        <main class="sheet"\${undone ? " data-undo" : ""}>`,
    `    mount.innerHTML = \`
        <main class="sheet"\${undone ? " data-undo" : ""}>`,
    "the floor and the spine are the suite's — this renders the sheet",
  ],
  [
    `          \${undoStrip()}
        </main>
        \${s.over || ""}
      </div>\`;`,
    `          \${undoStrip()}
        </main>
        \${s.over || ""}\`;`,
    "…and closes without the floor it no longer owns",
  ],
  [
    `  function rail() {
    const tiles = SUITE;
    return \``,
    `  /* The capsule is rendered once by the suite now. This is the phone
     dock's copy of it and the only one left; the full-height version is
     in app.js. */
  function railUnused() {
    const tiles = SUITE;
    return \``,
    "the notebook stops drawing a second capsule",
  ],
  [
    `  const region = document.createElement("p");
  region.className = "sr";
  region.id = "say";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  document.body.appendChild(region);`,
    `  const region = ${S_}.region();`,
    "the live region belongs to the suite",
  ],
  [
    "    const box = document.getElementById(\"root\");",
    `    const box = ${S_}.frame();`,
    "the phone question is asked of the floor, which is the box that has a width",
  ],
  [
    `    document.documentElement.style.setProperty(
      "--peel-h",`,
    `    root.style.setProperty(
      "--peel-h",`,
    "the desk budget is written on this product's own root, not on the document",
  ],
  [
    `    document.documentElement.setAttribute("data-state", state);`,
    `    root.setAttribute("data-state", state);`,
    "…and so is the state the harness reads",
  ],
  [
    `  addEventListener("keydown", (e) => {
    const typing = e.target.matches("textarea, input, [contenteditable]");`,
    `  addEventListener("keydown", (e) => {
    /* The notebook that is not on screen keeps its DOM, so it would keep
       answering the keyboard as well. A product's keys are its own. */
    if (!${S_}.active("notes")) return;
    const typing = e.target.matches("textarea, input, [contenteditable]");`,
    "the keyboard belongs to the product that is on the floor",
  ],
  [
    `  document.getElementById("root").addEventListener(
    "scroll",`,
    `  ${S_}.host("notes").addEventListener(
    "scroll",`,
    "the delegated scroll listener binds to this product's own element",
  ],
  [
    `    const mountEl = document.getElementById("root");`,
    `    const mountEl = ${S_}.frame();`,
    "the container that is watched is the one that has a box",
  ],
  /* ── the seam ──────────────────────────────────────────────────
     Four patches, and they are the whole of the new behaviour on this
     side. Notes already did every part of this except arrive. */
  [
    `    if (a && a.startsWith("suite-")) {
      const where = a.slice(6);
      if (where === "notes") {
        say("You are on Notes.");
        return;
      }
      if (where === "more") {
        /* Not a surface in the suite: the rest of Signal Studio. */
        say("The rest of Signal Studio is on another screen.");
        return;
      }
      const entry = SUITE.find(([k]) => k === where);
      say(\`\${entry ? entry[1] : where} is another surface in this suite. This lab is the Notes one.\`);
      return;
    }`,
    `    if (a && a.startsWith("suite-")) {
      const where = a.slice(6);
      if (where === "notes") {
        say("You are on Notes.");
        return;
      }
      if (where === "more") {
        /* Still not a surface in the suite: the rest of Signal Studio. */
        say("The rest of Signal Studio is on another screen.");
        return;
      }
      /* The doors are real. */
      ${S_}.go(where);
      return;
    }`,
    "the suite tiles in the phone dock open the surfaces they name",
  ],
  [
    `    const entry = {
      ...note,
      id: \`crossed_\${note.id}\`,
      task: wording,
      lane: "To do",
      crossedWhen: "just now",
      sent: true,
    };
    CROSSED.unshift(entry);
    offerUndo("Sent to Tasks.", "Taken back. Nothing went to Tasks.", () => {
      if (note && before) Object.assign(note, before);
      CROSSED.shift();
      sentTask = null;
      peeling = note ? note.id : null;
    });`,
    `    const entry = {
      ...note,
      id: \`crossed_\${note.id}\`,
      task: wording,
      lane: "To do",
      crossedWhen: "just now",
      sent: true,
    };
    CROSSED.unshift(entry);
    /* AND IT ARRIVES. The ledger row and the receipt on the note were
       both already true; the card at the other end of them was the one
       thing no lab could build. One act, so one undo: the suite hands
       back the way to take the card off the board and it runs beside the
       two facts this product already reverses. */
    ${S_}.cross(entry);
    offerUndo("Sent to Tasks.", "Taken back. Nothing went to Tasks.", () => {
      if (note && before) Object.assign(note, before);
      CROSSED.shift();
      ${S_}.uncross(entry);
      sentTask = null;
      peeling = note ? note.id : null;
    });`,
    "a crossing from the notebook lands on the board, and undo takes it back off",
  ],
  [
    `      decided.push({ note, kind: "task", before });
      CROSSED.unshift({
        ...note,
        id: \`crossed_\${note.id}\`,
        task: wording,`,
    `      decided.push({ note, kind: "task", before });
      const handEntry = {
        ...note,
        id: \`crossed_\${note.id}\`,
        task: wording,`,
    "the hand's crossing is named so it can be sent as well as recorded (1/2)",
  ],
  [
    `        lane: "To do",
        crossedWhen: "just now",
        sent: true,
      });
      say(\`\${N.copy.sentReceipt} \${Math.max(0, queue().length)} left.\`);
      offerUndo("Sent to Tasks.", "Taken back. Nothing went to Tasks.", () => {
        if (note && before) Object.assign(note, before);
        CROSSED.shift();
        decided.pop();
      });`,
    `        lane: "To do",
        crossedWhen: "just now",
        sent: true,
      };
      CROSSED.unshift(handEntry);
      ${S_}.cross(handEntry);
      say(\`\${N.copy.sentReceipt} \${Math.max(0, queue().length)} left.\`);
      offerUndo("Sent to Tasks.", "Taken back. Nothing went to Tasks.", () => {
        if (note && before) Object.assign(note, before);
        CROSSED.shift();
        ${S_}.uncross(handEntry);
        decided.pop();
      });`,
    "the hand's crossing is named so it can be sent as well as recorded (2/2)",
  ],
  [
    `    const field = mount.querySelector(".topField, .phoneField");
    if (field && !params.get("nofocus")) field.focus({ preventScroll: true });`,
    `    const field = mount.querySelector(".topField, .phoneField");
    /* The caret starts where the thought goes — but only when this is the
       sheet on the floor. Three products each taking focus at load leaves
       it wherever the last script happened to run. */
    if (field && !params.get("nofocus") && ${S_}.active("notes")) field.focus({ preventScroll: true });`,
    "the notebook takes the caret only when it is the sheet on the floor",
  ],
  [
    `  /* The console drives the same file through this. */
  window.NOTEBOOK = {
    presets: PRESETS,`,
    `  /* The console drives the same file through this, and now so does the
     suite. \`show\` is paint(), which is the repaint that already restores
     scroll, focus and caret. */
  ${S_}.register("notes", { show: paint, api: { paint: paint, state: () => state } });
  window.NOTEBOOK = {
    paint,
    presets: PRESETS,`,
    "the notebook registers with the suite",
  ],
  [
    `      const fromDesk = !peeling;
      peeling = null;
      sentTask = null;
      say(a === "open-task" ? "Opening Tasks. Your note stayed here." : "Done. Your note stayed here.");
      refocus = fromDesk ? { kind: "act", sel: '[data-act="open-task"]' } : { kind: "read" };
      paint();
      return;`,
    `      const fromDesk = !peeling;
      const crossed = peeling || openId;
      peeling = null;
      sentTask = null;
      if (a === "open-task") {
        /* It goes somewhere now. The note is not touched, not closed and
           not moved: the notebook is exactly as it was when you come
           back to it, which is the promise the receipt already made. */
        refocus = { kind: "act", sel: '[data-act="open-task"]' };
        paint();
        ${S_}.openTask(crossed);
        return;
      }
      say("Done. Your note stayed here.");
      refocus = fromDesk ? { kind: "act", sel: '[data-act="open-task"]' } : { kind: "read" };
      paint();
      return;`,
    "\"In Tasks as …\" opens Tasks and reveals the card",
  ],
], "notes.js"));

await guard("timeline.js");
const core = patch(await read("timeline.render-core.js"), [
  [
    '  function rootEl() { return document.getElementById("deck") || document.body; }',
    `  function rootEl() { return ${S_}.root("timeline"); }`,
    "the decisions live on this product's own app element",
  ],
  [
    `    var page = h("div.tl-page", {}, [
      h("div.tl-stage", {}, [
        caption(state, direction.name),
        direction.render(state),
      ]),
    ]);`,
    `    var page = h("div.tl-page", {}, [
      h("div.tl-stage", {}, [
        /* The caption is gone. shell.css names it itself — "the caption
           that names what medium you are looking at. It is lab furniture,
           not product" — and it was printing
           OWNER · MARA & FINN IN FULL FLIGHT · B · THE APPROACH across the
           top of a production application. Same rule as the console
           chrome: apparatus for reviewing the product is not the product.
           Removed rather than hidden, because there is no production
           version of it to restyle into. */
        direction.render(state),
      ]),
    ]);`,
    "the lab caption is not rendered — it is apparatus, like the console chrome",
  ],
], "timeline.js/render-core");
const renderB = patch(await read("timeline.render-b.js"), [
  [
    `      document.addEventListener("keydown", function (event) {
        var key = (event.key || "").toLowerCase();
        if (key !== "z" || !(event.ctrlKey || event.metaKey) || event.shiftKey) return;`,
    `      document.addEventListener("keydown", function (event) {
        /* The artifact that is not on screen keeps its DOM, and with it a
           .b-undo this would find. A product's keys are its own. */
        if (!${S_}.active("timeline")) return;
        var key = (event.key || "").toLowerCase();
        if (key !== "z" || !(event.ctrlKey || event.metaKey) || event.shiftKey) return;`,
    "the keyboard belongs to the product that is on the floor",
  ],
], "timeline.js/render-b");
await writeFile(path.join(OUT, "timeline.js"),
  "/* Timeline · B · The Approach — render-core.js then render-b.js, as they were\n" +
  "   frozen in the lab. Two patches: rootEl(), and the undo chord. */\n\n" +
  core + "\n\n" + renderB + "\n\n" +
  `/* ══ the decisions the URL carries ═══════════════════════════════
   The lab master's build.mjs put these on <body> and read five of them.
   Nothing may be authored onto <body> here, so the shipping room rides on
   the app element as markup, and the URL carries the two the suite's
   contract names: the state, and the ratified twin.

   ?ground=ink is "After dark" — the same four decisions read in the dark,
   and the room the founder asked for alongside the paper one. It is a
   deep link, not a toggle: there is no theme switch in this chrome. */
(function () {
  var q = ${S_}.params("timeline");
  var root = ${S_}.root("timeline");
  var presets = window.__elevate.presets;
  /* ?ground= is the suite's name for it and ?v= is the lab's name for the
     same room, so the Timeline engagement's own measured gate reaches the
     composed file with its config unchanged. */
  var ground = q.get("ground") || q.get("v");
  if (ground && presets[ground]) {
    Object.keys(presets[ground]).forEach(function (key) {
      root.setAttribute("data-" + key, presets[ground][key]);
    });
    root.setAttribute("data-v", ground);
  }
  var state = q.get("state");
  if (state) root.setAttribute("data-state", state);
})();
`);

/* ── the one world ───────────────────────────────────────────────
   Three fixtures, one clock. Everything else in the three data files is
   already the same world — they all derive from src/lib/review-suite-
   fixture.ts — and fixture.js proves it at load rather than assuming it.
   The single genuine divergence is Notes' NOW, which sits on 15 July
   while the file's own comment, its own `today` string, and both other
   products sit on 16 July. */
await guard("fixture.js");
const notesData = patch(await read("notes.data.js"), [
  [
    `  /* 16 July 2026, 09:00 UTC. The product's DEMO_REFERENCE_TIME. */
  const NOW = Date.UTC(2026, 6, 15, 9, 0, 0);`,
    `  /* 16 July 2026, 09:00 UTC. The product's DEMO_REFERENCE_TIME.
     It said 15 here and 16 in every other sentence it wrote — including
     its own \`today\`, "Thursday 16 July", which is a Thursday, and its
     own subject "Saturday 18 July, in 2 days", which is two days after
     the 16th and four after the 15th. Both other products pin 16 July.
     The comment was right and the number was wrong; the suite runs on
     one clock and this is it. The visible consequence is that notes two
     or more days old now name the weekday they were actually written
     on. */
  const NOW = WORLD.nowUTC;`,
    "Notes' clock moves from 15 July to the 16 July every other surface is on",
  ],
], "fixture.js/notes.data");

await writeFile(path.join(OUT, "fixture.js"),
  (await readFile(path.join(LAB, "tools", "world.head.js"), "utf8")) + "\n\n" +
  "/* ══ Tasks · data.js ═══════════════════════════════════════════ */\n" +
  (await read("tasks.data.js")) + "\n\n" +
  "/* ══ Notes · data.js ═══════════════════════════════════════════ */\n" +
  notesData + "\n\n" +
  "/* ══ Timeline · fixture.js ═════════════════════════════════════ */\n" +
  (await read("timeline.fixture.js")) + "\n\n" +
  (await readFile(path.join(LAB, "tools", "world.foot.js"), "utf8")) + "\n");

await guard("icons.js");
await writeFile(path.join(OUT, "icons.js"), await read("icons.js"));

await guard("foundation.css");
await writeFile(path.join(OUT, "foundation.css"), await read("foundation.css"));

/* ── what was taken out of the products ──────────────────────────── */
process.stdout.write(`\n${report.dropped.length} selector(s) handed to shell.css:\n`);
for (const d of report.dropped) {
  process.stdout.write(`   ${d.product.padEnd(9)} ${(d.at.join(" | ") + (d.at.length ? "  >>  " : "")) + d.sel}\n`);
}
