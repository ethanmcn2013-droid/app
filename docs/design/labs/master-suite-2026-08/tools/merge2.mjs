import { readFile, writeFile } from "node:fs/promises";
const panel = JSON.parse(await readFile("panel.json", "utf8"));
const r2 = JSON.parse(await readFile("panel/round-2.json", "utf8"));
const out = await readFile("_verify.out", "utf8");
const m = out.match(/(\d+) checks/);
const assertions = m ? Number(m[1]) : null;

const scores = {};
for (const s of r2.scores || []) scores[s.seat] = s.score;

const entry = {
  round: 2,
  seatsSat: r2.seatsSat,
  scores,
  signOffs: r2.signOffs || [],
  headline:
    "Two of three seats independently found the same blocking defect: Tasks' Planning drawer covered a fifth of the board and reserved no layout, so DONE was 100% covered at every desk width and the arrow keys walked the focus ring in behind an opaque panel. The cause was the composition, not the drawer — the lab had already fixed this and said so in a comment that is still there; scoping the product under its app compound turned the lab's root element into a demanded descendant, and five rules matched nothing from the day the document was composed. A selector that matches nothing fails nothing, which is why no gate saw it. Three more findings were one hole: focus moved and the board did not follow it. And the URL contract had never written once, because a const at the top level of one product's script shadowed window.history for the whole document.",
  confirmed: r2.confirmed,
  refuted: r2.refuted,
  severity: r2.severity,
  refuteRate: r2.refuteRate,
  /* One of seven — world-header-still-names-18-july — sits on work round 1
     did. The rest are composition defects older than the last panel. */
  selfInflicted: Number((1 / 7).toFixed(2)),
  frozen: false,
  gatesGreen: /all green/.test(out),
  assertions,
  deferredBuilds: [],
  blindness: null,
  notes:
    "Three rotating seats, not seven — the closing round is the full panel. refuteRate 0.50, down from 0.61, on a third the seats. selfInflicted 0.14 against round 1's 0.48: round 1's remediation did not manufacture round 2's findings, with one exception, and that exception was a stale comment rather than behaviour. The two blocking drawer findings are one defect found twice, which is the blind panel working as designed. Every confirmed finding closed with an assertion written first and watched failing; two of those assertions were themselves wrong on the first run (a node held across a repaint measures 0x0, and an ASCII space does not match the non-breaking space the horizon binds a date with) and were corrected before being trusted.",
  closed: r2.confirmed.map((f) => f.id),
  open: (panel.rounds[0].open || []).filter((id) => id !== "keycaps-four-notations" && id !== "who-hit-target-clipped"),
};
panel.rounds = panel.rounds.filter((r) => r.round !== 2).concat([entry]).sort((a, b) => a.round - b.round);
await writeFile("panel.json", JSON.stringify(panel, null, 2));
console.log("round 2 merged · assertions", assertions, "· gatesGreen", entry.gatesGreen);
