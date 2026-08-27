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
/* ── "your fix is wrong" is not "you are wrong" ──────────────────────
   A refuter returns `real: false` for two completely different verdicts:
   the finding is WRONG, and the finding is RIGHT but its proposed remedy
   is not. The contract asks for the second explicitly — "A correct problem
   with a wrong fix is REFUTED, with the corrected fix in sharpenedFix" —
   and this file has been counting both as refutations since round 1.

   Round 4 is where that became impossible to miss: 26 of 34 refutations
   said in their own first line that the problem is real and must not be
   discarded, one of them at severity `blocking`, and the round reported
   itself as the first clean round of the engagement. The refuters kept the
   severity while rejecting the fix — `{ real: false, severity: "blocking" }`
   — so the truth was in the record the whole time and the tally threw it
   away.

   This is the same shape as the two absences this file has already been
   bitten by: a missing verdict read as a refutation, and now a rejected
   FIX read as a rejected FINDING. A standing problem is remediation work,
   it carries the refuter's own severity, and it counts against the ending. */
const standing = [];
const STANDS = /refuted on the fix|problem is real|must not be discarded|not on the problem|do not discard/i;
/* A finding whose refuter never RAN is not a refuted finding. The
   default-to-REFUTED contract binds a refuter that reached a verdict; an
   agent killed by a session limit reached nothing. Round 3 lost 25 of 36
   refuters that way and this file called them all refutations, which would
   have recorded a 97% refute rate off 11 actual verdicts — the same class of
   error as a selector that matches nothing failing nothing, and as the seam
   check that passed because the field the fix read had gone with the fix.
   Absence is not a pass. It is counted, named, and kept out of the rate. */
const unadjudicated = [];
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
      if (kept) confirmed.push(row);
      else if (STANDS.test(String(v.reason || ""))) standing.push(row);
      else refuted.push(row);
    } else {
      row.verdict = "NO REFUTER RESULT — never adjudicated";
      unadjudicated.push(row);
    }
  }
}

/* Severity counts CONFIRMED plus STANDING. A problem whose fix was rejected
   is still a problem on the surface, and the ending is stated in severity. */
const severity = { blocking: 0, misleading: 0, defect: 0, refinement: 0 };
for (const f of confirmed.concat(standing)) if (severity[f.severity] !== undefined) severity[f.severity]++;

const raised = confirmed.length + standing.length + refuted.length + unadjudicated.length;
const judged = confirmed.length + standing.length + refuted.length;
const entry = {
  round,
  seatsSat: seats.map((s) => s.seat),
  scores: Object.fromEntries(seats.map((s) => [s.seat, s.score])),
  signOffs: seats.filter((s) => s.signOff).map((s) => s.seat),
  headline: "",
  confirmed,
  refuted: refuted.map((f) => ({ seat: f.seat, id: f.id, problem: f.problem, why: f.verdict || f.why || "" })),
  /* Raised, never judged. Kept whole rather than summarised: these are the
     ones a re-run has to adjudicate, and they are not evidence of anything
     until it does. */
  unadjudicated,
  /* Right about the problem, wrong about the remedy. Remediation work, at
     the refuter's own severity, with its sharpenedFix. */
  standing,
  severity,
  /* Measured against what was actually judged, not against what was raised.
     A rate computed over unjudged findings is a number about the harness. */
  /* Only the findings that were actually wrong. Counting fix-refutations
     here reported a 94% refute rate on a round with 28 standing problems. */
  refuteRate: judged ? Math.round((refuted.length / judged) * 1000) / 1000 : 0,
  judged,
  selfInflicted: null,
  frozen: false,
  gatesGreen: null,
  assertions: null,
  deferredBuilds: [],
  blindness: null,
};

const order = { blocking: 0, misleading: 1, defect: 2, refinement: 3 };
for (const f of [...confirmed, ...standing].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))) {
  process.stdout.write(
    `${String(f.severity || "?").padEnd(11)} ${f.id}\n` +
    `            ${f.seat}\n` +
    `            ${String(f.problem || "").replace(/\s+/g, " ").slice(0, 150)}\n` +
    `        FIX ${String(f.sharpenedFix || f.fix || "").replace(/\s+/g, " ").slice(0, 170)}\n\n`,
  );
}
process.stdout.write(
  `raised ${raised} · judged ${judged} · confirmed ${confirmed.length} · ` +
  `standing ${standing.length} · refuted ${refuted.length} ` +
  `(${Math.round((refuted.length / Math.max(1, judged)) * 100)}% of judged)\n` +
  `blocking ${severity.blocking} · misleading ${severity.misleading} · ` +
  `defect ${severity.defect} · refinement ${severity.refinement}\n` +
  (unadjudicated.length
    ? `\n  !!  ${unadjudicated.length} findings NEVER ADJUDICATED — their refuters did not run.\n` +
      `      They are neither confirmed nor refuted, and this round is INCOMPLETE\n` +
      `      until they are judged. Listed whole in panel/round-${round}.json under\n` +
      `      "unadjudicated". Re-run the panel to close them.\n`
    : ""),
);

await writeFile(path.join(LAB, `panel/round-${round}.json`), JSON.stringify(entry, null, 2) + "\n");
process.stdout.write(`\npanel/round-${round}.json written\n`);
