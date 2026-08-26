/* The 21 colliding class names, rule by rule, Tasks against Notes.
 *
 *   node tools/shell-diff.mjs            # the summary
 *   node tools/shell-diff.mjs --full     # every rule text
 *
 * "That is not a conflict to work around. It is proof they are one
 * architecture with two sheets inside it." — true of the spine. This tells
 * us exactly how far it is true of the rest, so the extraction is a
 * measurement rather than a hope.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, selectors, classesIn, norm } from "./css.mjs";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const S = (f) => readFile(path.join(LAB, "_source", f), "utf8");
const full = process.argv.includes("--full");

const floorHtml = await S("tasks.floor.html");
const tasks = parse(floorHtml.slice(floorHtml.indexOf("<style>") + 7, floorHtml.indexOf("</style>")), "tasks");
const notes = parse(await S("notes.master.css"), "notes");

const SHELL = "dock dockAvatar dockField dockRule floor head headActions headName headRule rail railAvatar railDivider railGroup railMark railSpacer railTile sheet sk spec sr word".split(" ");
const SHELLSET = new Set(SHELL);

/* A rule "belongs to" the shell when EVERY one of its selectors mentions at
   least one shell class. A rule that mixes a shell class with a product
   class is product surface reaching into the shell, and is listed apart. */
function bucket(nodes) {
  const pure = [], mixed = [];
  for (const n of nodes) {
    if (n.kind !== "rule") continue;
    const parts = selectors(n.selector);
    const touches = parts.some((s) => [...classesIn(s)].some((c) => SHELLSET.has(c)));
    if (!touches) continue;
    const onlyShell = parts.every((s) => {
      const cs = [...classesIn(s)];
      return cs.length > 0 && cs.every((c) => SHELLSET.has(c));
    });
    (onlyShell ? pure : mixed).push(n);
  }
  return { pure, mixed };
}

const bT = bucket(tasks), bN = bucket(notes);
const key = (n) => (n.at.length ? n.at.join(" | ") + " || " : "") + norm(n.selector);
const text = (n) => key(n) + " { " + norm(n.body) + " }";

console.log(`rules touching a shell class — tasks ${bT.pure.length + bT.mixed.length} · notes ${bN.pure.length + bN.mixed.length}`);
console.log(`  shell-only:  tasks ${bT.pure.length} · notes ${bN.pure.length}`);
console.log(`  mixed:       tasks ${bT.mixed.length} · notes ${bN.mixed.length}`);

const mapT = new Map(), mapN = new Map();
for (const n of bT.pure) mapT.set(key(n), (mapT.get(key(n)) || []).concat(norm(n.body)));
for (const n of bN.pure) mapN.set(key(n), (mapN.get(key(n)) || []).concat(norm(n.body)));

const both = [...mapT.keys()].filter((k) => mapN.has(k));
const same = both.filter((k) => mapT.get(k).join(";") === mapN.get(k).join(";"));
const diff = both.filter((k) => !same.includes(k));

console.log(`\nshell-only selectors: ${mapT.size} tasks · ${mapN.size} notes`);
console.log(`  in both, byte-identical body:  ${same.length}`);
console.log(`  in both, different body:       ${diff.length}`);
console.log(`  tasks only:                    ${mapT.size - both.length}`);
console.log(`  notes only:                    ${mapN.size - both.length}`);

console.log("\n── in both, DIFFERENT body ──");
for (const k of diff) {
  console.log(`\n  ${k}`);
  console.log(`    T  ${mapT.get(k).join(" ;; ")}`);
  console.log(`    N  ${mapN.get(k).join(" ;; ")}`);
}

/* Per class, which side declares it at all. */
console.log("\n── per shell class · shell-only rule counts ──");
const count = (map, c) => [...map.keys()].filter((k) => classesIn(k).has(c)).length;
for (const c of SHELL) {
  console.log(`  .${c.padEnd(14)} tasks ${String(count(mapT, c)).padStart(3)}   notes ${String(count(mapN, c)).padStart(3)}`);
}

if (full) {
  console.log("\n── TASKS shell-only, in order ──");
  for (const n of bT.pure) console.log("  " + text(n));
  console.log("\n── NOTES shell-only, in order ──");
  for (const n of bN.pure) console.log("  " + text(n));
  console.log("\n── TASKS mixed ──");
  for (const n of bT.mixed) console.log("  " + key(n));
  console.log("\n── NOTES mixed ──");
  for (const n of bN.mixed) console.log("  " + key(n));
}
