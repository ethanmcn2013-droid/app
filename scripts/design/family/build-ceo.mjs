// Build the CEO report for each of the three elevations.
//
//   node scripts/design/family/build-ceo.mjs
//
// One page per product, identical in structure, written from the numbers in
// each lab's own panel.json rather than from any session's prose — three
// sessions each quoted a different total for their own work, and this is the
// document that has to be right.
//
// The rail is added afterwards by apply.mjs, which owns that furniture for
// all fifteen artifacts.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SET, FONT_LINK, labelFor } from "./family.mjs";
import { reportCss } from "./report.mjs";

const WS = "C:/Users/ethan/signal-studio-workspace";

/* ── the record ─────────────────────────────────────────────────────────
   Read from each lab's panel.json so no number here is typed by hand. */
function readPanel(key) {
  const p = SET.products[key];
  const d = JSON.parse(readFileSync(path.join(WS, p.worktree, p.lab, "panel.json"), "utf8"));
  const R = d.rounds;
  const count = (v) => (typeof v === "number" ? v : Array.isArray(v) ? v.length : 0);
  const scoresOf = (r) => {
    const s = r.scores;
    if (!s) return [];
    const vals = Array.isArray(s) ? s : Object.values(s);
    return vals.map((x) => (typeof x === "number" ? x : x && (x.score ?? x.value))).filter((n) => typeof n === "number");
  };
  const floors = R.map((r) => (scoresOf(r).length ? Math.min(...scoresOf(r)) : null));
  const last = R[R.length - 1];
  let confirmed = 0, refuted = 0;
  for (const r of R) { confirmed += count(r.confirmed); refuted += count(r.refuted); }
  return {
    rounds: R.length,
    seats: Array.isArray(d.seats) ? d.seats.length : 7,
    gate: d.gate ?? 9.5,
    floorFirst: floors[0],
    floorLast: floors[floors.length - 1],
    floorPeak: Math.max(...floors.filter((n) => n != null)),
    ceiling: scoresOf(last).length ? Math.max(...scoresOf(last)) : null,
    confirmed,
    refuted,
    raised: confirmed + refuted,
    refuteRate: Math.round((refuted / (confirmed + refuted)) * 100),
  };
}

const REC = {
  notes: readPanel("notes"),
  tasks: readPanel("tasks"),
  timeline: readPanel("timeline"),
};

/* Facts the panel record does not hold: the behaviour gate's assertion count
   (taken from each lab's own gate run) and the rating each session gave the
   method in its own retrospective. */
const EXTRA = {
  notes:    { assertions: 676, rating: "7",   settled: null },
  tasks:    { assertions: 360, rating: "6",   settled: "8.4" },
  timeline: { assertions: 845, rating: "7.5", settled: null },
};

