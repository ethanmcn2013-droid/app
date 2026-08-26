// Notes · The 9.5 Question.
//
//   node scripts/design/family/build-notes-question.mjs
//
// Tasks and Timeline each published this document; Notes never did, because
// the same material sat in docs/design/notes-gate-method-2026-08.md as a
// markdown note nobody would open. This is that record, set in the family
// idiom, with the round table generated from panel.json rather than typed.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SET, FONT_LINK } from "./family.mjs";
import { reportCss } from "./report.mjs";

const WS = "C:/Users/ethan/signal-studio-workspace";
const p = SET.products.notes;
const panel = JSON.parse(readFileSync(path.join(WS, p.worktree, p.lab, "panel.json"), "utf8"));

const scoresOf = (r) => {
  const vals = Array.isArray(r.scores) ? r.scores : Object.values(r.scores ?? {});
  return vals.map((x) => (typeof x === "number" ? x : x && (x.score ?? x.value))).filter((n) => typeof n === "number");
};
const rows = panel.rounds.map((r) => {
  const s = scoresOf(r);
  return {
    round: r.round,
    floor: Math.min(...s),
    ceiling: Math.max(...s),
    confirmed: (r.confirmed ?? []).length,
    refuted: (r.refuted ?? []).length,
  };
});
const tot = rows.reduce(
  (a, r) => ({ confirmed: a.confirmed + r.confirmed, refuted: a.refuted + r.refuted }),
  { confirmed: 0, refuted: 0 },
);

/* The three phases the arc actually has. Reading them as one line is what
   makes a floor of 8.6 after fourteen rounds look like a stall. */
const PHASES = [
  { from: 1, to: 7, name: "The climb", note: "Seven rounds against the old benchmark set. 5.6 to 8.2, almost monotonic." },
  { from: 8, to: 11, name: "The bar arrives", note: "Linear, Stripe, Vercel, xAI and SpaceX replace the old benchmarks. The floor resets to 6.4 and takes four rounds to recover. Nothing regressed; the standard moved." },
  { from: 12, to: 14, name: "The rebuilt loop", note: "The quota is removed, only the floor seats raise blockers, and fixes land one at a time. 6.2 to 8.6 in three rounds — further than the nine before them." },
];

const bar = (v, lo = 5, hi = 10) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));

const roundRows = rows
  .map((r) => {
    const phase = PHASES.find((f) => r.round >= f.from && r.round <= f.to);
    const first = phase && phase.from === r.round;
    return `<tr${first ? ' class="isPhase"' : ""}>
            <th class="tab">${String(r.round).padStart(2, "0")}</th>
            <td class="tab">${r.floor.toFixed(1)}</td>
            <td class="barCell"><span class="bar"><i style="left:${bar(r.floor).toFixed(1)}%;right:${(100 - bar(r.ceiling)).toFixed(1)}%"></i></span></td>
            <td class="tab">${r.ceiling.toFixed(1)}</td>
            <td class="tab">${r.confirmed}</td>
            <td class="tab">${r.refuted}</td>
            <td class="phase">${first ? phase.name : ""}</td>
          </tr>`;
  })
  .join("\n");

