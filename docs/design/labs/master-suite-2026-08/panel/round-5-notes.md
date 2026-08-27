# Round 5 · the closing round

This is the last round the founder has authorised. Whatever stands at the end
of it is what ships, so say what you actually think — including that it is
finished, if it is.

## What round 4 cost, and what it taught

Round 4 raised 36 findings across seven seats. **Twenty-nine of them stood**
— 3 blocking, 6 misleading, 18 defect — and **86% of them sat on work built
between rounds 3 and 4**. Every one is now closed.

It very nearly did not read that way. The round first reported itself as the
cleanest of the engagement: 2 confirmed, 94% refuted, zero blocking. That was
a tally bug, and it is worth knowing about because it shaped four rounds of
this record. A refuter returns `real: false` for two different verdicts — the
finding is WRONG, and the finding is RIGHT but its remedy is not — and the
contract asks for the second explicitly. Twenty-six "refutations" said in
their own first line that the problem was real and must not be discarded, one
at severity `blocking`. **Every refute rate reported in rounds 1 to 3 was
inflated the same way.** The collector and the metrics both count a third
bucket now.

What caught it was this panel's own strongest signal: four seats
independently reported the More menu and four the plus glyph, and all eight
were "refuted". Eight wrong findings do not converge like that.

## What is fixed since you last sat

**The three blocking.** A brand-new project threw a `TypeError` and rendered
a blank Timeline — eight characters. The project switcher would not close on
Escape or on a press outside, and the press that should have closed it fell
THROUGH onto the card beneath. The rail's More menu was painted for the ink
floor and opens over the white sheet: its label measured **1.00:1** — four
doors, present, focusable, correctly labelled, completely invisible.

**The six misleading.** "Project" named both a workspace and a notebook
subject. Notes' head named a project the rest of the suite had left. A new
project inherited The Orchard's wedding season and opened reading "day 1 of
97". Three Notes verbs answered only in the live region. The More door drew
the create glyph byte-identically. Escape in an open task dialog was eaten by
a live carry, throwing the card back and leaving the dialog open.

**The eighteen defects**, including: two controls named "More"; "Done" back
as a closer on both elements round 1 closed it on; a guest byline naming a
product that does not exist; the filter count printed ON the word Filter;
Dictate and Read a photo offered twice at once; the dictation actions split
across two rows between 760 and 880 only.

**And one the fixing found.** Making the move menu reachable in both
directions changed `visibility: hidden` to `opacity: 0` — which made it
COUNTABLE, whereupon the measured gate failed it at 24×24 against a 44px
floor. That control was never exempt from the target rule; it was invisible
to the check.

## Decisions — argue with these, do not report them as oversights

Recorded in COMPOSITION.md with reasoning. If one is wrong, say so plainly.

1. **The status colours spend the palette lock.** The founder built and
   rejected the monochrome version. Colour carries lane STATE and nothing
   else; everywhere else is still ink density, weight and fill.
2. **The status dots are flat and are the LIGHT colour.** They do not clear
   3:1 unaided and do not need to — every lane's name is in type beside its
   dot, so nothing is carried by colour alone. A rimmed version read as a
   glow and was rejected.
3. **Notes is not partitioned by project.** It is the capture surface. It no
   longer NAMES a project, which was the actual lie.
4. **The task surface is a centred modal**, not a side panel.
5. **`--indigo-on-ink` is `#a5b4fc`, not the design session's `#818cf8`** —
   the accent lands on tile, glyph AND label, and a label is text.
6. **A new project is created empty and dateless.** No season, no sample
   tasks, no invented span.
7. **Manual is the default sort. By day sorts undated tasks last.**

## What the gates prove — do not spend findings here

`verify.mjs` **379** · `gate.mjs` · `interaction-check.mjs` **45** ·
`tools/prove-check.mjs` **4** — all green.

New since round 4: the project menu dismisses like its six siblings and its
press does not fall through; a dateless project still renders a Timeline; the
More menu is measured for readability **where it actually opens**; the search
field fits; the filter badge does not overlap its own word; every status dot
is flat at rest and under a dragged card; the drop tints are measured for
presence, restraint, CHROMA and balance.

## What the gates still cannot see — this is where the round is won

1. **Letterfit is not mechanically gated.** `three-eyebrows-for-one-role` has
   been open since round 1.
2. **A contrast residue is OPEN** — keycaps in the dictation state.
3. **One finding is fixed but NOT REPRODUCED**: the filter sentence cut
   mid-word at 390. The wrap rule is in; I could not get that strip to render
   at that width to confirm. Treat it as unverified.
4. **Whether the new surfaces are any GOOD.** The gates prove the task modal
   opens centred, is modal, traps Tab and names its lane. They cannot say
   whether it is the right surface, or whether its hierarchy is right.
5. **Whether the status colours were worth the lock.** A four-colour lock
   survived nineteen rounds of Tasks and this engagement spent it. Is the
   product better?

## Still open from earlier rounds — known, classed, not worth a finding

`spoken-copy-below-the-visible-standard` · `waiting-lane-is-keyboard-inert` ·
`undo-drops-focus-on-body` · `three-eyebrows-for-one-role` ·
`undo-lies-outside-the-tick` ·
`phone-undo-strip-eats-the-row-and-its-own-sentence` ·
`ledger-time-reads-as-completion` · `closed-doors-are-still-invisible`
(ink-density half only)

## The bar

Linear, Stripe, Vercel, xAI/Grok, SpaceX. **An empty findings list is the
expected answer for a finished surface and it is the answer this panel is
trying to reach.** Report what is wrong. If nothing is, sign off and say why.

## Drive it

```
_gate-suite.html?state=<product>.<state>&v=paper|ink&layout=across|down
```

`tasks.board` `tasks.dense` `tasks.planning` `tasks.filtered`
`notes.notebook` `notes.seam` `notes.voice`
`timeline.owner-flight` `timeline.desk` `timeline.phone`

These have no gated state and must be driven: the project switcher (press
the workspace name — rename via the pencil, plus **All projects** and **New
project** under the rule); the expanded task (press a card, or Enter);
Filter / Sort / Display / Share; the search field at the foot; the completion
moment (press a tick); the drop tints (drag across all five lanes); the rail's
`+` and its panel.
