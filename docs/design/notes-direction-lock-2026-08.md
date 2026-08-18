# Notes · direction locked · The Stack

**Locked by the founder, 2026-08-18.** Branch `design/notes-exploration`.
Still exploration: no PR, no merge, no deploy, contract gates knowingly unmet
until product lock-in.

## What was chosen

**Direction C · The Stack**, from the three presented at
`docs/design/labs/notes-2026-08/DIRECTIONS.md` and photographed at
`docs/design/labs/notes-2026-08/shots/` (120 frames, 3 × 10 states × 4
viewports, zero console errors). The comparison surface is at
https://claude.ai/code/artifact/33dc4e0c-050d-44fd-81ef-b320058d1501

The architecture is now the working master for Notes:

- The Notes sheet is **two planes with depth between them**, not a list.
- The upper plane is a **desk** carrying the newest piece of paper. Writing
  happens on that paper: you are not filling in a field, and the paper is the
  newest note before it exists. Saving slides it onto the pile and lays a
  fresh one down.
- The lower plane is an **index**: everything older, one line each, with a
  status column, dense enough that a season of capture is scannable without
  scrolling past your own week.
- **Reading lifts a note out of the index onto the desk.** That is the only
  movement in the product and the reason the two planes exist.
- **Dictating takes the whole floor to ink.** White words at display size on
  the ink floor, the disclosure at the foot, the sheet still mounted behind.
- **The queue is a hand of cards.** The depth behind the top card is the
  number of decisions left, visible without reading a figure.
- **The seam peels a second, smaller piece of paper off the note**, carrying
  only the words that will cross. The note is never covered.

Everything inherited from `docs/design/tasks-direction-lock-2026-08.md` stands
unchanged: the ink floor, one white sheet, the floating capsule spine, the
dock at the foot, identity on the sheet's own head, the capsule and dock
merging on a phone, the three-colour lock, Geist 400/600, and status carried
by ink density and fill rather than by hue.

## What was rejected with it

- **A · The Desk.** Not chosen. Its argument — the composer leaves the sheet
  and becomes the dock — is preserved in `DIRECTIONS.md` and its frames are
  kept.
- **B · The Page.** Not chosen. Its three-column manuscript and its
  margin-written task are preserved the same way.

Nothing from either is deleted. Two elements are explicitly carried forward
into the master, recommended at the pick and adopted here:

| Graft | From | Why |
|---|---|---|
| A note lifted onto the desk is set as prose, with its metadata out of the text column | **B** | B's reading treatment is the best of the three, and a note being read is the one place in Notes where a person's own writing is the entire content. |
| On a phone, capture belongs in the dock rather than on a full sheet of paper | **A** | The desk's paper costs most of a 844px screen before a single note is visible. A's dock composer is the better one-handed answer, and the locked architecture already merges the capsule and the dock there. |

## What the founder called out as not yet good enough

**Nothing was recorded at the pick.** The founder chose C without stating an
objection, and instructed the programme to continue to the 9.5 gate.

This section is left open deliberately rather than filled in with inferred
objections. Two things stand in its place, and the panel is graded against
both:

1. **The bar carried over from the Tasks lock, verbatim in intent:** *9.5
   across the board, not "better than what shipped".*
2. **The verdict the Tasks taste seat reached at round 4**, which is the
   failure mode this direction was chosen to avoid: *"an extremely well-made
   kanban that happens to contain wedding words."* The Notes equivalent — an
   extremely well-made notes app that happens to contain wedding words — is
   the thing a seat should say plainly if it is true.

If the founder states objections later they are recorded here verbatim and
the next round is judged against them.

## Consequences accepted

The Stack contradicts pinned decisions beyond the ones the Tasks lock already
carried. They were argued in `DIRECTIONS.md` before the lock and are carried
forward as accepted:

| Pinned decision | Status after the lock |
|---|---|
| Notes' five-hue status system — green "In Tasks", red Delete, amber, cool zinc `#3f3f46` type | **Superseded.** Three colours, and state reads as ink density and fill. The offline reassurance stops being red. |
| `font-weight: 500`, declared twelve times in `notes-workspace.module.css` | **Superseded.** Geist 400 and 600 only. |
| The permanent 384px list / 561px detail split | **Superseded.** Two planes with depth, not two panes side by side. |
| "Hairlines, not shadows" (DS law 2) | **Narrowed further than the Tasks lock narrowed it.** Paper on paper is three stacked micro-shadows, and the pile is the direction's whole argument. Everything flat still keeps hairlines. |
| One plane per surface | **Broken.** The sheet is split, and depth carries the difference between now and everything else. |
| The voice consent stage as a blocking screen | **Superseded.** The disclosure survives verbatim — that rule never bends — but it rides at the foot of the listening floor rather than costing a press before anything is listening. |
| The top black rail | **Retired**, as in the Tasks lock. |

`check-chrome-contract.mjs` and the Notes half of the suite navigation
contract will both need rewriting at implementation. Neither is touched
during exploration.

## What happens next

1. **The master.** `docs/design/labs/notes-2026-08/notebook.html` — the
   locked direction as a live file with a real interaction layer, and three
   finished rooms as presets of named design decisions.
2. **Both gates, before round 1.** `scripts/design/notes-audit.mjs` for the
   palette, type, contrast, targets, radii and motion; and
   `scripts/design/notes-interaction-check.mjs` for behaviour. The Tasks
   programme learned at round 5 that grading frames instead of driving the
   file costs three seats. This one grades by driving from round 1.
3. **The elevation loop.** Seven blind seats, every finding sent to a fresh
   refuter that defaults to refuted, only survivors fixed, everything
   re-shot and re-driven, both artifacts republished each round, until the
   panel is unanimous at 9.5 or reports honestly why it cannot be.
