# Tasks · direction locked · Studio Floor

**Locked by the founder, 2026-08-18.** Branch `design/tasks-exploration`.
Still exploration: no PR, no merge, no deploy, contract gates knowingly unmet
until product lock-in.

## What was chosen

**Direction C · Studio Floor**, from the three presented at
`docs/design/labs/tasks-2026-08/DIRECTIONS.md`.

The architecture is now the working master for Tasks, and the working
hypothesis for Notes and Timeline when their turn comes:

- A **floor** the whole app sits on, not a frame drawn around it.
- One **sheet** holding the product, lifted off the floor.
- The spine **off the wall**: a floating capsule carrying the suite, pointing
  at the sheet it opened.
- Statuses as **trays**, so a card is somewhere rather than merely listed.
- The verbs — search, add, account — collected into one **dock** at the foot
  of the sheet. On a phone the capsule and the dock are the same object.
- Identity on the **sheet's own head**, the way a file names itself.

## What was rejected with it

- **A · Ledger.** Not chosen.
- **B · Atelier.** Not chosen.

Both remain captured at `docs/design/labs/tasks-2026-08/shots/` and described
in `DIRECTIONS.md`. Nothing from them is deleted; elements may still be folded
into the master if they earn it.

## What the founder called out as not yet good enough

Recorded verbatim in intent, because the next round is judged against it:

1. **The task cards are not world class.** The strongest single objection. The
   card system is being rebuilt, not tuned.
2. **The palette is wrong.** Not the grey, not the white, not the paper. The
   ground, the sheet and the trays all need to stop being neutral.
3. **The bar is 9.5 across the board**, not "better than what shipped".

The voice and copy were called out as right and are not being changed.

## Consequences already accepted

Studio Floor contradicts three pinned decisions. They were argued in
`DIRECTIONS.md` before the lock and are now carried forward as accepted:

| Pinned decision | Status after the lock |
|---|---|
| Board pass 3, decision 1 · "Pure white field" | **Superseded.** The canvas is a floor holding a sheet. Reinforced by the founder's own objection to white and grey. |
| Board pass 3, decision 1 · the deleted 5% lane tint | **Partially superseded.** Trays may carry a surface, but never a per-status colour. The original objection was to colour-coding, and that objection stands. |
| Design-system law 2 · "hairlines, not shadows" | **Narrowed, not broken.** Only objects that genuinely float carry a shadow: the sheet, the capsule, the dock, and a card in flight. Everything flat keeps hairlines. |
| "Studio bar + rail · keep. Surgical fixes only." | **Superseded** by the re-exploration brief. The top rail is retired. |

`board-pass3-contract.test.mjs` and `check-chrome-contract.mjs` will both need
rewriting at implementation. Neither is touched during exploration.

## What happens next

Three elevated variations of Studio Floor, differing in ground material and in
card anatomy, are at `docs/design/labs/tasks-2026-08/floor.html`. One of them
becomes the master. After that: Notes, then Timeline, then implementation.

## The default combination, locked 2026-08-24

The founder worked the six decisions in the Design Console and locked one
combination as the product's default and preferred option:

