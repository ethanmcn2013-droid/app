# Elevation brief · master-suite · 2026-08

## Target

Signal Studio, as it would look in production: **Notes, Tasks and Timeline as one
running application** — one ink floor, one white sheet, one floating capsule spine
between them, and one world of data underneath all three. It is not a document about
three products; it is the three products, live, with the walls taken out. A person
captures a note, peels the words that matter off it, sends them to Tasks, watches the
card land in the lane the seam chose, and looks at the Timeline to see how far off the
day is. The single job the whole surface does is: **make a season of work legible to
one person who has to run it.**

The three products arrive here having each survived twelve to nineteen rounds of
adversarial review as standalone surfaces. What has never been reviewed is them being
one thing.

## Audience

Orla, the venue manager at The Orchard — she runs weddings and events for a living, has
no project-management background, no training on this, and opens it on a desk on a
Tuesday and on a phone on a Saturday.

## Fixture

`src/fixture.js` — one world, asserted at load. The Orchard, events; Orla, venue
manager (OR); Mara & Finn on Saturday 18 July; the review clock pinned to **Thursday
16 July 2026**. Every string is lifted from the product's own review fixtures
(`src/lib/review-suite-fixture.ts`, `tasks-demo.ts`, `notes-demo.ts`,
`vocabulary.ts`), including curled apostrophes and en dashes, which are pinned by a
cross-suite contract and must not be normalised. The file asserts one clock, one cast,
one venue, one set of milestones and the six-note-to-six-task join, and throws rather
than rendering a suite that disagrees with itself.

Nothing on any surface is placeholder text.

## States

Eight, driven by `?state=<product>.<state>` against `_gate-suite.html`:

| State | What it is |
|---|---|
| `tasks.board` | the board at rest — thirteen tasks, five trays |
| `tasks.dense` | peak season, three couples, a board that scrolls |
| `notes.notebook` | the stack at rest — the desk above, the index below |
| `notes.seam` | the peel open, words picked, the crossing about to happen |
| `notes.voice` | dictation — the whole floor goes to ink |
| `timeline.owner-flight` | the owner's plan. **Across at a desk, down on a phone** |
| `timeline.desk` | what a guest receives and opens |
| `timeline.phone` | the received artifact on a phone, down the page |

**Folded from thirty.** Tasks ships 6 states, Notes 10, Timeline 14. The folds and
the reason for each: Tasks' `empty`, `loading`, `planning` and `cards` fold into
`board` — they are the same composition with less in it, and the specimen sheet
(`cards`) is a teaching surface, not a product screen. Notes' `capture`, `readback`,
`review`, `search`, `pressure`, `nothing` and `not-yet` fold into `notebook` and
`seam`. Timeline's eleven other states fold into the three above, except the two
grounds, which are graded as variants rather than states because that is what they
are. **A seat that thinks a fold hid something should say so — that is a finding
about this brief, and it is a good one.**

## Register and materials

The three-colour lock, unchanged and not negotiable:

- **Ink** `#111111` · **White** `#ffffff` · **Indigo** `#4f46e5`, plus `#4338ca` as
  the indigo ramp one step darker, and tints of those at declared alphas. No other
  hue paints anywhere. Status and hierarchy are ink density, weight and fill — never
  colour.
- **Geist 400 and 600, Geist Mono 400.** Three faces, no fourth, no third weight.
- Easing `cubic-bezier(0.23, 1, 0.32, 1)`, durations on the declared ladder.

Everything mechanical is in `elevate.config.json` and enforced by the measured gate.
Read its `notes` block: `ladders.sizes` and `ladders.spaces` are deliberately empty
because three products carry three separately ratified ladders and one config cannot
hold three — each product is held to its own by `tools/gates.mjs`.

## The gate

Recorded at 9.5 and **gating nothing**. The engagement ends on the severity ledger
(`references/stopping.md`), not on a score: seven blind seats on one artifact disagree
with SD 0.335, so a unanimous 9.5 needs true quality of 9.94 to pass half the time.

**Round budget: 3.** Set by the founder before round one. When the budget is spent and
the ledger has not closed, the engagement stops anyway and publishes the honest
distance: what is open, at what severity, and what it would take.

## Decided — inherit, do not re-explore

- **The Studio Floor architecture.** An ink floor the whole app sits on — not a frame
  drawn around it. One white sheet lifted off it. The spine off the wall: a floating
  capsule carrying the suite, pointing at the sheet it opened. The dock at the foot.
  Identity on the sheet's own head. On a phone the capsule and the dock are the same
  object.
- **Tasks · Direction C, Studio Floor**, at the founder's locked configuration:
  elevated cards, soft radius, comfortable density, subtle indigo, calm type.
- **Notes · Direction C, The Stack**: two planes with depth between them, a desk above
  carrying the newest paper, an index below, reading lifts a note onto the desk,
  dictating takes the floor to ink, the seam peels a second smaller sheet off the note.
- **Timeline · Direction B, The Approach**: the organising object is a distance, not a
  list; the day is a horizon that never moves; the past is behind you; position on the
  measure is `daysFromToday × pixels-per-day` computed from real dates.
