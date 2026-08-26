/* Read a panel round out of its own journal, and write panel.json.
 *
 *   node tools/round.mjs <journal.jsonl> <round-number>
 *
 * The workflow's returned object is the round, but it arrives as one
 * enormous string in a notification and the notification truncates. The
 * journal holds every agent's actual return value, one line each, and it
 * does not. `register.md`: where a report and the record disagree, the
 * record wins — so the record is built from the journal, never retyped.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [journalPath, roundRaw] = process.argv.slice(2);
const round = Number(roundRaw);

const lines = (await readFile(journalPath, "utf8")).split(/\r?\n/).filter(Boolean);
const results = [];
for (const line of lines) {
  try {
    const rec = JSON.parse(line);
    if (rec.type === "result") results.push(rec);
  } catch { /* a partial line at the tail is not a result */ }
}

/* The final agent-free return value of the script, if the runner recorded
   one; otherwise assemble from the seat and refuter agents. */
const seats = [];
const verdicts = [];
for (const r of results) {
  const v = r.result ?? r.value ?? r.output;
  const obj = typeof v === "string" ? tryParse(v) : v;
  if (!obj || typeof obj !== "object") continue;
  if (obj.seat && Array.isArray(obj.findings)) seats.push(obj);
  /* The refuter's contract is { id, real, severity, reason } — `real` is
     the verdict, and it DEFAULTS TO REFUTED, so anything that is not
     explicitly true is a kill. */
  else if (obj.id && obj.real !== undefined) verdicts.push(obj);
}
function tryParse(s) {
  try { return JSON.parse(s); } catch { /* not JSON */ }
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  if (i < 0 || j <= i) return null;
  try { return JSON.parse(s.slice(i, j + 1)); } catch { return null; }
}

process.stdout.write(`${results.length} agent results · ${seats.length} seats · ${verdicts.length} verdicts\n\n`);

const byId = new Map();
for (const v of verdicts) byId.set(v.id, v);

const confirmed = [];
const refuted = [];
for (const seat of seats) {
  for (const f of seat.findings) {
    const v = byId.get(f.id);
    const kept = Boolean(v && v.real === true);
    const row = { seat: seat.seat, ...f };
    if (v) {
      row.verdict = v.reason ?? "";
      /* The refuter judges the SEVERITY too, and its class is the one
         recorded — the ending is stated in severity, so one inflated
         class would otherwise hold a whole engagement open. */
      if (v.severity) row.severity = v.severity;
      if (v.sharpenedFix) row.sharpenedFix = v.sharpenedFix;
      if (v.breaks) row.breaks = v.breaks;
    } else {
      /* No verdict reached this finding. Defaulting to refuted is the
         method; recording that it was never judged is the honesty. */
      row.verdict = "no refuter result recorded";
    }
    (kept ? confirmed : refuted).push(row);
  }
}

const severity = { blocking: 0, misleading: 0, defect: 0, refinement: 0 };
for (const f of confirmed) if (severity[f.severity] !== undefined) severity[f.severity]++;

const raised = confirmed.length + refuted.length;
const entry = {
  round,
  seatsSat: seats.map((s) => s.seat),
  scores: Object.fromEntries(seats.map((s) => [s.seat, s.score])),
  signOffs: seats.filter((s) => s.signOff).map((s) => s.seat),
  headline: "",
  confirmed,
  refuted: refuted.map((f) => ({ seat: f.seat, id: f.id, problem: f.problem, why: f.verdict || f.why || "" })),
  severity,
  refuteRate: raised ? Math.round((refuted.length / raised) * 1000) / 1000 : 0,
  selfInflicted: null,
  frozen: false,
  gatesGreen: null,
  assertions: null,
  deferredBuilds: [],
  blindness: null,
};

const order = { blocking: 0, misleading: 1, defect: 2, refinement: 3 };
for (const f of [...confirmed].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))) {
  process.stdout.write(
    `${String(f.severity || "?").padEnd(11)} ${f.id}\n` +
    `            ${f.seat}\n` +
    `            ${String(f.problem || "").replace(/\s+/g, " ").slice(0, 150)}\n` +
    `        FIX ${String(f.sharpenedFix || f.fix || "").replace(/\s+/g, " ").slice(0, 170)}\n\n`,
  );
}
process.stdout.write(
  `raised ${raised} · confirmed ${confirmed.length} · refuted ${refuted.length} ` +
  `(${Math.round((refuted.length / Math.max(1, raised)) * 100)}%)\n` +
  `blocking ${severity.blocking} · misleading ${severity.misleading} · ` +
  `defect ${severity.defect} · refinement ${severity.refinement}\n`,
);

await writeFile(path.join(LAB, `panel/round-${round}.json`), JSON.stringify(entry, null, 2) + "\n");
process.stdout.write(`\npanel/round-${round}.json written\n`);