| Decision | Value |
|---|---|
| Preset it started from | A · Air |
| Card style | **Elevated** (changed from Air's flat) |
| Corner radius | **Soft** (changed from Air's round) |
| Density | Comfortable |
| Indigo | Subtle accents |
| Type scale | **Calm** (changed from Air's expressive) |

This is now the `locked` preset in `floor.html` — the master every panel seat
reviews and the shape the app is generated from. A · Air, B · Frame and
C · Signal are unchanged: the console's whole argument is that any mix of the
six decisions stays on-brand, and a preset that quietly followed the default
would stop proving it.

### What this does to the shadow law, and why it is not a breach

Design-system law 2 was already narrowed at the lock: *only objects that
genuinely float carry a shadow — the sheet, the capsule, the dock, and a card
in flight.* An elevated card resting on the sheet appears to widen that.

It does not, on the reading this combination makes true: **an open task is live
work and floats; a finished task has settled and lies flat.** `[data-cards=
"elevated"]` gives a resting card `--ring, --raise` and explicitly returns
`.card[data-done]` to a flat hairline. So the shadow is not decoration applied
to every card — it is the board's statement of which work is still in the air.

The consequence is that completing a task is now a *set-down*. The card lifts
to the product's one heavy shadow for the journey and loses its shadow entirely
as it lands in Done. The metaphor and the mechanic are the same thing, which is
what the completion beat was missing when Product taste scored it 7.4 in round
12 and called the board "admirable and cold".

Recorded as a deliberate reading of the law rather than an exception to it. If
a seat argues the resting shadow is decoration, that argument is in scope; a
finding that merely states "cards carry a shadow" is not.

## The freeze, 2026-08-24

After fifteen rounds the loop was rebuilt. The diagnosis is in the Tasks
Elevation Report; the operating change is here.

**The master's feature surface is frozen for the remainder of the elevation.**
Remediation may only remove defects from what already exists. A panel finding
whose answer is "build X" is recorded as `kind: "build"`, deferred to a list for
after the gate, and never remediated during a round. The evidence: across rounds
12 to 15, 53%, 39%, 54% and 68% of each round's confirmed defect cost came from
surface built since the previous panel. Rising, not falling. The floor was never
being set by the accumulated work; it was being set by the newest room.

**The founder's configuration is final and is not under review.** Elevated
cards, soft radius, comfortable density, subtle indigo, calm type. Seats are
told so. A finding proposing a different card style, radius, density, indigo
level or type scale is out of scope, in the same way that adding a fourth colour
already was. The other three presets remain in the Console as the argument that
any mix stays on-brand, and they are no longer shot, audited or worked.

**Every confirmed finding must leave a rule, not a patch.** Seats now state the
class-level rule behind each finding, refuters judge the rule as well as the
fix, and preflight fails if a round is recorded whose remediation did not grow
the behaviour gate. This answers the most expensive failure of the first fifteen
rounds: a preset/custom-property collision fixed on three rules and found again
on a fourth, and a press-is-a-click guard fixed on the tick and found again on
the card body.

**The gate may only grow.** `gate-floor.json` records its size and preflight
fails if it shrinks. It is the loop's memory — 299 assertions, every one added
because a seat found the defect it guards — and it is worth more than any single
round's score.

## The Console opens on the locked combination, 2026-08-26

Until now the Design Console opened on preset **A · Air** and the locked
combination existed only in `PRESETS.locked` in the master. Anyone opening the
Console — including the founder, and every link now pointing at it from the
other three artifacts — landed on flat cards, round corners and expressive type
rather than on the configuration that was locked on 24 August. The Console now
opens on the default, names it as *The default* in its own group above the three
alternatives, and its reset returns there. Its store key moved to
`signal.tasks-console.v2` so a browser holding the old starting preset does not
quietly outrank the lock.

### Two defects found while shooting the artifacts for cross-linking

**A malformed `@keyframes settleIn` had been silently scoping 562 rules into
nonsense in the Console.** An edit that removed the fade from the completion
beat left the old `to { ... }` and its closing brace stranded outside the block.
The browser recovers from invalid CSS and the standalone master rendered
correctly, so nothing caught it; the Console's CSS scoper walks braces and
trusts them, so it lost its place at that point and emitted several hundred
declaration-shaped selectors. The visible symptom was the dock rendering as an
unstyled full-width block with a 175px search icon, in the one artifact nobody
had reason to screenshot. Rendering of the master is unchanged by the fix: the
stranded rule was dead in every browser.

`build-customizer.mjs` now asserts the master's CSS braces balance before
splitting, and asserts the scoped output contains no declaration-shaped selector
and no empty rule. Both throw rather than warn. **The browser recovers from bad
CSS; a build step must not have to.**

**`--indigo-line` was used in the Log and never defined**, so `.step[data-first]`
and the current-page card fell back to `currentColor` and drew an ink edge where
an indigo one was intended. Defined now in all three theme states.

### And a third, in the generator that feeds production

`extract-floor-css.mjs` was scoping keyframe selectors along with everything
else, so every `@keyframes` in `src/components/floor/floor.module.css` read
`.root from`, `.root 0%`, `.root 100%`. A keyframe selector is a position on a
timeline, not an element: prefixed, the keyframe list parses as empty and the
animation does nothing. **Every animation in the shipped board was dead** — the
tick settle, the check draw, the count settle, the carry-in, the skeleton
breathe — while the lab master played all of them, which is why nineteen rounds
of panel review never saw it. The generator now leaves keyframes alone.

This is a lab-side fix to a generated file. The app has not been run against it
in this session; `floor-prod-check.mjs` needs a dev server and was not
exercised. Treat the app-side verification as outstanding work for the port.