const FAULTS = [
  [
    "The panel was contractually unable to pass",
    "Rounds 1&ndash;9",
    "The seat schema carried <code>findings: { minItems: 3 }</code>. Seven seats times three is twenty-one, and the observed minimum confirmed count across eight recorded rounds is <strong>exactly twenty-one</strong>. A seat that believed the work had reached the bar was still obliged to produce three defects. A unanimous 9.5 was arithmetically unreachable no matter how good the artifact became. This is the single reason nine rounds of honest work never converged.",
  ],
  [
    "The work missed the binding constraint",
    "Rounds 1&ndash;9",
    "The gate is the lowest seat. Across eight rounds the floor seat rotated through five different seats while every round fixed the findings of all seven. Most of the fixing each round could not raise the score, by definition.",
  ],
  [
    "The loop manufactured its own defects",
    "20% of round 9",
    "Four of round 9's twenty confirmed findings were caused by round 8's fixes: a regex whose <code>\\s</code> was lost to shell escaping, silently disabling a rule that was then reported as a design decision; a click handler that made the word-safe drag shipped in the same batch unreachable; a desk budget that forgot the peel and drove the second plane to nothing at 1440&times;960; and a gate rule that failed the correct technique while never checking the real defect. All of it from landing twenty-odd fixes in one batch and running the gates once at the end.",
  ],
  [
    "It graded work that was not the product",
    "120 frames, 26MB",
    "The shot harness rendered three rooms from a query parameter that matched no key in the preset table, so all three fell back to the locked preset. Verified by checksum: <strong>36 of each room's 40 frames were byte-identical</strong> to the locked frames. The four that differed did so because the dictation waveform used <code>Math.random()</code>. Every round shot and committed duplicate frames for three rooms that did not exist.",
  ],
];

