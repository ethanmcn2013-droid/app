/* Merge round 3's record into panel.json, with the fields round.mjs cannot
 * know: what the gates said, how much of the round was self-inflicted, and
 * the prose. Run after both gates are green.
 *   node tools/merge3.mjs
 */
import { readFile, writeFile } from "node:fs/promises";

const panel = JSON.parse(await readFile("panel.json", "utf8"));
const r3 = JSON.parse(await readFile("panel/round-3.json", "utf8"));
const out = await readFile("_verify.out", "utf8");
const assertions = Number((out.match(/(\d+) checks/) || [])[1]) || null;

const entry = {
  round: 3,
  seatsSat: r3.seatsSat,
  scores: r3.scores,
  signOffs: r3.signOffs || [],
  headline:
    "Seven seats, and the round nearly lied about itself. 25 of 36 refuters " +
    "were killed by a session limit, and tools/round.mjs counted every one of " +
    "them as a refutation — which would have recorded a 97% refute rate off " +
    "eleven actual verdicts. That is the third time this engagement has been " +
    "bitten by absence reading as a pass, after a selector that matches " +
    "nothing failing nothing, and a privacy check that passed because the " +
    "field the fix read had gone with the fix. Re-run to completion, the real " +
    "numbers are 36 raised, 35 judged, 6 confirmed, 83% refuted. Two blocking: " +
    "the card menu rendered 250px above the top of the screen at every card, " +
    "every lane and every width because it measured a `display: contents` " +
    "element that has no box; and undo across the seam left the keyboard on " +
    "document.body, the same defect round 1 closed twice on the Tasks side and " +
    "never drove on this one. One misleading, and it was about the evidence " +
    "rather than the artefact: a seat checked the brief's own claim that both " +
    "gates pass and found the file it named reporting two failures.",
  confirmed: r3.confirmed,
  refuted: r3.refuted,
  unadjudicated: r3.unadjudicated || [],
  judged: r3.judged,
  severity: r3.severity,
  refuteRate: r3.refuteRate,
  /* One of six — the gate's own false positives — sits on work this
     engagement did. The rest are older than the last panel. */
  selfInflicted: 0.17,
  frozen: false,
  gatesGreen: /all green/.test(out),
  assertions,
  deferredBuilds: [],
  blindness: null,
  notes:
    "refuteRate 0.83, the healthiest of the engagement, on the full seven " +
    "seats. Two of the six confirmed are composition defects of the same class " +
    "as round 2's drawer — a suite-level property silently zeroing something a " +
    "product wrote against its own root — which says that class is what this " +
    "artefact exists to find and is not yet exhausted. The unadjudicated " +
    "finding `closed-doors-are-still-invisible` was split rather than taken " +
    "whole: its cursor half is a plain defect, fixed and gated across three " +
    "products, and its ink-density half proposes setting type in a token whose " +
    "own declaration reads 'decorative only, never type', so it is recorded as " +
    "an open design decision inside a locked palette rather than decided by a " +
    "gate. Gates at close: verify 270, interaction-check 45, prove-check 4, " +
    "gate.mjs green with the contrast residue still printed OPEN.",
  closed: r3.confirmed.map((f) => f.id),
  open: (panel.rounds.find((r) => r.round === 2)?.open || [])
    .concat(["closed-doors-are-still-invisible-ink-density"]),
};

panel.rounds = panel.rounds.filter((r) => r.round !== 3).concat([entry])
  .sort((a, b) => a.round - b.round);
await writeFile("panel.json", JSON.stringify(panel, null, 2));
console.log(
  `round 3 merged · judged ${entry.judged} · confirmed ${entry.confirmed.length} ` +
  `· unadjudicated ${entry.unadjudicated.length} · assertions ${assertions} ` +
  `· gatesGreen ${entry.gatesGreen}`,
);
