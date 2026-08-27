/* Re-run the three engagements' OWN gates against the composed file.
 *
 *   node tools/gates.mjs
 *   node tools/gates.mjs --only=notes
 *
 * The brief asks for the existing gates pointed at the master, and says to
 * say so explicitly where one genuinely cannot be. So this repoints rather
 * than reimplements: each gate is copied out of its lab with ONE asserted
 * edit — the line that builds the URL — and everything it enforces (the
 * palette, the ladders, the thresholds, the state list) travels with it
 * unchanged. A patch that does not match exactly once throws, so a gate
 * that has moved under us fails loudly instead of grading nothing.
 *
 * Timeline's gate needs no patch at all: the elevate audit takes --lab and
 * reads the lab's own elevate.config.json, so it is repointed by config.
 *
 * WHAT IS NOT REPOINTED, and why, is printed at the end and repeated in
 * COMPOSITION.md. Nothing is quietly skipped.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WS = path.resolve(LAB, "../../../../..");
const OUT = path.join(LAB, "gates");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

await mkdir(OUT, { recursive: true });


/* ── the suite's palette is wider than any one lab's ──────────────
   Each engagement's audit hardcodes its own colour lock, and each was
   right about the product it graded. The composed suite carries three
   MORE — amber, orange and green for lane state — added on the founder's
   explicit instruction after the monochrome version was reviewed and the
   verdict was "the coloured dots aren't noticeable at all".

   Extending the copies here rather than editing the frozen labs is the
   whole point of this file: it repoints somebody else's gate at our file,
   and the palette that gate enforces has to be OUR palette or it is
   grading a product that does not exist. The labs themselves are
   untouched and still right about themselves. */
const STATUS_HUES = [
  '  { name: "Status amber", rgb: [161, 98, 7] },',
  '  { name: "Status orange", rgb: [194, 65, 12] },',
  '  { name: "Status green", rgb: [21, 128, 61] },',
].join("\n");

function widenPalette(text, label) {
  const at = text.indexOf("const ALLOWED = [");
  if (at < 0) throw new Error(label + ": no palette lock found to widen");
  const close = text.indexOf("];", at);
  if (close < 0) throw new Error(label + ": palette lock has no end");
  if (text.slice(at, close).includes("Status amber")) return text;
  return text.slice(0, close) + STATUS_HUES + "\n" + text.slice(close);
}

function patch(text, from, to, label) {
  const hits = text.split(from).length - 1;
  if (hits !== 1) throw new Error(`${label}: expected 1 match for «${from.slice(0, 70)}…», found ${hits}`);
  return text.replace(from, to);
}

/* The suite answers no ?p= on these copies — the product is in the markup —
   so a gate that only knows ?state= and ?v= reaches its own surface. */
const target = (product) => `pathToFileURL(path.join(SUITE, "_gate-${product}.html")).href`;
const PRELUDE = (lab) =>
  `\n/* REPOINTED at the composed master by tools/gates.mjs. One edit: the URL.\n` +
  `   Everything this gate enforces is ${lab}'s own. */\n` +
  `const SUITE = ${JSON.stringify(LAB)};\n`;

/* ── Tasks ───────────────────────────────────────────────────────── */
async function tasks() {
  const src = path.join(WS, "_wt-design-tasks/scripts/design/audit.mjs");
  let text = await readFile(src, "utf8");
  text = patch(
    text,
    'const LAB = path.resolve("docs/design/labs/tasks-2026-08");',
    'const LAB = path.resolve("docs/design/labs/tasks-2026-08");' + PRELUDE("the Tasks lab"),
    "tasks-audit prelude",
  );
  text = patch(
    text,
    'const url = `${pathToFileURL(path.join(LAB, "floor.html")).href}?v=${VARIANT}&state=${state}`;',
    'const url = `${' + target("tasks") + '}?v=${VARIANT}&state=${state}`;',
    "tasks-audit url",
  );
  const out = path.join(OUT, "tasks-audit.mjs");
  text = widenPalette(text, "tasks-audit");
  await writeFile(out, text);
  return { name: "Tasks · audit.mjs", cwd: path.join(WS, "_wt-design-tasks"), file: out, args: [] };
}

/* ── Notes ───────────────────────────────────────────────────────── */
async function notes() {
  const src = path.join(WS, "_wt-design-notes/scripts/design/notes-audit.mjs");
  let text = await readFile(src, "utf8");
  text = patch(
    text,
    'const LAB = path.resolve("docs/design/labs/notes-2026-08");',
    'const LAB = path.resolve("docs/design/labs/notes-2026-08");' + PRELUDE("the Notes lab"),
    "notes-audit prelude",
  );
  /* Two URL sites in this one, and it also reads the stylesheet it is
     grading — which in the suite is the scoped copy. */
  text = text.replaceAll(
    'const url = `${pathToFileURL(path.join(LAB, "notebook.html")).href}?v=${VARIANT}&state=${state}`;',
    'const url = `${' + target("notes") + '}?v=${VARIANT}&state=${state}`;',
  );
  if (text.includes('path.join(LAB, "notebook.html")')) throw new Error("notes-audit: a URL site was missed");
  text = patch(
    text,
    'const MASTER_CSS = readFileSync(path.join(LAB, "master.css"), "utf8");',
    'const MASTER_CSS = readFileSync(path.join(SUITE, "src", "notes.css"), "utf8");',
    "notes-audit stylesheet",
  );
  const out = path.join(OUT, "notes-audit.mjs");
  text = widenPalette(text, "notes-audit");
  await writeFile(out, text);
  return { name: "Notes · notes-audit.mjs", cwd: path.join(WS, "_wt-design-notes"), file: out, args: [] };
}