- **The suite is one application.** One rail, rendered once. Three products mounted at
  once, none ever torn down, so nothing a person was doing is lost when they glance at
  another.

## Protected — elevate with a scalpel, never re-imagine

- **The seam.** Notes → peel → send → a card on the Tasks board in the lane the seam
  chose → `open-task` reveals it → undo removes it from both. This is the whole
  argument for a suite existing. Polish it; do not redesign the gesture.
- **Honest doors.** Home, Inbox, Help, More and the account tile are present,
  reachable, in the tab order, and say plainly that they are not here yet. That is a
  designed answer, not a gap. **A finding that says "build a Home screen" is out of
  scope.** A finding that says the sentence on one of those doors is wrong is in.
- **One clock, one cast, one venue.** The fixture asserts it. Do not propose data.

## Open — the actual exploration

This is what the panel is for. Three things, in the founder's own words:

1. **"Timeline needs two versions — a horizontal and a vertical the end user can
   easily toggle. The horizontal is much more of a beautiful full-screen artefact
   that delights on initial view; the vertical is designed for mobile."** Built this
   round: `across` and `down`, defaulting by viewport (across at ≥1024, down below),
   with a control on the measure's own head and `?layout=across|down`. **`across` is
   new surface and has never been reviewed.** It is the largest single risk in this
   round and seats should treat it as such.
2. **"Make sure we are actually using our horizontal space properly."** At 1920 the
   three surfaces were painting 45% (Notes), 40% (Timeline) and 21% (Tasks) of the
   sheet white for no reason. Corrected this round — Notes' stack 1060 → 1440,
   Timeline's stage uncapped for `across`, Tasks' tray ceiling 312 → 372 and its sheet
   cap derived from it. **Whether that is now right, or merely wider, is the panel's
   to say.**
3. **"SpaceX, Grok, xAI all have the same product UI/UX designer — that is the quality
   we are aiming for, just also making it our own with the Signal Studio indigo."**

## What binds

- The palette, families and weights above. Mechanically enforced.
- **The voice rules, which never bend:** plain English, active verbs, sentence case,
  no exclamation marks, the banned-words list in `studio/BRAND.md`. Every fact has one
  grammar; the same place never has two names.
- The artifact is **one self-contained page** that reaches no external host, supplies
  no page skeleton of its own, and carries **no switch UI** — no console, no settings
  tray. The orientation control is a product affordance on the measure, not a console.
- **A committed single look.** The page does not follow the viewer's light/dark
  setting; every ground is painted.
- `docs/design/labs/master-suite-2026-08/COMPOSITION.md` records every decision made
  where the three sources disagreed. It is the argument document and it is
  overturnable — a finding may contradict it, and should say so.

**Explicitly released by the founder this round:** *"remember not to be held back by
old contracts and restraints."* The three direction locks are inherited as
architecture, not as pixels. The previous engagement's constraint — pixel-faithful to
the three locked configurations, redesign nothing — **no longer binds**. Where a lock
and the quality bar disagree, say so and argue it.

## What is out of scope

- Building Home, Inbox, Help, More, or an account surface.
- A fourth colour, a third weight, a fourth typeface.
- Data-model changes: a moment has no time of day, a task has no created-at, and
  neither is this engagement's problem.
- The port into `src/`. This is a lab artefact; `references/handover.md` governs the
  port and it is not this engagement's job.
- Re-litigating the three direction picks. Direction C, C and B are the founder's.

## Drive

Everything is driven against the wrapped copy, which is what `verify.mjs` and
`tools/wrap.mjs` produce:

```
docs/design/labs/master-suite-2026-08/_gate-suite.html?state=<product>.<state>
                                                      &v=paper|ink
                                                      &layout=across|down
```

- **The spine**: `.rail [data-rail="notes|tasks|timeline"]` — click or Enter. Arrows
  walk it (down/up at desk, left/right at ≤720). It never rebuilds a product.
- **Tasks**: cards are draggable and keyboard-carryable (Space picks up, arrows walk,
  Enter drops). The tick completes. `Ctrl/⌘Z` undoes. Press a card body to open its
  note. The chips in the head filter.
- **Notes**: type in `.topField`. Click an index row to lift it onto the desk. Select
  words in `.readBody`, then `[data-act="peel"]`, then `[data-act="send"]`. `Ctrl/⌘K`
  searches. The suite tiles live in the dock at ≤720.
- **Timeline**: `[data-layout-to="across"|"down"]` on the measure's head switches
  orientation. `.b-grab` opens a moment's editor; the steppers move it on the measure.
  `Ctrl/⌘Z` undoes.
- **Grade by driving.** Frames hide exactly the defects that cost most — a live region
  that never announces, a repaint that loses your place, a keyboard model advertised
  and not implemented.

## Delivery

- Branch `design/master-suite-2026-08` · lab
  `docs/design/labs/master-suite-2026-08/`
- The living artifact is the master itself, republished to the same URL every round:
  https://claude.ai/code/artifact/832d5b84-e6a0-43e6-a151-1f80dc17bd76
- At the budget: the honest distance, the severity ledger, and what it would take.
