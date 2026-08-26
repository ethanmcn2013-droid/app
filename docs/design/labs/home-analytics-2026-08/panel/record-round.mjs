// Append a round to panel.json in the shape register.md fixes, built from
// the seat and refuter JSON on disk rather than retyped.
//
//   node record-round.mjs 1 --assertions=366 --selfInflicted=0 --frozen=false
//
// Three engagements wrote three different shapes from one skill and one of
// them stored `confirmed` as a bare count, which cannot carry a severity and
// therefore cannot end an engagement. This writes the array.
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB = path.resolve(HERE, "..");
const round = Number(process.argv[2]);
if (!Number.isInteger(round)) { process.stderr.write("Pass the round number.\n"); process.exit(2); }
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};

const dir = path.join(HERE, `round-${round}`);
const seats = {};
for (const f of (await readdir(dir)).filter((n) => /^seat-.*\.json$/.test(n))) {
  const s = JSON.parse(await readFile(path.join(dir, f), "utf8"));
  seats[s.seat] = s;
}

const clustersFile = path.join(HERE, `clusters-round-${round}.json`);
let clusters = [];
try { clusters = JSON.parse(await readFile(clustersFile, "utf8")).clusters; } catch { /* none */ }
const aliasOf = new Map();
for (const c of clusters) {
  aliasOf.set(c.id, c);
  for (const a of c.aliases) aliasOf.set(a.split(":")[0], c);
}

const verdicts = {};
const vdir = path.join(dir, "refuters");
for (const f of (await readdir(vdir)).filter((n) => n.endsWith(".json") && n !== "index.json")) {
  const v = JSON.parse(await readFile(path.join(vdir, f), "utf8"));
  verdicts[v.id] = v;
}

/* A finding whose PROBLEM the refuter affirms and whose FIX it replaces is
   recorded as confirmed, carrying the refuter's fix. The alternative — that
   a real, correctly-classed defect dies because the seat's wording did not
   fit a pill — would let an engagement close over defects nobody disputes. */
const REPLACED = new Set((arg("replaced", "") || "").split(",").filter(Boolean));

const findingOf = (id) => {
  for (const s of Object.values(seats)) {
    const f = (s.findings ?? []).find((x) => x.id === id);
    if (f) return { ...f, seat: s.seat };
  }
  return null;
};

const confirmed = [];
const refuted = [];
for (const c of clusters) {
  const v = verdicts[c.id];
  const f = findingOf(c.id);
  if (!v || !f) continue;
  const seatsAgreeing = 1 + c.aliases.length;
  if (v.real || REPLACED.has(c.id)) {
    confirmed.push({
      id: c.id,
      severity: v.severity ?? f.severity,
      element: f.element,
      problem: f.problem,
      consequence: f.consequence,
      fix: v.sharpenedFix ? v.sharpenedFix : f.fix,
      assertion: f.assertion,
      cost: f.cost,
      seats: seatsAgreeing,
      verdict: v.real ? v.reason : `problem affirmed, seat's fix replaced — ${v.reason}`,
      sharpenedFix: v.sharpenedFix ?? null,
      breaks: v.breaks ?? null,
      done: null,
    });
  } else {
    refuted.push({ seat: f.seat, id: c.id, problem: f.problem, why: v.reason });
  }
}

const sev = (name) => confirmed.filter((f) => f.severity === name).length;
const scores = Object.fromEntries(Object.entries(seats).map(([k, s]) => [k, s.score]));
const entry = {
  round,
  seatsSat: Object.keys(seats),
  scores,
  signOffs: Object.values(seats).filter((s) => s.signOff).map((s) => s.seat),
  headline: arg("headline", ""),
  raisedAsFiled: Object.values(seats).reduce((n, s) => n + (s.findings ?? []).length, 0),
  distinctClaims: clusters.length,
  confirmed,
  refuted,
  severity: { blocking: sev("blocking"), misleading: sev("misleading"), defect: sev("defect"), refinement: sev("refinement") },
  refuteRate: clusters.length ? Number((refuted.length / clusters.length).toFixed(3)) : null,
  selfInflicted: Number(arg("selfInflicted", "0")),
  frozen: arg("frozen", "false") === "true",
  gatesGreen: arg("gatesGreen", "true") === "true",
  assertions: Number(arg("assertions", "0")),
  deferredBuilds: (arg("deferred", "") || "").split("|").filter(Boolean),
  blindness: arg("blindness", "") || null,
};

const panelFile = path.join(LAB, "panel.json");
const panel = JSON.parse(await readFile(panelFile, "utf8"));
panel.rounds = (panel.rounds ?? []).filter((r) => r.round !== round);
panel.rounds.push(entry);
panel.rounds.sort((a, b) => a.round - b.round);
await writeFile(panelFile, JSON.stringify(panel, null, 2) + "\n", "utf8");

process.stdout.write(
  `round ${round} recorded — ${entry.raisedAsFiled} raised as filed, ${entry.distinctClaims} distinct, ` +
  `${confirmed.length} confirmed, ${refuted.length} refuted (${Math.round((entry.refuteRate ?? 0) * 100)}%)\n` +
  `  severity  blocking ${entry.severity.blocking} · misleading ${entry.severity.misleading} · ` +
  `defect ${entry.severity.defect} · refinement ${entry.severity.refinement}\n` +
  `  scores    floor ${Math.min(...Object.values(scores))} · ceiling ${Math.max(...Object.values(scores))}\n` +
  `  gate      ${entry.assertions} assertions\n`,
);