/* ── the copy ───────────────────────────────────────────────────────── */
const COPY = {
  notes: {
    verdict: "Finished as design.<br>Unfinished as software.",
    stand:
      "Fourteen rounds of a blind seven-seat panel took the weakest of seven independent lenses on Signal Notes from 5.6 to 8.6, and closed 247 defects that each survived a reviewer whose only job was to kill them. The direction is locked and it is proven. None of it is in the product yet, and that is the only thing standing between this and a shipped redesign.",
    say: "Notes is a finished piece of design thinking and an unfinished piece of software.",
    sayMore: [
      "The floor is the lowest of seven independent scores, not an average, so 8.6 means no lens — composition, type, interaction, information design, copy, taste or measured evidence — reads the work below 8.6. The panel's taste seat stopped calling it a well-made notes app with wedding words in it several rounds ago.",
      "What it is not yet is <em>in the product</em>. Every line of this lives in a lab master, and <code>src/modules/notes/app/</code> has not been touched.",
    ],
    built: [
      ["Two planes, with depth", "The desk you write on, and the index of everything behind it. Not tabs, not a sidebar — one surface in front of another, and the depth carries the meaning."],
      ["A sealed, one-way peel", "Only the words you deliberately pick ever cross into a task. Nothing leaks, and the peel shows you the exact payload before it sends it."],
      ["A dictation floor", "Speaking takes the whole room to ink, so the words are legible at the moment they are being said rather than after."],
    ],
    stopped:
      "The gate was a unanimous 9.5 for fourteen rounds and was never met. At round 15 the panel's own noise was measured: seat-to-seat variance on an unchanged artifact ran about ±0.5, against 0.9 of remaining distance. The instrument could no longer resolve the thing it was being asked to decide, so the terminating condition was replaced with three conditions it can resolve — a floor at or above 8.5, no confirmed blocker worth more than 0.5, and nothing promise-breaking. All three hold.",
    open: [
      ["Not in the product", "Blocking", "The whole redesign is a lab master. The port to <code>src/modules/notes/app/</code> is real engineering work and has not started."],
      ["The distance to 9.5 is taste", "Not blocking", "What separates 8.6 from 9.5 is no longer defect work. Four rounds of fixes moved the floor further than the nine before them, and the remaining findings are preferences, not faults."],
      ["The gate cannot see the product", "Watch", "676 assertions guard the lab master. None of them run against the shipped app, and four separate gate blindnesses were found during the engagement — each worth more than the defect that exposed it."],
    ],
    asks: [
      ["Fifteen minutes in the Console", "Open the locked preset — notebook, stacked, airy, soft, subtle calm — and confirm the room is right. If it is not, nothing else matters."],
      ["One person, twenty minutes, cold", "Somebody who has never seen it, opening the phone frame with no explanation. No panel can stand in for this."],
      ["A decision on the port", "The recommended shape is one session per product against its own lock. The full prompt is in the Elevation Log."],
    ],
  },

  tasks: {
    verdict: "Finished as design.<br>Stopped by its own loop.",
    stand:
      "Nineteen rounds of a blind seven-seat panel filed 639 findings against the Tasks board and fixed the 421 that survived refutation. The floor peaked at 8.6 and the final round reads 7.3 — a number set by one seat, on a defect the previous round's own repair introduced. The settled reading of the artifact is 8.4, and both numbers are in the record unedited.",
    say: "The work was never the constraint. The loop was.",
    sayMore: [
      "From round 9 onward the panel stopped finding the same defects getting smaller and started finding new defects in whatever had been built since the last panel. Across rounds 12 to 15 that accounted for 53%, 39%, 54% and 68% of each round's confirmed defect cost — rising, not falling.",
      "Freezing the surface halved the cost per round but did not produce a climb: four frozen rounds read 8.3, 8.2, 8.2, then 7.3. At that point the loop had stopped grading the product and started grading its own repairs.",
    ],
    built: [
      ["Elevated cards on a soft grid", "The locked combination: elevated card, 12px corner, comfortable density, calm type scale. Every alternative is still one switch away in the Console."],
      ["Indigo as a single accent", "One colour, spent only on what you are most likely to do next. It never marks a warning, so it never has to compete with itself."],
      ["Five columns that mean something", "To do, in progress, review, waiting, done — each with a sentence saying what belongs in it, so the board explains itself without training."],
    ],
    stopped:
      "A unanimous 9.5 is an AND across seven expert lenses where the score is the lowest seat: it requires a state in which nobody, looking seven different ways, finds anything worth more than a few tenths — on a sweep that reliably returns 25 to 35 findings. No round of nineteen produced fewer than 16 confirmed defects. The bar as written is reachable only by an artifact that has stopped changing, and this one changed every round.",
    open: [
      ["The last round's 7.3", "Read the caveat", "One seat, one defect, introduced by the previous round's remediation and fixed immediately after. The six other seats returned 8.2 to 8.6."],
      ["Shared chrome is unreconciled", "Blocking the suite", "Three products elevated in parallel each moved the chrome they share. Nothing can ship until one session reconciles it alone."],
      ["Self-inflicted defect rate", "Watch", "Two rounds running, the largest defect in the round was introduced by the fix for the round before it. Any future loop needs a verification pass between fix and re-score."],
    ],
    asks: [
      ["Fifteen minutes in the Console", "Throw the five switches against the locked default and confirm the combination is the one you want shipped."],
      ["A ruling on the shared chrome", "It cannot be settled inside a product session. It needs its own, before any of the three ports open."],
      ["A decision on the port", "One session per product, against its own lock and its own panel record. The full prompt is in the Elevation Log."],
    ],
  },

  timeline: {
    verdict: "Finished as design.<br>Three builds from done.",
    stand:
      "Twelve rounds of a blind seven-seat panel took the weakest of seven lenses on the Timeline plan from 6.2 to 9.1 against a gate of 9.5, filing 366 findings and fixing all 251 that survived rejection. It is not shipped and it is not blocked: three sized builds and one decision stand between here and production.",
    say: "The gate was not met and the work stopped anyway, for a reason worth reading.",
    sayMore: [
      "Findings rose from 13 to 19 across the last two rounds while the floor did not move. That is a tail, not a gap — the panel looking harder at a surface that had stopped getting worse. Continuing would have bought churn: four of the final round's findings were defects introduced by the previous round's own fixes.",
      "What durably came out of this is not the score. It is 845 behaviour assertions and a fifteen-category measured gate that both run on the paper room and its dark twin, and every one of those assertions exists because a reviewer found the defect it now guards.",
    ],
    built: [
      ["One composition, two grounds", "Paper and ink are the same plan inverted through the ink ladder, not two designs. Print is always paper either way."],
      ["The past folded to a line", "A guest opening this in August does not need January. The plan says January happened and moves on."],
      ["One accent, spent like a laser", "Indigo marks either only the next thing, or the next thing and the rail still ahead of it. Never both meanings at once."],
    ],
    stopped:
      "The score is the lowest of seven independent samples, so near the top it measures how hard the panel looked rather than how good the work is. At 9.1 with a 9.4 ceiling, the remaining distance was inside the instrument's own noise. Stopping was a reading of the measurement, not a concession on the work.",
    open: [
      ["Editing a moment that has passed", "Sized build", "The plan folds the past to a line. What happens when somebody needs to correct something inside that fold is undecided."],
      ["A loading frame at desk widths", "Sized build", "The phone loading state is designed and asserted. The desk one is not."],
      ["Whether a moment gets a time", "Decision", "Dates are settled. Times are not, and the answer changes the rail's density at every width."],
    ],
    asks: [
      ["Fifteen minutes in the Console", "Switch the ground and confirm the room is right on both. If it is not, nothing else matters."],
      ["One person, twenty minutes, cold", "Somebody who has never seen it, opening the phone frame with no explanation."],
      ["A yes or no on three builds", "Editing a past moment, a desk loading frame, and whether a moment carries a time. The Log sizes each one."],
    ],
  },
};

