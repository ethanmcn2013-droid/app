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

panel.rounds = panel.rounds.filter((r) => r.round !== round.round).concat([round]).sort((a, b) => a.round - b.round);
await writeFile(path.join(LAB, "panel.json"), `${JSON.stringify(panel, null, 2)}\n`, "utf8");

const vals = Object.values(round.scores);
process.stdout.write(
  `round ${round.round} recorded · ${vals.length} seats · ${Math.min(...vals)} to ${Math.max(...vals)} · ${round.confirmed.length} confirmed · ${round.refuted.length} refuted\n`,
);
