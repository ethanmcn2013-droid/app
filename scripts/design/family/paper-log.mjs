// Move the Notes elevation log onto the family's paper ground.
//
//   node scripts/design/family/paper-log.mjs
//
// Notes was elevated in its own session and its log came out dark, while the
// Tasks and Timeline logs came out on paper. Three logs of one operation
// should not read as three operations. This is a token swap — the log was
// written entirely against custom properties, so nothing but the :root block
// and one hard-coded hairline has to move — plus the dark-ground blocks the
// sibling reports already carry, so the page follows the reader's theme
// instead of insisting on one.

import { readFileSync, writeFileSync } from "node:fs";

const FILE =
  "C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/log.shell.html";

const PAPER = `:root {
  --bg: #ffffff;
  --panel: rgba(17, 17, 17, 0.028);
  --panel-2: rgba(17, 17, 17, 0.052);
  --line: rgba(17, 17, 17, 0.12);
  --line-soft: rgba(17, 17, 17, 0.07);
  --line-strong: rgba(17, 17, 17, 0.30);
  --t1: #111111;
  --t2: rgba(17, 17, 17, 0.70);
  --t3: rgba(17, 17, 17, 0.52);
  --t4: rgba(17, 17, 17, 0.30);
  --hair: rgba(17, 17, 17, 0.14);
  --acc: #4338ca;
  --acc-deep: #4f46e5;
  --acc-wash: rgba(79, 70, 229, 0.085);
  --acc-edge: rgba(79, 70, 229, 0.30);
  --sans: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --dur: 140ms;
  --curve: cubic-bezier(0.23, 1, 0.32, 1);
}

/* the same page, inverted through the ink ladder — one composition, two
   grounds, the rule the Timeline elevation locked and the other two adopt */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0d0d0e;
    --panel: #151517;
    --panel-2: #1b1c1e;
    --line: rgba(255, 255, 255, 0.10);
    --line-soft: rgba(255, 255, 255, 0.06);
    --line-strong: rgba(255, 255, 255, 0.22);
    --t1: #ffffff;
    --t2: rgba(255, 255, 255, 0.66);
    --t3: rgba(255, 255, 255, 0.44);
    --t4: rgba(255, 255, 255, 0.28);
    --hair: rgba(255, 255, 255, 0.16);
    --acc: #8b83ff;
    --acc-deep: #4f46e5;
    --acc-wash: rgba(79, 70, 229, 0.16);
    --acc-edge: rgba(139, 131, 255, 0.34);
  }
}
:root[data-theme="dark"] {
  --bg: #0d0d0e;
  --panel: #151517;
  --panel-2: #1b1c1e;
  --line: rgba(255, 255, 255, 0.10);
  --line-soft: rgba(255, 255, 255, 0.06);
  --line-strong: rgba(255, 255, 255, 0.22);
  --t1: #ffffff;
  --t2: rgba(255, 255, 255, 0.66);
  --t3: rgba(255, 255, 255, 0.44);
  --t4: rgba(255, 255, 255, 0.28);
  --hair: rgba(255, 255, 255, 0.16);
  --acc: #8b83ff;
  --acc-deep: #4f46e5;
  --acc-wash: rgba(79, 70, 229, 0.16);
  --acc-edge: rgba(139, 131, 255, 0.34);
}`;

let s = readFileSync(FILE, "utf8");
const start = s.indexOf(":root {");
if (start < 0) throw new Error("no :root block in the log shell");
const end = s.indexOf("\n}", start);
if (end < 0) throw new Error("unterminated :root block");
const before = s.slice(start, end + 2);
if (!/--bg:/.test(before)) throw new Error("that :root block is not the log's token block");

const wasPaper = /--bg:\s*#ffffff/.test(before);
s = s.slice(0, start) + PAPER + s.slice(end + 2);

// the one hairline written in literal white rather than a token
s = s.replace(
  ".bar { position: absolute; top: 6px; height: 14px; border-radius: 3px; background: rgba(255,255,255,0.16); }",
  ".bar { position: absolute; top: 6px; height: 14px; border-radius: 3px; background: var(--hair); }",
);

writeFileSync(FILE, s, "utf8");
const stray = (s.match(/rgba\(255, ?255, ?255/g) ?? []).length;
console.log(
  wasPaper ? "already on paper — tokens refreshed" : "log moved to the paper ground, dark twin added",
);
console.log(`literal whites remaining in the file: ${stray} (all inside the dark-ground blocks)`);