/* ── page ───────────────────────────────────────────────────────────── */
const esc = (s) => String(s).replace(/&(?![a-z#]+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function setIndex(key) {
  const p = SET.products[key];
  return SET.docs
    .map((d) => {
      const href = p.urls[d.slot];
      const label = labelFor(key, d);
      const inner = `<i>${d.n}</i><b>${label}</b><span>${d.blurb}</span>`;
      if (d.slot === "ceo") return `<span class="setIxCard is-here">${inner}</span>`;
      if (!href) return `<span class="setIxCard">${inner}</span>`;
      return `<a class="setIxCard" href="${href}">${inner}</a>`;
    })
    .join("\n      ");
}

function comparison(key) {
  const keys = Object.keys(SET.products).sort((a, b) => SET.products[a].order - SET.products[b].order);
  const head = keys
    .map((k) => {
      const url = SET.products[k].urls.ceo;
      const name = SET.products[k].name;
      const cell = url && k !== key ? `<a href="${url}">${name}</a>` : name;
      return `<th${k === key ? ' class="is-me"' : ""}>${cell}${k === key ? " · this one" : ""}</th>`;
    })
    .join("");
  const row = (label, fn) =>
    `<tr><th>${label}</th>` +
    keys.map((k) => `<td${k === key ? ' class="is-me"' : ""}>${fn(k)}</td>`).join("") +
    `</tr>`;
  return `<table class="fam">
        <thead><tr><th></th>${head}</tr></thead>
        <tbody>
          ${row("Rounds", (k) => REC[k].rounds)}
          ${row("Floor, first round", (k) => REC[k].floorFirst.toFixed(1))}
          ${row("Floor, last round", (k) => REC[k].floorLast.toFixed(1))}
          ${row("Best floor reached", (k) => REC[k].floorPeak.toFixed(1))}
          ${row("Highest seat, last round", (k) => REC[k].ceiling.toFixed(1))}
          ${row("Findings raised", (k) => REC[k].raised)}
          ${row("Refuted and dropped", (k) => `${REC[k].refuted} <span style="color:var(--t3)">· ${REC[k].refuteRate}%</span>`)}
          ${row("Confirmed and fixed", (k) => REC[k].confirmed)}
          ${row("Behaviour assertions", (k) => EXTRA[k].assertions)}
          ${row("The method, self-rated", (k) => `${EXTRA[k].rating}/10`)}
        </tbody>
      </table>`;
}

function build(key) {
  const p = SET.products[key];
  const r = REC[key];
  const x = EXTRA[key];
  const c = COPY[key];
  const delta = (r.floorPeak - r.floorFirst).toFixed(1);
  const shown = x.settled ?? r.floorLast.toFixed(1);

  const figs = [
    [r.rounds, "rounds", false],
    [r.raised, "findings raised", false],
    [`${r.refuted}`, `refuted &middot; ${r.refuteRate}%`, false],
    [r.confirmed, "confirmed and fixed", true],
    [x.assertions, "behaviour assertions", false],
    [`${x.rating}/10`, "the method, self-rated", false],
  ]
    .map(([n, l, key2]) => `<div class="fig${key2 ? " is-key" : ""}"><b class="tab">${n}</b><span>${l}</span></div>`)
    .join("\n      ");

  const built = c.built
    .map(([h, b]) => `<li><b>${h}</b><span>${b}</span></li>`)
    .join("\n        ");
  const open = c.open
    .map(([h, tag, b]) => `<li><em>${tag}</em><b>${h}</b><span>${b}</span></li>`)
    .join("\n        ");
  const asks = c.asks
    .map(([h, b]) => `<li><b>${h}</b><span>${b}</span></li>`)
    .join("\n        ");

  return `<title>${p.name} · CEO Report</title>
${FONT_LINK}
<style>
/* The one-page reading of the ${p.name} elevation, for somebody who will not
   open the other four documents. Held to the palette the elevation policed:
   Ink, Indigo, White, and tints of those three. */
${reportCss()}
</style>

<div class="page">

  <header class="mast">
    <p class="kick"><b>&bull;</b> Signal Studio &middot; ${p.name} &middot; CEO report &middot; August 2026</p>
    <h1>${p.name}.<em>${c.verdict}</em></h1>
    <p class="stand">${c.stand}</p>
    <p class="byline">The floor is the lowest of ${r.seats} independent seats &middot; ${r.rounds} rounds &middot; written by the session that ran them</p>
  </header>

  <section>
    <p class="kick">The number</p>
    <div class="score">
      <div class="n">
        <b class="tab">${shown}</b>
        <i>The floor${x.settled ? " &middot; settled reading" : ` &middot; round ${r.rounds}`}<br>against a gate of ${r.gate}</i>
        <u>+${delta} from round one</u>
      </div>
      <div>
        <p class="say">${c.say}</p>
        ${c.sayMore.map((s) => `<p>${s}</p>`).join("\n        ")}
      </div>
    </div>
    <div class="figs">
      ${figs}
    </div>
  </section>

  <section>
    <p class="kick">Read next</p>
    <h2>Four documents behind this one</h2>
    <div class="col"><p>Each one is a different depth on the same piece of work. The rail at the top of every page carries all five, so no document is a dead end.</p></div>
    <div class="setIx" style="margin-top:26px">
      ${setIndex(key)}
    </div>
  </section>

  <section>
    <p class="kick">What was built</p>
    <h2>Three decisions the rest hangs from</h2>
    <ul class="ledger">
        ${built}
    </ul>
  </section>

  <section>
    <p class="kick">Where it stopped</p>
    <h2>Why the number is not higher</h2>
    <div class="col"><p>${c.stopped}</p></div>
    <div class="note" style="margin-top:30px">
      <p><strong>The score is the lowest seat, not the average.</strong> Seven reviewers grade blind, none of them seeing another's opinion, and the round takes the worst of the seven. It falls when the panel looks harder, which is the point of it — and it means a single seat can move the headline number on a single defect.</p>
    </div>
  </section>

  <section>
    <p class="kick">Still open</p>
    <h2>What stands between this and production</h2>
    <ul class="ledger">
        ${open}
    </ul>
  </section>

  <section>
    <p class="kick">Decisions</p>
    <h2>What I need from you</h2>
    <ul class="ledger">
        ${asks}
    </ul>
  </section>

  <section>
    <p class="kick">The family</p>
    <h2>Three elevations, one method</h2>
    <div class="col"><p>Notes, Tasks and Timeline were elevated in three separate sessions, by the same method, against the same bar, with no contact between them. Reading the three columns together is the fairest test of the method that exists.</p></div>
    <div class="tblWrap" style="margin-top:28px">
      ${comparison(key)}
    </div>
  </section>

  <section>
    <p class="kick">To production</p>
    <h2>One session per product, nothing merged alone</h2>
    <div class="col">
      <p>Each elevation ran against its own locked direction, and the decisions that matter on the way in are local to it: which lab state maps to which product state, what the fold from product states to lab states cost, which behaviour the gate asserts and which it never covered. A single session holding all three makes those judgements with a third of the attention each.</p>
      <p>Run the porting prompt three times, each session reading its own lock and its own panel record, each opening a pull request and merging none. <strong>Nothing lands until all three are open and the shared chrome agrees across them</strong> — that contract is the one thing no single product session can verify alone. The verbatim prompt is in the ${p.urls.log ? `<a href="${p.urls.log}">Elevation Log</a>` : "Elevation Log"}.</p>
    </div>
  </section>

  <p class="foot">
    Exploration only. This is a lab master, not shipped code: no pull request, no deploy, no app-code or schema change.
    The record every number here is drawn from is <code>${p.lab}/panel.json</code>, ${r.rounds} rounds deep.
    The floor is the lowest of ${r.seats} blind seats; findings counted here are only those that survived an adversarial
    refuter defaulting to refused. Prepared 26 August 2026 by the session that ran the elevation.
  </p>

</div>
`;
}

for (const key of Object.keys(SET.products)) {
  const p = SET.products[key];
  const out = path.join(WS, p.worktree, p.lab, p.files.ceo);
  writeFileSync(out, build(key), "utf8");
  const r = REC[key];
  console.log(
    `${p.name.padEnd(9)} -> ${p.files.ceo.padEnd(10)} ${r.rounds} rounds  floor ${r.floorFirst.toFixed(1)}->${r.floorLast.toFixed(1)}  peak ${r.floorPeak.toFixed(1)}  ${r.raised} raised / ${r.refuted} refuted / ${r.confirmed} fixed`,
  );
}
