// Append one round to panel.json in exactly the shape the Elevation Log
// renders (references/artifacts.md), from two inputs:
//
//   node panel/record-round.mjs --result=panel/round-1.result.json --notes=panel/round-1.notes.json
//
// result — the object the round's Workflow returned:
//   { round, scores: [{ seat, score, biggestWin }], confirmed: [...], refuted: [...] }
// notes  — written by hand after the fixes are VERIFIED RENDERED, in the
//          log's register (plain, specific, unimpressed by effort):
//   { headline, fixed, worst: [{ seat, cost, problem, done }], final?: true }
//
// Nothing here invents a number. Scores come from the seats; counts come
// from the verdicts; the words come from the notes file, which is written
// only after the work is seen on screen.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = new Map(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "true"]; }));
const LAB = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

const result = JSON.parse(await readFile(path.resolve(LAB, args.get("result")), "utf8"));
const notes = JSON.parse(await readFile(path.resolve(LAB, args.get("notes")), "utf8"));
const panelPath = path.join(LAB, "panel.json");
const panel = JSON.parse(await readFile(panelPath, "utf8"));

const scores = {};
for (const seat of panel.seats) {
  const row = (result.scores || []).find((s) => s.seat === seat);
  if (!row) throw new Error(`no score returned for seat "${seat}"`);
  scores[seat] = Number(row.score);
}

const entry = {
  round: Number(result.round),
  scores,
  findings: (result.confirmed?.length || 0) + (result.refuted?.length || 0),
  confirmed: result.confirmed?.length || 0,
  refuted: result.refuted?.length || 0,
  fixed: Number(notes.fixed ?? result.confirmed?.length ?? 0),
  headline: String(notes.headline || "").trim(),
  worst: (notes.worst || []).map((w) => ({ seat: w.seat, cost: Number(w.cost), problem: w.problem, done: w.done })),
};
if (notes.final) entry.final = true;
if (!entry.headline) throw new Error("the round needs a headline, written after the fixes rendered");
if (!entry.worst.length) throw new Error("the round needs its worst findings as problem → done");

panel.rounds = (panel.rounds || []).filter((r) => r.round !== entry.round).concat(entry).sort((a, b) => a.round - b.round);
await writeFile(panelPath, JSON.stringify(panel, null, 2) + "\n", "utf8");

const low = Math.min(...Object.values(scores));
process.stdout.write(`round ${entry.round} recorded · lowest seat ${low} · ${entry.confirmed} confirmed / ${entry.refuted} refuted · ${entry.fixed} fixed\n`);
