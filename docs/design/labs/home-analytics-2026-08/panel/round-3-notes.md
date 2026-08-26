This is the closing round. **The structure is frozen.** A finding whose
answer is "build X" — a destination, a wired retry, a new object — is
recorded on the port packet and is not remediated on this surface. File it
if it is real; it will be honoured, but it will not move a pixel this round.
Findings that change what is already on the screen are the ones that can be
acted on.

Two rounds have run. Round 1 raised 69 findings from seven blind seats,
clustered to 37 distinct claims, confirmed 29. Round 2 raised 26 from three
rotating seats, clustered to 19, confirmed 14, and confirmed **nothing
blocking and nothing misleading**. The behaviour gate has grown from 122
assertions to 461. Both gates are green.

## What changed in round 2, so you argue with it rather than report it

- **Interaction paints at all.** `.rise` used `animation-fill-mode: both`,
  which puts the keyframe end state in the animation origin — a layer that
  outranks every plain author declaration permanently. Every `:hover` and
  `:active` transform on this surface had been dead since it was written.
  The fill is now `backwards`, so rest, hover and press are three different
  frames and the gate measures all three from what actually paints.
- **The document is the scroller.** The rail is sticky at full height; the
  reading column scrolls with the page, so the keyboard can reach the bottom
  of the surface and a resize no longer strands focus below the fold.
- **The loading state neutralises every magnitude in place.** It used to
  draw the data it claimed to still be reading, at full value, then swap it
  for the same numbers. It now holds the geometry and none of the facts, and
  the strip reserves the band the de-swarm may need instead of growing into
  it — a loading frame cannot promise a height that depends on data it has
  not read.
- **The KPI row is read, not operated.** The cards were link roles whose
  href appended a bare `#`. The role is gone; the row's sentence moved from
  duplicated text leaves onto the group's own name, so each card is
  announced once.
- **Quiet marks carry a ring.** Marks under the fortnight were a fill that
  composited under the 3:1 non-text floor; they are now ringed, solid past
  the fortnight, which clears the floor without leaning on hue.
- **The fortnight label no longer escapes its card**, and the first-run week
  label stands next to its own mark rather than 300px away.
- **Status indigo is in the dark lock.** It was the one mark the dark twin
  had no token for.
- **Focus rings are inset from the window edge**, so a focused mark at the
  scroll boundary is not clipped by it.

## Decisions you may take for oversights — argue, do not file as misses

Everything in `round-2-notes.md` still stands. In addition:

- **The chart's context columns sit at 1.48:1 (light) and 1.70:1 (dark)**
  against the card, under the 3:1 non-text floor. This is known, measured
  and on the port packet. The obvious fix inverts the chart: the current
  week is a hatch compositing to 1.71:1, *fainter* than the columns it would
  be contrasted against, so darkening the columns alone makes the live mark
  the weakest thing in the frame. If you have a fix that does not invert the
  reading, that is worth a finding. Restating the shortfall is not.
- **Nothing on this surface opens anything.** There is no destination for a
  filtered list of open work and no wiring for the retry. Both are on the
  port packet. An affordance that leads nowhere is the defect round 2
  removed; do not ask for it back.
- **`?state=` and `?v=` exit 2 on an unknown value.** That is the contract,
  not a crash.
- **The fixture is Harbour House, weddings, Orla, nine open.** Every number
  on the screen is derived from `src/lib/project-truth-fixture.ts` and the
  build fails if a state's sentence and its own marks disagree. A number you
  think is wrong is a fixture question, not a copy question.
- **The company name is never shortened.** Note bodies and email never enter
  this domain.

## What is worth your findings

This round is graded on whether the surface is finished, not on whether it
could be different. The highest-value findings are the ones that survive a
refuter defaulting to REFUTED: something that is measurably wrong in a state
you drove, at a width you set, on a ground you flipped — or an assertion in
`interaction-check.mjs` that **cannot fail**, which is worth more than the
defect that exposes it. Four vacuous assertions have been found so far; two
of them were written by seats in earlier rounds and two were mine.

**An empty findings array is the expected answer for a finished surface.**
There is no quota. Do not raise a refinement to have raised something.
