# Round 12 · what you are grading

## Two rooms, and only two

The founder has picked the configuration that ships. Everything else has
been deleted from the master.

- `?v=paper` — **the room as it ships.** Ink on white, the past folded to
  a line, indigo spent on the next thing AND on the rail that is still
  ahead.
- `?v=ink` — **the same four decisions with the ground flipped** through
  the declared fore/back ladder. Not a theme laid over the work: the same
  room read at night, for a reader whose system is set to dark.

Grade both. A fix that lands in one room and not the other is itself a
defect, and this panel has found that class twice — a rail alpha that
survived only on paper, and a focus-ring token that painted white on
white in the ink room. The two ladders do not permit the same values:
over paper, ink at 0.62 is the floor for type; over ink, paper at 0.46 is
the floor. A rule written against a literal white or a literal ink,
rather than against the ladder, is the shape both of those took.

Print forces the paper ground by design. That is not a defect.

## There is no finding quota

Report only the defects you actually found. **None, or up to five.** An
empty findings array is a valid and expected answer for a finished
surface.

This is not a formality. For nine rounds the seat schema required a
minimum of three findings each, so seven seats produced 33 to 35 findings
every round whether or not 33 defects existed — and because the gate is
the LOWEST seat, the floor measured the quota rather than the work.
Removing it moved the floor 7.2 → 8.6 → 9.1 in two rounds.

## Where it stands

| | Round 10 | Round 11 |
|---|---|---|
| Floor | 8.6 | **9.1** |
| Ceiling | 9.2 | **9.4** |
| Spread | 0.6 | **0.3** |
| Findings | 22 | **13** |
| Refuted | 2 | **0** |

Every seat rose in round 10. Every seat rose again in round 11. Thirteen
findings were filed and **not one was refuted** — eight met a refuter at
0.2 and above and all eight came back REAL on measurement, several
reproducing the seat's own figures to two decimal places.

Read that as the bar you are being held to. The panel is no longer
finding things by looking harder in the same places; it is finding the
last few by looking somewhere nobody has looked. The remaining distance
is 0.4 on the floor. A finding has to be worth its place.

## Read the settled ledger first

`panel/SETTLED.md` — **59 findings already raised and killed**, each with
the measured reason it died. A finding matching one of them is discarded
before a refuter is ever spent on it, unless it brings new evidence that
meets the stated objection.

Three items were raised in three consecutive rounds each and refuted every
time; they are closed: the editor's reserved band, the desk editor's foot
below the fold, and an arrival animation for the audience.

## Fixed in round 11 — do not re-report these

- The editor's undo band no longer paints over the first field's name.
  The reserve was hand-measured in the docked sheet; the shipping room is
  the 344px rail, where the same bar took three rows. The bar now sets as
  **one paragraph** — the action follows the last word — so it is 64px in
  either column, the label keeps 22 to 24px of air at every width, and
  the steppers hold at zero. A title long enough to take the sentence to
  four lines shortens the NAME rather than clipping the plate, because
  clipping would have hidden the Undo control itself.
- A day carrying three or more moments no longer deletes the date line of
  the row above. Each crowded plate paints an opaque 12px halo outside its
  own box; a stacked follower now carries the bottom padding the lead
  always had.
- The focus ring on the chat plate follows the LOCAL ground, not the
  room's. The plate is somebody else's white surface in both rooms, so
  the ink room's white ring was painting white on white at 1.00:1 — on
  the unfurl screen, where that card is the only focusable element there
  is.
- The artifact frame (`.tl-device`, `.tl-paperEdge`) is laddered, not
  literal. Its alpha edge used to composite over its own hard-white box,
  which made the bezel the loudest line in the ink room at 13.4:1 against
  an indigo rail at 3.0. It is now 1.59:1 on both grounds.
- A forced palette no longer flattens the loading frame's four slabs or
  the open editor's plate. Both carried their meaning by translucency and
  repainted Canvas-on-Canvas.
- The freshness stamp moves for every change an owner can make, not one
  in six. It is the only string that dates the plan for a guest.
- The publish headline no longer claims possession at the instant of
  publishing, and the live region no longer says the recipients can open
  it "now" when nothing has been sent.
- The printed sheet carries a scannable route as well as the typed URL,
  generated at build time from the same token. Still one A4 page.
- The date readout sets as two lines instead of one sentence whose
  separator ended line one alone in white space.
- An empty date field is refused as an empty field, not as an unreadable
  date; the over-ceiling refusal no longer shares its words with the note
  the panel writes when a date IS accepted at the limit.
- The three typing fields meet the 44px thumb floor on a coarse pointer.
- The badge on an open row hands focus to the panel it names instead of
  refusing the press while still announcing `aria-expanded="true"`.

## One item is open, and it is a build, not a regression

**The owner cannot edit a moment once it has passed.** It is on the
founder's list. Reporting it again costs a refuter and tells us nothing.

## The structure is frozen

The lock's decisions — position as `daysFromToday × pixels-per-day`, the
day as a horizon, the past folded, ground as a named decision — are not
open. A finding that amounts to restructuring goes on a build list for
the founder to schedule; it is not this round's work. Findings that
amount to "add a colour", "add a weight" or "restructure the locked
architecture" are out of scope and will be discarded.

## Both gates pass, on both grounds

- `audit.mjs` — **0 across fifteen categories**, for paper and for ink.
- `interaction-check.mjs` — **787 assertions, 0 failing**, up from 644.

Read the behaviour gate. Everything it asserts is already proven, and a
finding that restates one of its assertions is worthless.

But read it sceptically too. Three of this round's own new assertions
were caught proving nothing before they were trusted, and one STANDING
assertion — "the refusal says why" — had been passing for rounds on the
exact ambiguity round 11 finally found: it checked the refusal for the
words the panel writes when a date *is* accepted. **A passing assertion
that proves nothing is a real finding.**

One structural lesson worth carrying: a forced palette is applied by the
compositor, and `getComputedStyle` still reports what the author wrote.
Any check phrased against declared values passes while the screen is
blank. The new assertions read painted pixels. Anywhere else the gate
still reads computed style to judge what is PAINTED, it is lying.
