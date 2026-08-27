# Round 4 · a much larger surface than you last saw

**Read this first: more has changed since round 3 than between any two
rounds of this engagement.** Round 3 graded a composed artefact with three
products and one project. You are grading an application with a project
architecture, an expanded task surface, four control surfaces, a live search
and a status-colour system — none of which existed when the last panel sat.

Everything below was built to a founder's brief after round 3 closed, and
every one of the founder's own review notes has been actioned. Two rounds
are authorised. Spend them on the new surfaces.

## What is new since round 3

**A project architecture.** The suite had one hard-wired world. It now has
three projects and a switcher on the board's own head. Changing the project
changes Tasks, Timeline AND Planning together, because all three read the
same two objects. You can rename a project in place, create a new one, and
open **All projects** — a merged view holding 40 cards across three
projects with three plans on one measure in date order.

**The expanded task.** Pressing a card opens a centred modal: state, title,
what has to happen, the facts, activity, and everything else behind a
summary. Four routes reach it — a press, a drop, Enter and pointerup.
`aria-modal="true"`, scrim, Escape, and Tab is trapped inside.

**Four control surfaces.** Filter, Sort, Display and Share were closed
doors; they are real, and each carries its live state on its own FACE so a
person never has to open one to find out whether it is on.

**A status-colour system.** Five lanes, five colours, on at rest. This spent
the four-colour palette lock and it was the founder's call, made after they
reviewed a monochrome version and rejected it.

**A search field** that expands on focus, filters as you type, and moves
nothing on the board.

**A completion moment** — twelve particles and a ring, 400ms, fired once per
completion from every route.

**The rail**, rebuilt from the founder's own design session: a brand dot,
three named products, a `+` holding the doors that used to have tiles, and
a gear. The active product takes indigo on tile, glyph and label together.

## Decisions — argue with these, but do not report them as oversights

These are recorded in COMPOSITION.md with their reasoning. If you think one
is wrong, say so directly; that is worth more than a defect.

1. **The status colours spend the palette lock.** Amber, orange, green,
   yellow and a lifted indigo are now in it. The founder built and rejected
   the monochrome version. Every hue carries lane STATE and nothing else.
2. **The dots are flat and are the LIGHT colour of each pair.** They do not
   clear 3:1 on white unaided and do not need to: every lane's name is set
   in type beside its dot, so nothing is carried by colour alone. An earlier
   rimmed version read as a glow and was rejected.
3. **Notes is not partitioned by project.** It is the capture surface; a note
   gets a project when it crosses the seam.
4. **Manual is the default sort** — the only order the board can change by
   dragging. **By day sorts undated tasks LAST.**
5. **A new project is created empty.** No sample tasks.
6. **The task modal is centred, not a side panel.** It was a side panel and
   the founder asked for the middle of the screen.
7. **The rail label is 11px, not the design session's 9.5px** — 9.5 is off
   the ratified type ramp.
8. **`--indigo-on-ink` is `#a5b4fc`, not the design's `#818cf8`.** The design
   says tile, glyph and label take the accent together; a label is text and
   owes 4.5:1, and #818cf8 measures 4.19:1 on that tile.

## What the gates prove — do not spend findings here

`node verify.mjs` · `node gate.mjs` · `node interaction-check.mjs` ·
`node tools/prove-check.mjs` — **368 + 45 + 4, all green.**

Palette, weights, families, targets, radii, motion, type ramp and leading
across eight states and five viewports; each product against its own
ratified ladders; the seam end to end; the spine both directions; both
Timeline grounds; print; reduced motion; zero console errors.

New since round 3, and all measured rather than declared:
- **Projects (33)** — no cross-project content in the rendered products at
  two widths INCLUDING the hidden ones; board, Planning and Timeline name
  one project; a rename reaches all four places a name is written; a new
  project is empty; All projects is merged and date-ordered.
- **Delight (54)** — the completion burst fires once per completion from the
  tick AND the keyboard, is measured by PAINTED size, and clears itself
  away; reduced motion gets none of it; search opens, filters and contracts
  while the board does not move a pixel; every drop tint is measured for
  presence, restraint and CHROMA, and balanced across the five lanes; every
  dot is flat at rest and under a dragged card.
- **Flow (10)** — the founder's whole closing sequence driven as ONE session
  in one page, with the console silent across all ten steps.

## What the gates still cannot see — this is where the round is won

1. **Letterfit is not mechanically gated.** Three products, three ratified
   tracking curves. `three-eyebrows-for-one-role` has been open since round 1.
2. **A contrast residue is OPEN** — keycaps in the dictation state.
3. **Whether any of the new surfaces is any GOOD.** The gates prove the task
   modal opens centred, is modal, traps Tab and names its lane. They cannot
   tell you whether it is the right surface, whether its hierarchy is right,
   or whether a person would rather have had a side panel after all. Same
   for the switcher, the four control surfaces and the merged view.
4. **Whether the status colours are worth what they cost.** A four-colour
   lock survived nineteen rounds of Tasks and this engagement spent it in
   one. The founder asked for it. Is the product better?

## Still open from earlier rounds — known, classed, not worth a finding

`spoken-copy-below-the-visible-standard` · `waiting-lane-is-keyboard-inert` ·
`undo-drops-focus-on-body` · `three-eyebrows-for-one-role` ·
`done-is-the-name-of-a-lane` · `undo-lies-outside-the-tick` ·
`phone-undo-strip-eats-the-row-and-its-own-sentence` ·
`ledger-time-reads-as-completion` · `closed-doors-are-still-invisible`
(ink-density half only — the cursor half is fixed)

## The bar

Linear, Stripe, Vercel, xAI/Grok, SpaceX. One product designer's hand across
three products and three projects, in Signal Studio indigo.

Round 1 refuted 61%, round 2 50%, round 3 83%. **An empty findings list is
the expected answer for a finished surface.** Report what is wrong. If
nothing is, say so and say why.

## Drive it

```
_gate-suite.html?state=<product>.<state>&v=paper|ink&layout=across|down
```

`tasks.board` `tasks.dense` `tasks.planning` `tasks.filtered`
`notes.notebook` `notes.seam` `notes.voice`
`timeline.owner-flight` `timeline.desk` `timeline.phone`

The new surfaces have no gated state of their own and must be driven:
- **Project switcher** — press the workspace name in the head. Rename via
  the pencil on a row; **All projects** and **New project** under the rule.
- **The expanded task** — press any card, or Enter on a focused card.
- **Filter / Sort / Display / Share** — the tools row and the head.
- **Search** — the field at the foot of the sheet.
- **The completion moment** — press any card's tick.
- **The drop tints** — drag a card over each of the five lanes.
