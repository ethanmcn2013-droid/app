/* Every finding this programme has already confirmed and fixed, as a
 * flat list of ids for the gate round to hand its seats and its
 * refuters.
 *
 *   node scripts/design/notes-ledger.mjs           # human-readable
 *   node scripts/design/notes-ledger.mjs --json    # for the runner args
 *
 * Why this exists: across nine rounds the panel re-raised the same
 * classes repeatedly — "pile" reached the accessibility tree three
 * separate times, the undo strip painting over the pile four times, the
 * phone row being a stub in five rounds. Each re-raise costs a seat's
 * blocker slot, a refuter, and a round of the programme's attention.
 * Seats get the closed list up front now, and a re-raise without
 * evidence of an actual regression is refuted on sight.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const LAB = path.resolve("docs/design/labs/notes-2026-08");
const panel = JSON.parse(await readFile(path.join(LAB, "panel.json"), "utf8"));

const ids = [];
const byRound = [];
for (const round of panel.rounds || []) {
  const fixed = (round.confirmed || []).map((f) => f.id);
  byRound.push({ round: round.round, fixed });
  for (const id of fixed) if (!ids.includes(id)) ids.push(id);
}

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify(ids));
} else {
  for (const r of byRound) {
    process.stdout.write(`round ${r.round}: ${r.fixed.length}\n  ${r.fixed.join(", ")}\n`);
  }
  process.stdout.write(`\n${ids.length} distinct findings closed across ${byRound.length} rounds\n`);
  /* The ones raised more than once are the ones worth naming to a seat,
     because they are the classes this surface keeps regrowing. */
  const seen = new Map();
  for (const r of byRound) for (const id of r.fixed) seen.set(id, (seen.get(id) || 0) + 1);
  const repeats = [...seen.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  if (repeats.length) {
    process.stdout.write(`\nraised and fixed more than once:\n`);
    for (const [id, n] of repeats) process.stdout.write(`  ${n}x  ${id}\n`);
  }
}
