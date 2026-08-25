/* Fold a panel workflow result into panel.json.
 *
 *   node scripts/design/notes-record-round.mjs round-1.json "the headline" "the body"
 *
 * The workflow returns scores, confirmed findings and refuted ones. This
 * merges that into the log's data file without hand-typing a number, because
 * a score typed by hand is a score that can be wrong.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const LAB = path.resolve("docs/design/labs/notes-2026-08");
const [resultFile, headline, body] = process.argv.slice(2);
if (!resultFile) throw new Error("usage: notes-record-round.mjs <result.json> <headline> [body]");

const meta = JSON.parse(await readFile(path.join(LAB, "panel.meta.json"), "utf8"));
let panel;
try {
  panel = JSON.parse(await readFile(path.join(LAB, "panel.json"), "utf8"));
} catch {
  panel = { ...meta, rounds: [] };
}
Object.assign(panel, meta);

const result = JSON.parse(await readFile(path.resolve(resultFile), "utf8"));
const round = {
  round: result.round,
  headline: headline || "",
  body: body || "",
  scores: result.scores,
  /* From round 10 the gate round returns a sign-off per seat, the floor
     and which seats are binding. The sign-off tally is the number that
     actually says whether the programme is finished, and it was being
     dropped on the floor here. */
  signOffs: result.signOffs || null,
  verdicts: result.verdicts || null,
  floor: result.floor ?? (result.scores ? Math.min(...Object.values(result.scores)) : null),
  binding: result.binding || null,
  gateMet: result.gateMet ?? null,
  /* The behaviour gate's assertion count when this round was recorded. */
  assertions: process.argv[5] ? Number(process.argv[5]) : null,
  wins: result.wins || [],
  confirmed: (result.confirmed || []).map((f) => ({
    seat: f.seat,
    id: f.id,
    element: f.element,
    problem: f.problem,
    fix: f.sharpenedFix || f.fix,
    cost: f.cost,
    done: f.done || null,
  })),
  refuted: (result.refuted || []).map((f) => ({ seat: f.seat, id: f.id, problem: f.problem, why: f.why })),
};

/* EVERY FIX GETS AN ASSERTION, or the record is not trustworthy.
   seam-pick-desync was recorded done at round 9 and had never landed:
   the patch threw before writing, the gates passed because nothing
   asserted it, and the panel found it again at round 12. The gate's
   assertion count is the cheapest available proof that a round left
   something behind that can catch a regression. This does not block a
   record -- a round can legitimately close a finding the gate cannot
   express -- but it says so out loud, every time. */
const prior = panel.rounds.filter((r) => r.round < round.round).sort((a, b) => b.round - a.round)[0];
const closed = round.confirmed.filter((f) => f.done && !/ERROR/i.test(f.done)).length;
if (closed > 0) {
  const before = prior && prior.assertions ? prior.assertions : null;
  const now = round.assertions ?? null;
  if (now === null) {
    process.stderr.write(
      `
  note: ${closed} finding(s) marked closed and no assertion count recorded for this round.
` +
        `        pass the behaviour gate's count as the fourth argument so the next round can check it grew.

`,
    );
  } else if (before !== null && now <= before) {
    process.stderr.write(
      `
  WARNING: ${closed} finding(s) marked closed but the behaviour gate did not grow ` +
        `(${before} then ${now}).
` +
        `           A fix with nothing asserting it is a fix that can silently not exist.

`,
    );
  }
}

panel.rounds = panel.rounds.filter((r) => r.round !== round.round).concat([round]).sort((a, b) => a.round - b.round);
await writeFile(path.join(LAB, "panel.json"), `${JSON.stringify(panel, null, 2)}\n`, "utf8");

const vals = Object.values(round.scores);
process.stdout.write(
  `round ${round.round} recorded · ${vals.length} seats · ${Math.min(...vals)} to ${Math.max(...vals)} · ${round.confirmed.length} confirmed · ${round.refuted.length} refuted\n`,
);