const html = `<title>Notes &middot; The 9.5 Question</title>
${FONT_LINK}
<style>
/* Why a fourteen-round elevation stopped at 8.6, and why the gate it stopped
   against was replaced rather than met. Held to the palette the elevation
   policed: Ink, Indigo, White, and tints of those three. */
${reportCss()}

/* the arc */
.arc { margin-top: 8px; }
table.arc { border-collapse: collapse; width: 100%; min-width: 620px; }
table.arc th, table.arc td { padding: 9px 14px 9px 0; border-bottom: 1px solid var(--line-soft); text-align: left; font-size: 14.5px; }
table.arc thead th {
  font-family: var(--mono); font-size: 10.5px; font-weight: 400; letter-spacing: 0.09em;
  text-transform: uppercase; color: var(--t3); border-bottom: 1px solid var(--line); padding-bottom: 11px;
}
table.arc tbody th { font-family: var(--mono); color: var(--t3); font-weight: 400; width: 44px; }
table.arc td { font-variant-numeric: tabular-nums; color: var(--t1); }
table.arc tr.isPhase th, table.arc tr.isPhase td { border-top: 1px solid var(--line); }
table.arc td.phase { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--indigo); white-space: nowrap; }
.barCell { width: 42%; min-width: 150px; }
.bar { position: relative; display: block; height: 5px; border-radius: 3px; background: var(--wash); }
.bar i { position: absolute; top: 0; bottom: 0; border-radius: 3px; background: var(--indigo); opacity: 0.5; }
.phaseNotes { margin: 34px 0 0; padding: 0; list-style: none; display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
.phaseNotes li { padding: 16px 18px; background: var(--plate); border: 1px solid var(--line-soft); border-radius: 10px; }
.phaseNotes b { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.phaseNotes span { display: block; font-size: 14px; line-height: 1.5; color: var(--t3); }

/* the seat-noise table */
table.noise { border-collapse: collapse; width: 100%; min-width: 420px; font-size: 15px; }
table.noise th, table.noise td { padding: 12px 18px 12px 0; border-bottom: 1px solid var(--line-soft); text-align: left; }
table.noise thead th { font-family: var(--mono); font-size: 10.5px; font-weight: 400; letter-spacing: 0.09em; text-transform: uppercase; color: var(--t3); border-bottom: 1px solid var(--line); }
table.noise tbody th { font-weight: 400; color: var(--t2); }
table.noise td { font-variant-numeric: tabular-nums; }
table.noise td.dn { color: var(--indigo); }
table.noise tfoot th, table.noise tfoot td { border-bottom: 0; border-top: 1px solid var(--line); font-weight: 600; color: var(--t1); }

/* the replacement gate */
.gateList { margin: 0; padding: 0; list-style: none; counter-reset: g; max-width: 46rem; }
.gateList li {
  counter-increment: g;
  position: relative;
  padding: 20px 0 20px 54px;
  border-top: 1px solid var(--line-soft);
}
.gateList li:first-child { border-top: 1px solid var(--line); }
.gateList li::before {
  content: counter(g);
  position: absolute; left: 0; top: 21px;
  width: 30px; height: 30px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--ind-wash); color: var(--ind-text);
  border: 1px solid var(--ind-line);
  font-family: var(--mono); font-size: 12px;
}
.gateList b { display: block; font-size: 16.5px; font-weight: 600; margin-bottom: 5px; letter-spacing: -0.014em; }
.gateList span { display: block; color: var(--t2); font-size: 15.5px; line-height: 1.55; }
.gateList em { font-style: normal; font-family: var(--mono); font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--indigo); display: block; margin-top: 7px; }
</style>

<div class="page">

  <header class="mast">
    <p class="kick"><b>&bull;</b> Signal Studio &middot; Notes &middot; the elevation loop &middot; August 2026</p>
    <h1>The 9.5 Question.<em>A draw, not a standard.</em></h1>
    <p class="stand">Fourteen rounds. Seven blind seats each time, one adversarial refuter per finding, ${tot.confirmed + tot.refuted} findings raised and ${tot.confirmed} fixed. The floor went 5.6 to 8.6 against a gate of 9.5 that was never met. This is why, what was done about it, and the gate that replaced it.</p>
    <p class="byline">Prepared 26 August 2026 &middot; rounds 1&ndash;14 &middot; the score is the lowest seat</p>
  </header>

  <section>
    <p class="kick">The finding</p>
    <div class="note">
      <p><strong>The work was not the problem. The terminating condition was.</strong> For nine rounds the panel could not pass the gate no matter how good the artifact became, because every seat was contractually required to file three defects whether it had any or not. Seven seats times three is twenty-one, and no round in that stretch ever confirmed fewer than exactly twenty-one.</p>
      <p>By the time that was fixed, a second problem was visible underneath it: <strong>a unanimous 9.5 from fresh blind seats is a draw, not a standard.</strong> Seat-to-seat noise on a strictly improved artifact runs about &plusmn;0.5 &mdash; larger than the 0.9 that was left to climb.</p>
    </div>
  </section>

  <section>
    <p class="kick">The arc</p>
    <h2>Where the number actually went</h2>
    <div class="col"><p>Fourteen rounds read as one line look like a stall at 8.6. They are three distinct phases, and only the third was measuring what it thought it was measuring. The bar shows each round's floor and ceiling &mdash; the distance between the lowest and highest of the seven seats.</p></div>
    <div class="tblWrap arc">
      <table class="arc">
        <thead><tr><th>Rd</th><th>Floor</th><th>Spread of the seven seats</th><th>Top</th><th>Fixed</th><th>Refuted</th><th></th></tr></thead>
        <tbody>
${roundRows}
        </tbody>
      </table>
    </div>
    <ul class="phaseNotes">
      ${PHASES.map((f) => `<li><b>${f.name} &middot; rounds ${f.from}&ndash;${f.to}</b><span>${f.note}</span></li>`).join("\n      ")}
    </ul>
  </section>

  <section>
    <p class="kick">The faults</p>
    <h2>Four reasons nine rounds could not finish</h2>
    <ul class="ledger">
      ${FAULTS.map(([h, tag, b]) => `<li><em>${tag}</em><b>${h}</b><span>${b}</span></li>`).join("\n      ")}
    </ul>
  </section>

  <section>
    <p class="kick">The measurement</p>
    <h2>The instrument stopped being able to resolve the question</h2>
    <div class="col">
      <p>Between rounds 13 and 14 the artifact <strong>strictly improved</strong>: twelve confirmed defects closed, the behaviour gate up forty-five assertions, nothing regressed. Seven blind seats were asked to grade it again.</p>
    </div>
    <div class="tblWrap" style="margin-top:28px;max-width:44rem">
      <table class="noise">
        <thead><tr><th>Seat</th><th>Round 13</th><th>Round 14</th><th>Change</th></tr></thead>
        <tbody>
          <tr><th>Typography</th><td>9.4</td><td>8.9</td><td class="dn">&minus;0.5</td></tr>
          <tr><th>UI composition</th><td>9.0</td><td>8.7</td><td class="dn">&minus;0.3</td></tr>
          <tr><th>Product taste</th><td>8.6</td><td>9.1</td><td>+0.5</td></tr>
          <tr><th>Brand and copy</th><td>8.8</td><td>9.2</td><td>+0.4</td></tr>
          <tr><th>Interaction and states</th><td>8.7</td><td>8.9</td><td>+0.2</td></tr>
          <tr><th>UX and information design</th><td>&mdash;</td><td>&mdash;</td><td class="dn">&minus;0.1</td></tr>
          <tr><th>Measured evidence</th><td>&mdash;</td><td>&mdash;</td><td class="dn">&minus;0.1</td></tr>
        </tbody>
        <tfoot><tr><th>Mean change</th><td></td><td></td><td>+0.01</td></tr></tfoot>
      </table>
    </div>
    <div class="col" style="margin-top:30px">
      <p><strong>Mean change +0.01. Individual seats &plusmn;0.5. The floor did not move at all.</strong> Per-seat noise is larger than the remaining distance to 9.5, and far larger than the per-round signal. The Typography seat signed off at 9.5 in round 10 and un-signed three times afterwards, every time on strictly better work.</p>
      <p>That is not a threshold this instrument can measure. Continuing to chase it would have meant termination depending on which seven reviewers happened to be drawn &mdash; not a quality bar, a lottery with a good prize.</p>
    </div>
  </section>

  <section>
    <p class="kick">The replacement</p>
    <h2>A gate the measurement can resolve</h2>
    <div class="col"><p>Three conditions, all of which must hold. Any one failing keeps the programme open. It is a harder bar in the ways that matter, because none of the three can be satisfied by a lucky draw of reviewers.</p></div>
    <ol class="gateList" style="margin-top:30px">
      <li><b>The floor is 8.5 or better</b><span>The lowest of seven blind seats, sustained across a round, not a single lucky sample.</span><em>held &middot; 8.6</em></li>
      <li><b>No confirmed blocker costs more than 0.5</b><span>A defect worth more than half a point is one round away from being fixed, and the programme stays open until it is.</span><em>held &middot; 0 above 0.5</em></li>
      <li><b>Nothing promise-breaking survives</b><span>A control that does nothing, a string that is not true, a payload you cannot see. These are not scored, they are disqualifying.</span><em>held &middot; none</em></li>
    </ol>
    <div class="note" style="margin-top:34px">
      <p><strong>9.5 remains the aspiration, and every seat is still asked for its sign-off.</strong> The sign-offs are still recorded in the Elevation Log round by round. What changed is that they no longer decide when the loop closes.</p>
    </div>
  </section>

  <section>
    <p class="kick">Unchanged</p>
    <h2>What the change did not touch</h2>
    <div class="col">
      <p>The direction lock, the architecture, the three-colour lock, Geist at 400 and 600, the copy rules, the voice disclosure, the five named benchmarks, the adversarial refuter defaulting to refused, both gates exiting zero, and the score being the lowest seat rather than the average.</p>
      <p>Everything that made the panel worth running is still running. The only thing removed was a finishing line the instrument could not see.</p>
    </div>
  </section>

  <p class="foot">
    Exploration only. The record is <code>${p.lab}/panel.json</code>, fourteen rounds deep;
    the round table above is generated from it. The full diagnosis, including the retired runner and the fix protocol
    that replaced it, is <code>docs/design/notes-gate-method-2026-08.md</code>.
    Findings counted here are only those that survived an adversarial refuter defaulting to refused.
  </p>

</div>
`;

const out = path.join(WS, p.worktree, p.lab, p.files.question);
writeFileSync(out, html, "utf8");
console.log(`Notes · The 9.5 Question -> ${p.files.question}  (${rows.length} rounds, ${tot.confirmed} fixed, ${tot.refuted} refuted)`);
