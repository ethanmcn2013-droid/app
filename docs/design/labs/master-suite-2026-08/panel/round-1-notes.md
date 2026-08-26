# Round 1 · what is new, and what you are being asked

This is the first panel this artefact has ever had. The three products inside it
have each been reviewed to death as standalone surfaces — twelve, fourteen and
nineteen rounds. **Them being one thing has never been reviewed at all.**

## New since anything was last looked at

1. **Timeline has two orientations.** `across` draws the whole approach on one
   horizontal measure — today at your feet, the wedding day at the far end, every
   moment at its true share of the distance. `down` is the column the lab shipped.
   A desk opens on `across`, a phone on `down`, and a control on the measure's own
   head switches it. **`across` is entirely new surface and has never been seen by
   anybody.** Treat it as the largest risk in this round. Drive it: press the
   control, resize, check both directions.
2. **The horizontal space is used differently on all three.** At 1920 the suite was
   painting 45% of the Notes sheet, 40% of the Timeline sheet and 21% of the Tasks
   sheet white for no reason. Notes' content column went 1060 → 1440, Timeline's
   stage cap came off for `across`, and the Tasks tray ceiling went 312 → 372 with
   the sheet cap derived from it. Whether that is *right* or merely *wider* is
   yours to say — and a finding that says a measure has been lost is a good finding.

## Deliberate decisions you might mistake for oversights

Argue with any of these if you disagree — but report them as arguments, not as
things nobody noticed.

- **The rail mark's dot is ink, not indigo**, and Notes' own master painted it
  indigo. The Tasks lock states the rule at class level: the accent is spent only
  on what the specimen sheet says it means. One spine, so one rule.
- **The wordmark full stop is ink in Tasks and indigo in Notes.** That mark is on
  each sheet's own head and each lock defends its own.
- **Home, Inbox, Help, More and the account tile do nothing** and say so. That is a
  designed answer. Building them is out of scope; the *words* on them are not.
- **Notes' ledger reads "Done" three times** where it used to read three different
  lanes. The board is the authority on a lane and the two fixtures disagreed.
- **The Timeline lab caption is gone** — `OWNER · MARA & FINN IN FULL FLIGHT` was
  lab furniture printing across a production application.

## What the gates already prove — do not spend findings restating these

All green before this panel was convened. `node gate.mjs`, `node verify.mjs`.

- **Each product against its own ratified ladders**: Tasks' audit, Notes' audit and
  Timeline's elevate audit, all repointed at this file, all zero.
- **Cross-product, five viewports × eight states**: palette 0, weights 0, families
  0, targets 0, radii 0, motion 0, type ramp 0, leading 0, leading-role 0,
  leading-ladder 0, tracking-ladder 0.
- **Behaviour**: the seam end to end, the spine both directions by mouse and
  keyboard, state surviving a product switch, both Timeline grounds, print forcing
  paper, reduced motion honoured completely, zero console errors on every surface
  at every width. Plus 44 assertions on the orientation work specifically.
- **Fidelity**: every product's sheet is still pixel-identical to its own frozen
  lab master at four widths, apart from the changes named above.

## What the gates CANNOT see — these are yours, and they are named

Gate blindness is a finding, and these are declared rather than hidden.

1. **Letterfit is not mechanically gated.** The shared check groups across the whole
   document, and this document holds three products (two hidden at any moment but
   still in the DOM). A per-product re-run was written and can see one product at a
   time but cannot see *role* — Notes tracks by size and applies by role, so it
   reports three declared tokens doing three different jobs at 15px as drift. It
   prints 16 such groups and gates on nothing. **The three products carry three
   separately ratified tracking curves: Tasks −0.010em at 13px, Notes −0.012em,
   Timeline −0.015em.** Side by side in one application, is that a system or three?
2. **A contrast residue is OPEN.** The shared model, a render-based proof and the
   eye disagree about a handful of keycaps in the dictation state — specifically
   how to measure a 1px inset ring on an ink ground. Four earlier iterations of
   that proof found four real defects, including a blocking one. This residue is
   unresolved and named.
3. **Two frames are not byte-reproducible between runs**: the dictation state at
   768 and 1440. It has a live waveform and a running clock. Nothing else moves.

## Drive it

```
_gate-suite.html?state=<product>.<state>&v=paper|ink&layout=across|down
```

States: `tasks.board` `tasks.dense` `notes.notebook` `notes.seam` `notes.voice`
`timeline.owner-flight` `timeline.desk` `timeline.phone`

The spine is `.rail [data-rail="notes|tasks|timeline"]`. The orientation control is
`[data-layout-to="across"|"down"]`. In Notes, select words in `.readBody` then
`[data-act="peel"]` then `[data-act="send"]` — that is the seam, and it is the whole
argument for the suite existing.

**Frames alone will not find what matters here.** The two things most likely to be
wrong are a new composition nobody has looked at and three ratified systems standing
next to each other for the first time, and neither shows up in a screenshot.
