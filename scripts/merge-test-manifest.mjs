#!/usr/bin/env node
/**
 * Union-merge a conflicted `package.json` test manifest.
 *
 * Every lane in this programme registers its new test files in the same
 * `scripts.test` string, so every lane rebase conflicts on that one line. Taking
 * either side silently unregisters the other lane's tests — and a test this repo
 * does not run is a test that has stopped working without telling anyone.
 *
 * This takes the union: start from the base side (main, which already carries
 * previously merged lanes) and re-insert only the entries the incoming side
 * added, each before the anchor it was originally placed before. Refuses rather
 * than guesses when it cannot preserve position.
 *
 * Usage: node scripts/merge-test-manifest.mjs [path/to/package.json]
 */
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2] ?? "package.json";
const lines = readFileSync(file, "utf8").split("\n");

const start = lines.findIndex((l) => l.startsWith("<<<<<<<"));
const mid = lines.findIndex((l) => l.startsWith("======="));
const end = lines.findIndex((l) => l.startsWith(">>>>>>>"));

if (start === -1 || mid === -1 || end === -1) {
  console.error("merge-test-manifest: no conflict markers found — nothing to do");
  process.exit(1);
}

const oursRaw = lines.slice(start + 1, mid).join("\n");
const theirsRaw = lines.slice(mid + 1, end).join("\n");

/** Every `<path>.test.<ext>` token in a manifest string. */
const entries = (s) => new Set(s.match(/[\w./@-]+\.test\.[a-z]+/g) ?? []);

const ours = entries(oursRaw);
const theirs = entries(theirsRaw);
const added = [...theirs].filter((e) => !ours.has(e));
const lost = [...ours].filter((e) => !theirs.has(e));

if (added.length === 0) {
  console.log("merge-test-manifest: incoming side adds nothing new; taking base side");
} else {
  console.log(`merge-test-manifest: re-inserting ${added.length} entry(ies): ${added.join(", ")}`);
}
if (lost.length > 0) {
  console.log(`merge-test-manifest: base side has ${lost.length} entry(ies) the incoming side lacks (kept): ${lost.join(", ")}`);
}

let merged = oursRaw;
for (const entry of added) {
  // Re-insert before whatever token followed it on the incoming side, so the
  // entry keeps its original grouping (`node --test` vs `--import tsx --test`).
  const after = theirsRaw.slice(theirsRaw.indexOf(entry) + entry.length).trimStart();
  const anchor = (after.match(/^[\w./@-]+\.test\.[a-z]+/) ?? [])[0];

  if (anchor && merged.includes(anchor)) {
    merged = merged.replace(anchor, `${entry} ${anchor}`);
    continue;
  }
  // No usable anchor: refuse rather than append into an arbitrary runner group,
  // which would run the file under the wrong loader and fail confusingly.
  console.error(
    `merge-test-manifest: cannot place ${entry} — its following anchor ${anchor ?? "(none)"} is absent from the base side. Resolve by hand.`,
  );
  process.exit(2);
}

writeFileSync(file, [...lines.slice(0, start), merged, ...lines.slice(end + 1)].join("\n"));

const parsed = JSON.parse(readFileSync(file, "utf8"));
const final = entries(parsed.scripts.test);
const missing = [...new Set([...ours, ...theirs])].filter((e) => !final.has(e));
if (missing.length > 0) {
  console.error(`merge-test-manifest: POST-CHECK FAILED, dropped: ${missing.join(", ")}`);
  process.exit(3);
}
console.log(`merge-test-manifest: ok — ${final.size} test entries, none dropped`);
