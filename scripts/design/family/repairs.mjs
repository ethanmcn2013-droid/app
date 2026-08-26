// Five defects the family gate found in the sibling sessions' own pages.
//
//   node scripts/design/family/repairs.mjs
//
// None of these were introduced by the rail — verify.mjs measures which
// element overflows, and in every case it was the page's own content. They
// are fixed here because a report that scrolls sideways on a phone is not
// at the standard the reports are reporting on.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const WS = "C:/Users/ethan/signal-studio-workspace";
const TASKS = path.join(WS, "_wt-design-tasks/docs/design/labs/tasks-2026-08");
const TL = path.join(WS, "_wt-timeline-redesign/docs/design/labs/timeline-redesign-2026-08");

let n = 0;
const edit = (file, from, to, why) => {
  const s = readFileSync(file, "utf8");
  const hits = s.split(from).length - 1;
  if (hits !== 1) {
    console.log(`  SKIP  ${path.basename(file)} — ${why} (found ${hits} anchors, expected 1)`);
    return;
  }
  writeFileSync(file, s.split(from).join(to), "utf8");
  console.log(`  ok    ${path.basename(file)} — ${why}`);
  n++;
};

/* ── A · Tasks console: the screen tabs ran 41px past the phone ─────────
   An inline-flex pill row cannot shrink, so it pushed the page sideways.
   It becomes its own scroller at phone widths, which is what the rail
   already does one band above it. */
edit(
  path.join(TASKS, "customizer.shell.html"),
  ".stageTabs { display: inline-flex; gap: 3px; padding: 3px; background: var(--ui-panel); border-radius: 999px; box-shadow: inset 0 0 0 1px var(--ui-line); }",
  `.stageTabs { display: inline-flex; gap: 3px; padding: 3px; background: var(--ui-panel); border-radius: 999px; box-shadow: inset 0 0 0 1px var(--ui-line); }
@media (max-width: 760px) {
  /* the pill row cannot shrink, so it scrolls inside itself rather than
     taking the page with it */
  .stageTabs { display: flex; max-width: 100%; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; }
  .stageTabs::-webkit-scrollbar { display: none; }
  .stageTabs > * { flex: 0 0 auto; }
}`,
  "screen tabs scroll inside themselves on a phone",
);

/* ── B · Tasks log: nineteen rounds of scores in one row ────────────────
   The score history is 516px of tabular figures next to a 390px screen.
   The bar beside it already draws the same history; on a phone only the
   current round's score is kept. */
edit(
  path.join(TASKS, "report.shell.html"),
  ".scores span:last-child { font-size: 15px; font-weight: 600; color: var(--ink-1); }",
  `.scores span:last-child { font-size: 15px; font-weight: 600; color: var(--ink-1); }
@media (max-width: 760px) {
  /* nineteen rounds of figures do not fit a phone, and the track beside
     them already draws the history — keep the round that is current */
  .scores { min-width: 0; }
  .scores span:not(:last-child) { display: none; }
}`,
  "score history folds to the current round on a phone",
);

/* ── C · Timeline 9.5 Question: a two-column verdict that never collapsed
   minmax(0, 260px) + 44px gap left 30px for the seat list, which then ran
   113px off the screen. */
edit(
  path.join(TL, "session-record.html"),
  "  .verdict { display: grid; grid-template-columns: minmax(0, 260px) minmax(0, 1fr); gap: 44px; align-items: start; }",
  `  .verdict { display: grid; grid-template-columns: minmax(0, 1fr); gap: 32px; align-items: start; }
  @media (min-width: 760px) { .verdict { grid-template-columns: minmax(0, 260px) minmax(0, 1fr); gap: 44px; } }
  .seats { min-width: 0; }`,
  "the verdict collapses to one column before it runs off the screen",
);

/* ── D · Timeline log: a script outliving its markup ────────────────────
   The bottom-of-page set nav was removed when the rail moved to the top.
   Its builder stayed behind and threw on every load, which also stopped
   everything after it in the same block from running. */
edit(
  path.join(TL, "report.shell.html"),
  `  if (cards.length > 1) {
    document.getElementById("setGrid").innerHTML = cards.join("");
    document.getElementById("setNav").hidden = false;
  }`,
  `  /* The set now lives in the rail at the top of the page, generated at
     build time. This block is kept harmless rather than deleted so the
     surrounding numbering still matches the source it was written from. */
  const setGrid = document.getElementById("setGrid");
  const setNav = document.getElementById("setNav");
  if (cards.length > 1 && setGrid && setNav) {
    setGrid.innerHTML = cards.join("");
    setNav.hidden = false;
  }`,
  "the retired set-nav builder no longer throws on load",
);

/* ── E · Timeline console: the lab's directory name on the page ─────────
   config.name is "timeline-redesign" because that is what the lab folder
   is called. The reader should see the product. */
edit(
  path.join(TL, "console.shell.html"),
  `  document.title = (META.name ? cap(META.name) + " " : "") + "Design Console";
  document.getElementById("brandWord").textContent = META.name || "design";`,
  `  /* META.name is the lab's directory name, not the product's. The shell
     already carries the right title; do not overwrite it with the folder. */
  const shown = META.display || (META.name || "").replace(/-redesign$/, "");
  if (shown) document.title = cap(shown) + " Design Console";
  document.getElementById("brandWord").textContent = shown || "design";`,
  "the console shows the product's name, not the lab folder's",
);

console.log(`\n${n} repair(s) written.`);
