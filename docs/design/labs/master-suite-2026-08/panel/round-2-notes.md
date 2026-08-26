# Round 2 · what changed, and what is still open

Round 1 raised seventy findings, refuted forty-three and confirmed twenty-seven.
All six `blocking` and all seven `misleading` are closed. Twelve `defect`
findings are open and listed at the bottom — **they are known, so a finding that
restates one of them is spent.**

## What is different since you were last here

**The spine's keyboard model works.** It did not. Five seats found that
independently and they were all right: Tasks was still answering the suite's nav
with its own pre-suite rover, so every arrow moved two tiles; Notes' guard asked
"am I mounted" rather than "is the keyboard in me", so ArrowDown off a rail tile
walked the note index; and the rover's member list contained a tile that is
`display: none` at every desk width, so the walk clamped on nothing. Forty-eight
assertions now watch it at three products and two widths.

**The seam keeps its promise.** It told you in bold that Tasks receives only the
words you pick, and then sent the whole private note. It now sends the picked
words and nothing else — and the check tests both halves, because "sent nothing"
also satisfies "sent only the picked words".

**There is one wedding day.** Notes said Saturday 18 July, in 2 days. Timeline
said Saturday 3 October, in 79. `WORLD.wedding` holds it once, the notebook
derives from it, and the fixture throws at load if a third ever appears. **The
notebook's head has lost its two-day urgency as a direct result** — that was the
cost of the fix and it is the kind of thing worth arguing with.

**Smaller:** the ledger counted three crossings while the index badged six. Notes
painted two account tiles making two different promises about one door. A 27px
orphan hairline floated above the horizontal track. The orientation switch was
silent on the guest surface. And Timeline now wears `timeline.` on its own sheet
head at 17/600 like the other two, instead of "Signal Timeline" at 11px mono in
the footer — the footer colophon stays, because on a page a couple opens from a
link it is provenance rather than chrome.

## Deliberate, argue but do not report as oversights

- The Notes column is 1440 wide, not 1060. Typography called the index measure at
  1920 "two and a half times the ceiling" and that finding is **still open** — see
  below. If you think the answer is a clamp rather than a narrower column, say so.
- Home, Inbox, Help, More and the account tile do nothing and say so.
- Tasks' full stop is ink and Notes' is indigo; Timeline's new one is `--fore`.
- The rail mark's dot is ink, not indigo.

## What the gates prove — do not spend findings here

`node gate.mjs` · `node verify.mjs` — **216 assertions, all green**, up from 133.
Palette, weights, families, targets, radii, motion, type ramp and leading all
zero across eight states and five viewports, plus each product against its own
ratified ladders. The seam end to end, the spine both directions at both widths,
state surviving a switch, both Timeline grounds, print forcing paper, reduced
motion, zero console errors.

## What the gates still cannot see

1. **Letterfit is not mechanically gated.** Three products, three ratified
   tracking curves (Tasks −0.010em at 13px, Notes −0.012em, Timeline −0.015em).
   `three-eyebrows-for-one-role` is open on exactly this. Product taste asked in
   round 1 whether that is a system or three; it is still an open question.
2. **A contrast residue is open** — keycaps in the dictation state where the
   shared model, a render proof and the eye disagree.
3. **Two frames are not byte-reproducible**: the dictation state at 768 and 1440.
   It has a live waveform and a running clock.

## Open from round 1 — known, classed, and not worth a finding

`keycaps-four-notations` · `spoken-copy-below-the-visible-standard` ·
`waiting-lane-is-keyboard-inert` · `undo-drops-focus-on-body` ·
`undo-drops-focus-to-body` · `three-eyebrows-for-one-role` ·
`done-is-the-name-of-a-lane` · `undo-lies-outside-the-tick` ·
`phone-undo-strip-eats-the-row-and-its-own-sentence` ·
`closed-doors-are-indistinguishable` · `ledger-time-reads-as-completion` ·
`who-hit-target-clipped`

**An empty findings list is the expected answer for a finished surface, and it is
the answer this panel is trying to reach.** Round 1 refuted 61% of what it was
sent, which is above the rate at which seats are filing to fill slots rather than
reporting defects. Report what is wrong. If nothing is, say so.

## Drive it

```
_gate-suite.html?state=<product>.<state>&v=paper|ink&layout=across|down
```

`tasks.board` `tasks.dense` `notes.notebook` `notes.seam` `notes.voice`
`timeline.owner-flight` `timeline.desk` `timeline.phone`
