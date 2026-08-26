# Round 3 · the closing round

This is the last round. Seven seats, not three. The founder set a budget of
three and this is the third, so whatever stands at the end of it is what ships
— say what you actually think, including that it is finished if it is.

## What round 2 found, and what it cost

Three seats raised fourteen findings and refuted seven. Every confirmed one is
closed. Two seats independently found the same blocking defect, which is the
panel working: when two blind seats land on one thing it is real.

**The Planning drawer covered a fifth of the board and reserved no layout.**
Opening Planning painted a 388px opaque panel over the board. DONE — everything
the operator has finished — was 100% covered at 1280, 1440 and 1920. WAITING was
cut mid-word at "a deliver". The board's own scroller had nothing to give:
`scrollWidth === clientWidth`. Nothing said so, and the covered cards stayed
live, so arrowing right walked the focus ring in behind an opaque panel while
the product narrated content that was not on screen.

The cause is worth naming, because it is the thing this artefact exists to
find. Tasks' lab had already fixed this, and said so in a comment that is still
there: *"it sliced the Waiting column mid-word and erased Done entirely."* The
lab wrote the accommodation as `.floor:has(.drawer) .sheet`, where `.floor` was
the lab's own root. Composing three products scoped every product rule under its
app compound — which turned the root into a demanded **descendant**,
`[data-app="tasks"] .floor`, and in the suite the floor is `#deck`, the app's
**parent**. Five rules matched nothing from the day this document was composed.
The fix existed; the composition silently un-wrote it, and no gate could see it
because **a selector that matches nothing fails nothing**.

`tools/reach.mjs` now gates the whole class, not the instance: no product rule
may name a suite-level ancestor as its own descendant.

**Focus moved and the board did not follow.** Three findings, one hole. The
rover walked the ring to x=1161 against a board ending at 1262, at every width
from 390 to 1440, and a completion flew the card into a lane that was off
screen. There is now one `reveal()` helper, sited once, that insets by the 96px
fade rather than stopping at the scroller's edge, suspends the snap for a frame,
and — deliberately — does not run while a flight is in progress. The card still
flies to where the hand is on a narrow board; the ring catches up after it
lands. **Argue with that call if you think the board should move first.**

**The URL contract had never written, once.** `const history = []` at the top
level of Tasks' script created a global lexical binding that shadowed
`window.history` for the whole document, so `replaceState` threw on every
navigation and a `try/catch` ate it. Another defect that only exists because
three products share one global scope.

**The horizon lied in its default orientation.** The gap sentence was written at
the foot of the down branch, below the orientation dispatch — so in `across`,
which is the default and the one every shipped frame shows, it was never
rewritten. Move the nearest moment three weeks out, or delete it, and the head
went on naming a date that now held nothing. It reads the nearest **upcoming**
row now, in both orientations, above the dispatch.

**And round 1's own fix left a lie behind it.** Round 1 moved the wedding to 3
October; both fixture headers went on declaring 18 July, one line under the
sentence "The header declares the facts they share."

## Deliberate — argue, but do not report as oversights

- The Notes column is 1440 wide, not 1060. `three-eyebrows-for-one-role` and the
  index measure are **still open**; if you think the answer is a clamp rather
  than a narrower column, say so.
- Home, Inbox, Help, More and the account tile do nothing and say so.
- Tasks' full stop is ink, Notes' is indigo, Timeline's is `--fore`.
- On a narrow board a completed card sets down where the hand is rather than
  sweeping the board. Named above.

## What the gates prove — do not spend findings here

`node gate.mjs` · `node verify.mjs` — **242+ assertions, all green.** Palette,
weights, families, targets, radii, motion, type ramp and leading across eight
states and five viewports; each product against its own ratified ladders; the
seam end to end; the spine both directions at both widths; both Timeline
grounds; print forcing paper; reduced motion; zero console errors. New this
round: the dead-selector class, drawer reachability at three widths, the rover
and the tick staying inside the board at five widths, the gap sentence in both
orientations, and the URL contract actually writing.

## What the gates still cannot see — this is where the round is won

1. **Letterfit is not mechanically gated.** Three products, three ratified
   tracking curves (Tasks −0.010em at 13px, Notes −0.012em, Timeline −0.015em).
   Open since round 1 as `three-eyebrows-for-one-role`. Is this a system or
   three things in one document? Two rounds have declined to answer.
2. **A contrast residue is OPEN** — keycaps in the dictation state, where the
   shared model, a render proof and the eye disagree. Printed as OPEN every run
   rather than passed or failed.
3. **Two frames are not byte-reproducible** — `notes.voice` at 768 and 1440 has
   a live waveform and a running clock.
4. **Timeline's `interaction-check.mjs`** (845 assertions) is still written
   against the lab master's eleven states as separate page loads. It is
   repointable and it is not done. It is the largest single piece of outstanding
   verification.

## Still open from round 1 — known, classed, not worth a finding

`spoken-copy-below-the-visible-standard` · `waiting-lane-is-keyboard-inert` ·
`undo-drops-focus-on-body` · `undo-drops-focus-to-body` ·
`three-eyebrows-for-one-role` · `done-is-the-name-of-a-lane` ·
`undo-lies-outside-the-tick` · `phone-undo-strip-eats-the-row-and-its-own-sentence` ·
`closed-doors-are-indistinguishable` · `ledger-time-reads-as-completion`

## The bar

Linear, Stripe, Vercel, xAI/Grok, SpaceX. One product designer's hand across
three products, in Signal Studio indigo. The question for this round is not
"what is wrong" — two rounds have answered that and the blocking list is empty.
It is **whether a person who ships at that bar would put their name on this.**

An empty findings list is the expected answer for a finished surface. Round 1
refuted 61%, round 2 refuted 50%. Report what is wrong. If nothing is, sign off
and say why.

## Drive it

```
_gate-suite.html?state=<product>.<state>&v=paper|ink&layout=across|down
```

`tasks.board` `tasks.dense` `notes.notebook` `notes.seam` `notes.voice`
`timeline.owner-flight` `timeline.desk` `timeline.phone`
