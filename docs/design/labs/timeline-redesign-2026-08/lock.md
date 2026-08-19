# Timeline · direction locked · B · The Approach

**Locked by the founder, 2026-08-18:** *"lets go with b the approach and lets
get this to world class 9.5/10"*. Branch `design/timeline-redesign-2026-08`,
draft PR #154. Still exploration: no app code, no schema, no deploy.

The comparison surface was published before the pick and all three
directions were resolved at all eleven states and all four widths. A and C
remain in the lab as the record; nothing is deleted.

## What was chosen

**Direction B · The Approach.** Settled by this lock, and not to be
reopened by any seat:

- **The organising object is a distance, not a list.** Vertical position on
  the measure is `daysFromToday × pixels-per-day`, computed from the real
  dates. A fortnight looks like twice a week because it is one.
- **The day is a horizon that never moves.** The count, the date and what
  the day is are the first three things on the surface, in that order, and
  at desk width they stop scrolling.
- **The past is behind you.** What has already happened sits under the
  measure, stated in a sentence, listed in full only if asked for. Two
  things that already happened do not deserve a third of a phone screen.
- **The ground is a named decision and both values are built.** `ink` is
  the direction as drawn. `paper` is the same composition inverted through
  the declared ink ladder. Print forces paper.
- **Editing is moving something nearer.** The date control moves the item
  on the measure while you hold it, and moves nothing else.
- One reversibility surface, in one place, always the same place.
- Conditions and distances are named in words as well as drawn, so the
  fact exists for anyone who is not reading the picture.
- Every number on every surface derives from one accessor in `fixture.js`.

## What was rejected with it

- **A · The Programme.** Not chosen. Files and frames remain (`a.css`,
  `render-a.js`, `shots/a-*`). Ideas worth folding in if they earn it: the
  printer register with its date column, and the press stamp on publish.
- **C · The Answer.** Not chosen. Files and frames remain (`c.css`,
  `render-c.js`, `shots/c-*`). The idea worth folding in if it earns it:
  leading the received artifact with the single next thing, rather than
  making a reader find it on the measure.

## What the founder called out as not yet good enough

Recorded verbatim, because every round is judged against it:

1. *"lets get this to world class 9.5/10"*

Nothing else has been said. This section stays open and stays visible;
it is not evidence that anything else is agreed.

## Decisions this lock supersedes

| Standing decision | Status after the lock |
|---|---|
| Studio Floor architecture (floor / sheet / capsule / dock) | Superseded — dissolved by name in the engagement brief before this lab started |
| `--x-artifact-*` display register, two-register rule | Superseded — this lab invents its own material system in `shell.css` and `b.css` |
| "Owner chrome frames but never restyles the artifact" | Superseded — the owner stands on the same ground as the guest and the difference is that the owner can move things |
| Timeline density contract | Superseded — density here is a named decision (`past`) with two ratified values |
| `now` maps to "Happening now" (`vocabulary.ts`) | Narrowed — the measure has no condition labels at all; what is next is a filled tick and the nearest item. The string is unused rather than rewritten |
| Operator light-lock (never ship dark on Signal Studio) | **Broken for this surface, by the founder, in picking B.** The argument is in `DIRECTIONS.md` §B: this artifact is not an operating surface, it is a thing you are sent, and it is opened in the evening on a phone. It is broken as a named decision (`ground`), not as a rewrite — the paper room is built, audited and shot alongside, so the light-lock is one click away at any point |
| Indigo is a mark, never a ground | **Stands.** In this direction indigo is a rule and a filled tick and nothing else. On ink it cannot set type at all: 2.99:1 |
| Tokens at `src/ds/tokens.css` are generated, never hand-edited | Stands — untouched by this lab |

## The mechanical lock

From this moment the measured gate enforces these. Changing any of them is
a design decision, not a tweak.

**Palette.** Ink `#111111` · Paper `#ffffff` · Indigo `#4f46e5`, and tints
of those three at the declared alphas and nothing else.

**The fore ladder.** Everything in the master is written against `--fore`
and `--back`, never against ink or paper directly, so the ground decision
is a nine-line flip with no parallel stylesheet to forget. The two ladders
do not permit the same floor: over paper the floor for type is ink at 0.62
(5.34:1); over ink it is paper at 0.46 (4.65:1). A token chosen for one
ground is a token that fails on the other, which is exactly how the first
attempt at this left two controls painting white on white.

Declared alphas, both ladders: 0.90 · 0.72 · 0.62 · 0.46 · 0.28 · 0.16 ·
0.10 · 0.06 · 0.04. Below the floor they draw rules and never letters.

**Indigo.** On ink it is 2.99:1 and never sets type — it is the today rule
and the filled tick on the next thing, and nothing else. On paper it is
6.31:1 and passes at every size.

**Families and weights.** Geist 400 and 600, Geist Mono 400. Three faces,
no others, no third weight.

**Type ramp.** 11 · 12 · 13 · 15 · 17 · 20 · 24 · 30 · 38 · 48 · 64 · 96 ·
148. Thirteen steps and no fourteenth. 11 and 12 are the mono micro-labels
and the mono data size; 13 is small prose; 15 and 17 are body; 20 to 48 is
voice; 96 and 148 exist for one thing only — the count, which is the whole
composition.

**Radii.** 0 · 4 · 6 · 8 · 12 · 16 · 24 · 999.

**Motion.** Durations 0 · 0.08 · 0.14 · 0.22 seconds. One easing family,
`cubic-bezier(0.23, 1, 0.32, 1)`. Nothing bounces, nothing floats idly, and
reduced motion removes every transition — asserted, not assumed.

**Pixels per day.** 12 on a phone, 14 at desk width, 10 in print. The scale
is derived from the tightest real gap in the fixture (seven days) and the
tallest an item can grow (two lines), so no two items can collide at any
width. That is what lets the measure stay strictly proportional instead of
quietly fudging the close ones.

## The rooms

Three finished versions of the locked direction, each a combination of the
four named decisions rather than a copy:

| Room | ground | spacing | past | accent |
|---|---|---|---|---|
| **The approach** | ink | measured | folded | once |
| **On paper** | paper | measured | folded | once |
| **The long view** | ink | measured | listed | structure |

`spacing` is not a room difference but is live in the console: real
distance against even rhythm. The honest cost of a proportional measure is
holes in the page, and the panel should be able to look at both rather
than take the lab's word for it.

## What happens next

Both gates were green before round 1: the measured gate across three rooms
× eleven states, and 108 behaviour assertions. The loop then runs to a
unanimous 9.5 or to an itemised honest distance.
