/* What the three stylesheets actually say, measured rather than assumed.
 *
 *   node tools/survey.mjs
 *
 * Answers, in order, the four questions the composition turns on:
 *   1. which class names Tasks and Notes share, and whether every one is shell
 *   2. whether Timeline shares a class name with either
 *   3. which custom properties collide, and where the values differ
 *   4. which non-class selectors (element, :root, html, body) collide
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, selectors, declarations, classesIn, norm } from "./css.mjs";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const S = (f) => readFile(path.join(LAB, "_source", f), "utf8");

const floorHtml = await S("tasks.floor.html");
const tasksCss = floorHtml.slice(floorHtml.indexOf("<style>") + 7, floorHtml.indexOf("</style>"));
const notesCss = await S("notes.master.css");
const tlCss = (await S("timeline.shell.css")) + "\n" + (await S("timeline.b.css"));
const foundation = await S("foundation.css");

const sheets = {
  foundation: parse(foundation, "foundation.css"),
  tasks: parse(tasksCss, "floor.html <style>"),
  notes: parse(notesCss, "master.css"),
  timeline: parse(tlCss, "shell.css + b.css"),
};

for (const [name, nodes] of Object.entries(sheets)) {
  const rules = nodes.filter((n) => n.kind === "rule").length;
  console.log(`${name.padEnd(10)} ${String(nodes.length).padStart(5)} nodes · ${rules} rules`);
}

/* ── 1 + 2 · class names ─────────────────────────────────────────── */
function classes(nodes) {
  const set = new Set();
  for (const n of nodes) {
    if (n.kind !== "rule") continue;
    for (const c of classesIn(n.selector)) set.add(c);
  }
  return set;
}
const cT = classes(sheets.tasks), cN = classes(sheets.notes), cM = classes(sheets.timeline);
const inter = (a, b) => [...a].filter((x) => b.has(x)).sort();

console.log("\n── class names ──");
console.log(`tasks ${cT.size} · notes ${cN.size} · timeline ${cM.size}`);
const tn = inter(cT, cN);
console.log(`tasks ∩ notes    ${tn.length}: ${tn.join(" ")}`);
console.log(`tasks ∩ timeline ${inter(cT, cM).length}: ${inter(cT, cM).join(" ") || "—"}`);
console.log(`notes ∩ timeline ${inter(cN, cM).length}: ${inter(cN, cM).join(" ") || "—"}`);

/* ── 3 · custom properties ───────────────────────────────────────── */
function props(nodes) {
  const map = new Map();
  for (const n of nodes) {
    if (n.kind !== "rule") continue;
    for (const d of declarations(n.body)) {
      if (!d.prop.startsWith("--")) continue;
      const key = d.prop;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ selector: n.selector, at: n.at, value: norm(d.value) });
    }
  }
  return map;
}
const pF = props(sheets.foundation), pT = props(sheets.tasks), pN = props(sheets.notes), pM = props(sheets.timeline);

function root(map, key) {
  const hits = (map.get(key) || []).filter((h) => !h.at.length && /^(:root|html|body)/.test(h.selector));
  return hits.length ? hits[hits.length - 1].value : null;
}

console.log("\n── custom properties declared at :root in more than one sheet ──");
const all = new Set([...pT.keys(), ...pN.keys(), ...pM.keys(), ...pF.keys()]);
const rows = [];
for (const key of [...all].sort()) {
  const vals = {
    foundation: root(pF, key),
    tasks: root(pT, key),
    notes: root(pN, key),
    timeline: root(pM, key),
  };
  const present = Object.entries(vals).filter(([, v]) => v !== null);
  if (present.length < 2) continue;
  const distinct = new Set(present.map(([, v]) => v));
  rows.push({ key, vals, agree: distinct.size === 1 });
}
const disagree = rows.filter((r) => !r.agree);
console.log(`${rows.length} shared, ${disagree.length} disagree\n`);
const w = Math.max(...rows.map((r) => r.key.length));
for (const r of rows) {
  const cells = ["foundation", "tasks", "notes", "timeline"]
    .map((k) => (r.vals[k] === null ? "·" : r.vals[k]))
    .map((v) => v.padEnd(28));
  console.log(`${r.agree ? "  " : "!!"} ${r.key.padEnd(w)}  ${cells.join(" ")}`);
}

/* ── 4 · non-class selectors ─────────────────────────────────────── */
console.log("\n── element / :root / html / body selectors, per sheet ──");
for (const [name, nodes] of Object.entries(sheets)) {
  const bare = new Set();
  for (const n of nodes) {
    if (n.kind !== "rule") continue;
    for (const s of selectors(n.selector)) {
      if (/^[.#\[]/.test(s)) continue;
      const first = s.split(/[\s>+~]/)[0];
      if (/^[.#\[]/.test(first)) continue;
      bare.add(s);
    }
  }
  console.log(`\n${name} (${bare.size}):`);
  for (const s of [...bare].sort()) console.log("   " + s);
}
