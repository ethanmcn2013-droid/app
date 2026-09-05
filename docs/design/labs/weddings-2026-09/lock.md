# weddings · direction locked · the Studio Floor, as it stands

**Locked by the founder, 2026-09-05.** Branch `design/weddings-exploration`.
Still exploration: no PR, no merge, no deploy until product lock-in.

## What was chosen

**The current direction**, without a Directions phase. Asked whether to explore
three registers for the wedding section inside the Studio Floor shell
(Instrument, Warmth, Paper) before locking, the founder chose:

> "No — lock the current direction now."

So the architecture every round treats as settled is the demo as built:

- The Studio Floor: ink floor, floating labelled rail, one white sheet.
- The wedding add-on as a labelled section in the rail, added by the `+`.
- Four destinations — Guests, Money, Seating, The Day — and nineteen modes as
  a segment row in the sheet head.
- Seed before navigation: content lands, then the section appears.
- Seating opens on the list.
- The three panel corrections (shares off the severity ramp; unrun ≠ passed;
  household states preserved).

## What was rejected with it

- **Directions A · Instrument, B · Warmth, C · Paper.** Not built. Skipping the
  phase was the founder's call; the "joyless admin" finding from the review
  panel is therefore addressed inside the loop, one confirmed finding at a time,
  rather than by a register exploration. Recorded here so nobody later reads the
  absence of `direction-*.html` as an oversight.

## What the founder called out as not yet good enough

Recorded verbatim in intent, because every round is judged against them:

1. "simple, intuitive, fun, and world class design — people should be able to use
   this out of the box, not read a manual or do a course or onboarding to
   understand stuff, it should just make sense it should be natural."
2. "we want these to be truly world class" — the four wedding tools and nothing
   else: "no need to focus on notes, tasks, timeline, or anything like that."
3. Scope decisions for this engagement: desktop and laptop only; run to
   convergence with a cap of six rounds.

## Decisions this lock supersedes

| Standing decision | Status after the lock |
|---|---|
| Tab strip inside the sheet (panel document) | Superseded — the destinations are a rail section, which is the founder's own model and reuses built chrome |
| Seating opens on the room (all five seats) | Superseded — opens on the list; the panel's own reversal |
| Composition floor of 1140px on a fixed sheet | Narrowed — the running product flows; tables scroll in their own box; no state may clip at 1440 or 1280 |
| 400ms rare tier reserved and unspent | Stands, and is now spent once, on the seed |

## The mechanical lock

Palette, families, weights and ladders live in `elevate.config.json` and are
enforced by `audit.mjs` from this moment. `ladders.typeRamp` is filled
(10 · 11 · 12 · 13 · 14 · 15 · 18 · 22 · 28); the master's stray sizes are the
first measured findings, not exceptions to the ramp.

## What happens next

The master honours the toolchain contract, both gates go green before any
panel, both artifacts go live empty, then the loop.
