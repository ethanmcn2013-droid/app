// Corrections found by reading the rendered pages rather than the source.
//
//   node scripts/design/family/fixups.mjs
//
// 1. One number, three answers. The Notes log's chip row said 247 findings
//    confirmed while its own brief, four inches below, said 195 defects
//    closed. Both were computed, both were defensible, and together they were
//    indefensible. The family now quotes one figure everywhere — findings
//    confirmed by the refuter — because that is the figure Tasks (421) and
//    Timeline (251) quote, and the comparison table is worthless if the three
//    columns are counting different things.
//
// 2. A rule meant for one span caught two. `.briefScore span` set display
//    block, which also hit the nested span holding the round number, so the
//    label broke as "THE FLOOR · ROUND / 14" no matter what white-space said.
//
// 3. The masthead's second line sat at the faintest ink in the ladder. At
//    5.2rem across two lines that is not restraint, it is a legibility cost.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const WS = "C:/Users/ethan/signal-studio-workspace";
const N = path.join(WS, "_wt-design-notes/docs/design/labs/notes-2026-08");

let n = 0;
const edit = (file, from, to, expect = 1) => {
  const p = path.isAbsolute(file) ? file : path.join(N, file);
  const s = readFileSync(p, "utf8");
  const hits = s.split(from).length - 1;
  if (hits !== expect) {
    console.log(`  SKIP ${path.basename(p)} — expected ${expect} of "${from.slice(0, 46)}…", found ${hits}`);
    return;
  }
  writeFileSync(p, s.split(from).join(to), "utf8");
  console.log(`  ok   ${path.basename(p)} — ${hits}x ${from.slice(0, 52).replace(/\s+/g, " ")}…`);
  n += hits;
};

console.log("the log — one figure, not two");
edit(
  "log.shell.html",
  'fixed += (r.confirmed || []).filter((f) => f.done && !/ERROR/i.test(f.done)).length;',
  'fixed += (r.confirmed || []).length;\n    verified += (r.confirmed || []).filter((f) => f.done && !/ERROR/i.test(f.done)).length;',
);
edit("log.shell.html", "let fixed = 0, refuted = 0;", "let fixed = 0, refuted = 0, verified = 0;");
edit("log.shell.html", 'put("briefRefuted", String(refuted));', 'put("briefRefuted", String(refuted));\n  put("briefVerified", String(verified));');

console.log("the log — the label that broke in two");
edit(
  "log.shell.html",
  ".briefScore span { display: block;",
  ".briefScore > span { display: block;",
);
edit(
  "log.shell.html",
  '<span style="white-space: nowrap;">The floor &middot; round <span id="briefRound">—</span></span>',
  '<span>The floor &middot; round&nbsp;<span id="briefRound">—</span></span>',
);

console.log("the retrospective — the same figure it reports on");
edit("retro.html", "closed 195 defects.", "closed 247 defects.");
edit("retro.html", "Fourteen rounds and 195 fixes live in", "Fourteen rounds and 247 fixes live in");
edit("retro.html", "195 ids.", "218 ids.");

console.log("the masthead — the ghost line, legible");
const rep = path.join(WS, "_wt-design-notes/scripts/design/family/report.mjs");
{
  const s = readFileSync(rep, "utf8");
  const from = `.mast h1 em {
  display: block;
  font-style: normal;
  font-weight: 600;
  color: var(--t4);
  letter-spacing: -0.048em;
}`;
  const to = `.mast h1 em {
  display: block;
  font-style: normal;
  font-weight: 600;
  font-size: 0.86em;
  color: var(--t3);
  letter-spacing: -0.046em;
  margin-top: 0.06em;
  text-wrap: balance;
}`;
  if (s.includes(from)) {
    writeFileSync(rep, s.replace(from, to), "utf8");
    console.log("  ok   report.mjs — second line raised out of the faintest ink");
    n++;
  } else console.log("  SKIP report.mjs — masthead em rule already changed");
}

console.log(`\n${n} correction(s) written.`);