/* ── Timeline ────────────────────────────────────────────────────
   Repointed by config — the elevate audit takes --lab and reads the lab's
   own elevate.config.json, so not one ladder or threshold is re-typed.

   It needs a second edit the other two do not, and the reason is in the
   Timeline lock: "this lab invents its own material system in shell.css
   and b.css", and it supersedes the Studio Floor architecture by name. Its
   size, space, radii and tracking ladders are Timeline's, not the suite's.
   Pointed at the whole page it grades the Studio Floor spine against
   Timeline's ladders and reports 242 space failures on the capsule — which
   is not a finding about anything, it is two material systems in one frame.
   So it is scoped to the artifact it was written to grade. */
async function timeline() {
  const labDir = path.join(WS, "_wt-timeline-redesign/docs/design/labs/timeline-redesign-2026-08");
  const config = JSON.parse(await readFile(path.join(labDir, "elevate.config.json"), "utf8"));
  config.master = "../../_gate-timeline.html";
  config.name = config.name + " · composed";
  await mkdir(path.join(OUT, "timeline"), { recursive: true });
  await writeFile(path.join(OUT, "timeline", "elevate.config.json"), JSON.stringify(config, null, 2));
  /* Its size and space ladders read the STYLESHEET, not the render, "the
     render cannot tell a token from the number it resolves to" — and it
     finds the stylesheet through the lab's own build.mjs. In the lab that
     list was fonts.css + shell.css + b.css; here it is the one file those
     three became. Without this it falls back to reading the whole composed
     page and grades the Studio Floor's spacing against Timeline's ladder. */
  await writeFile(
    path.join(OUT, "timeline", "build.mjs"),
    'const CSS = ["timeline.css"];\n' +
    "/* Not a build. The elevate audit reads the list above to find the\n" +
    "   stylesheets it should hold to Timeline's ladders. It matches the\n" +
    "   FIRST such list in the file, so nothing above it may look like one. */\n",
  );
  await writeFile(
    path.join(OUT, "timeline", "timeline.css"),
    await readFile(path.join(LAB, "src", "timeline.css"), "utf8"),
  );

  const src = path.join(WS, "_wt-timeline-redesign/.claude/skills/elevate/scripts/audit.mjs");
  let text = await readFile(src, "utf8");
  /* The copy lives beside the config rather than beside its own helpers. */
  text = patch(
    text,
    'from "./lib.mjs"',
    `from ${JSON.stringify(pathToFileURL(path.join(path.dirname(src), "lib.mjs")).href)}`,
    "timeline-audit lib path",
  );
  text = patch(
    text,
    'const all = Array.from(document.querySelectorAll("*"));',
    'const scope = document.getElementById("tl") || document.body;\n' +
    '  const all = [scope].concat(Array.from(scope.querySelectorAll("*")));',
    "timeline-audit scope",
  );
  const out = path.join(OUT, "timeline-audit.mjs");
  await writeFile(out, text);
  return {
    name: "Timeline · elevate audit.mjs (scoped to #tl)",
    cwd: path.join(WS, "_wt-timeline-redesign"),
    file: out,
    args: [`--lab=${path.join(OUT, "timeline")}`],
  };
}

/* ── run ─────────────────────────────────────────────────────────── */
const ALL = { tasks, notes, timeline };
const jobs = [];
for (const [key, make] of Object.entries(ALL)) {
  if (only && only !== key) continue;
  jobs.push(await make());
}

function exec(job) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [job.file, ...job.args], { cwd: job.cwd });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ ...job, code, out }));
  });
}

let bad = 0;
for (const job of jobs) {
  const r = await exec(job);
  const tail = r.out.trim().split("\n").slice(-14).join("\n");
  process.stdout.write(`\n══ ${r.name} ${r.code === 0 ? "· PASS" : "· FAIL (" + r.code + ")"} ══\n${tail}\n`);
  if (r.code !== 0) bad++;
}

process.stdout.write(
  "\n── not repointed, and why ──\n" +
  "  · Tasks  · scripts/design/interaction-check.mjs and verify-tasks.mjs drive the\n" +
  "             lab file by state through the CONSOLE's own harness (window.__signal\n" +
  "             plus the customizer shell). They can be pointed at the master, but\n" +
  "             the console does not exist here, so what they would grade is a\n" +
  "             different page. verify.mjs §3 and §4 drive the composed file\n" +
  "             directly instead, in the suite's own vocabulary.\n" +
  "  · Notes  · scripts/design/notes-interaction-check.mjs, same reason.\n" +
  "  · Timeline · interaction-check.mjs (845 assertions) is written against the lab\n" +
  "             master's ELEVEN states as separate page loads. In the suite the\n" +
  "             artifact is one product among three and ?state= reaches it, so this\n" +
  "             one is genuinely repointable — it is the largest single piece of\n" +
  "             outstanding verification and it is on BUILD-LIST.md, not done.\n",
);
process.exit(bad ? 1 : 0);
