# Timeline · directions · 2026-08

Design exploration only. Branch `design/timeline-redesign-2026-08`, draft
PR #154, no deploy, no app code. The "before" is in `reference/` and read
honestly in `REFERENCE.md`.

All three directions live in one master (`master.html`) and are selected
with `?v=a|b|c`. That is deliberate: they render the same fixture through
the same renderer core, so a difference you can see is a difference in
design and never a difference in data. Every one of the eleven states in
the brief is resolved in all three. There is no hero-only direction here.

Fixture: the real Mara & Finn review timeline — ten milestones, nine of
them live, the pinned clock of 16 July 2026, the wedding on Saturday
3 October 2026, seventy-nine days out. Every number on every artboard is
derived from that one object through one accessor.

---

## The brief all three answer

A guest opens this link once, on a phone, probably while doing something
else, and decides what they think of the whole company from that one
screen. An owner — a planner, or the couple — has to build the thing that
guest opens without ever feeling like they are doing data entry, and has
to hand it over in a way that feels like giving someone something rather
than granting them access. The same object then has to survive a desk
screen, a printer, a chat app's unfurl, the morning of the day itself,
and the day the link is switched off.

None of the three may drop these jobs:

| Job | A · The Programme | B · The Approach | C · The Answer |
|---|---|---|---|
| Whose day it is | masthead, 38/64px | the first line, above the count | the card head |
| Which day it is | second line of the masthead | the horizon, under the number | second block of the card, never scrolls away |
| How far off it is | the facts line, once | **the whole composition** | a line on the card, and the plan mark |
| What is next | the register, indigo condition | the filled tick at the top of the measure | **the whole card** |
| What is already done | listed or folded, in words | "Behind you", under the measure | a condition in the plan below |
| What is not going ahead | struck row, still counted | listed in "Behind you" | a condition in the plan below |
| Who keeps it, when it changed | the foot | the foot | the foot |
| The way out (owner) | the bench | the bar | the bar |
| Reversibility | one undo line under the sheet | one undo line under the field | one undo line under the studio |

---

## A · The Programme

**Thesis.** The received artifact is not a timeline, it is a printed
programme: the sheet that sits on the seat at a wedding. There is one
object in this direction and it appears at four sizes — the phone is the
sheet at hand width, the desk is the sheet on a table, the print IS the
sheet, and the unfurl card is the head of the sheet torn off. The owner
does not operate a dashboard; the owner sets the sheet, and edits happen
in the row's own place on it, because the plan is what you are judging
the change against.

**What it deliberately sacrifices.**
- Any sense of the day approaching. A printed sheet does not count down,
  and the countdown is reduced to one figure in a facts line. This is the
  least emotional of the three and it knows it.
- Density of feeling for density of fact. Nine rows at equal weight is
  the most scannable arrangement here and the least memorable.
- The print state is genuinely excellent and the phone state is merely
  very good, which is the wrong way round for the brief's flagship case.

**Where it breaks a standing decision.**
1. **The `now` label.** `src/modules/timeline/lib/vocabulary.ts` maps the
   `now` state to "Happening now". On this fixture that milestone is
   sixteen days away, so the loudest line on the artifact would be
   untrue. All three directions derive the label from the date instead
   and say "Next" until the day arrives. This is an additive vocabulary
   proposal, not a data change: the DTO state stays `now`.
2. **The weekday column.** The reference product prints the weekday in
   its own right-hand column; on this plan that column reads SAT seven
   times. It is folded into the date itself.

**Proposed token changes (additive, named).** None. Direction A is
buildable inside Ink / Paper / Indigo and the seven-step ink ladder
already declared in `shell.css`. That is part of its argument.

**Candidate delight moments.**
- The press. Publishing stamps the sheet, at an angle, once, with the
  date. It is the only rotation in the whole system.
- The register rule under the live condition is the only indigo on the
  sheet, so the eye finds the next thing before it reads anything.

---

## B · The Approach

**Thesis.** The artifact does not exist to inform, it exists to make a day
feel like it is coming. So the organising object is a DISTANCE, not a
list: one vertical measure on which a pixel is a real unit of time. The
fortnight between today and the menu tasting is visibly twice the week
between the menu tasting and the invitations, because it is computed from
the dates and nothing on the measure is hand-placed. The day is a horizon
that never moves; everything else approaches it.

**What it deliberately sacrifices.**
- Length. Seventy-nine days at twelve pixels a day is a 994px measure on
  a phone. You scroll through time. That is the point and it is also the
  risk: a guest who does not scroll sees three items.
- Even density. Real plans bunch. The gap between 29 August and 5 September
  is small and the gap between today and 1 August is large, and the page
  has holes in it where life does.
- Printing. An ink page cannot come off a home printer, so the print
  state inverts to ink-on-paper. That is the one impossibility this
  direction admits, in writing, rather than hiding.

**Where it breaks a standing decision.**
1. **The operator light-lock.** Signal Studio surfaces are light-locked by
   founder decision. This direction stands on ink and puts that decision
   on the table on purpose. The argument: this artifact is not an
   operating surface, it is a thing you are sent, and it is opened in the
   evening on a phone, in bed, where a white page is a flashlight. If the
   light-lock holds, B can be inverted to ink-on-paper wholesale — the
   measure, the horizon and the ladder all survive the flip — but it
   loses the thing that makes the unfurl card stop a thumb.
2. **Indigo may not set type here.** Indigo on ink is 2.99:1 and fails AA
   at every size, so in this direction the accent is only ever a rule or
   a filled mark. That constraint is doing real work: it is what stops the
   accent turning into wallpaper on a dark ground.

**Proposed token changes (additive, named).** None, but one is worth
naming as a question for the lock: on ink, indigo would need to lift to
roughly `#6f68ee` before it could carry a word. It does not carry one in
this build. If the founder wants indigo text on ink anywhere in the suite,
that lifted value has to be ratified as a fourth palette entry, and the
measured gate has to learn it.

**Candidate delight moments.**
- The stepper on the editor moves the item ON the measure while you hold
  it. Changing a date is not filling in a field, it is pulling something
  nearer.
- The horizon does not scroll away at desk width. The number is the reason
  the reader is on the page.

---

## C · The Answer

**Thesis.** A guest opening this once, on a phone, while doing something
else, is not reading a plan. They are asking one question — what is next,
and when is the day — and everything else on the screen is in the way of
the answer. So the artifact leads with the ANSWER, full bleed, and the
plan lives underneath it for anyone who wants it. The owner is never shown
a version the guest does not get: the answer card sits at real phone width
on the left of the owner's screen, live, and changing a row changes it
while you look at it.

**What it deliberately sacrifices.**
- Scannability of the whole plan at a glance. Everything except the next
  thing and the day is one scroll away, and the direction has decided that
  is acceptable.
- The register's rule that the accent never becomes a surface. This is the
  one that should be argued hardest, below.
- Print economics. The keepsake is a folded card with a solid indigo
  front panel. That is a print-shop job, not a home printer, once.

**Where it breaks a standing decision.**
1. **The accent becomes a ground.** In A and B, indigo is a mark spent
   two or three times. Here it is a full field. The argument: it appears
   exactly once in the entire product, it carries the one thing that is
   next, and after this no other Signal Studio surface may use indigo as a
   ground. Either that is the strongest possible use of a single accent,
   or it is the direction that breaks the register — and the panel should
   say which rather than the lab deciding for it.
2. **The list stops being the product.** Every prior Timeline decision
   treats the list as the artifact. Here it is the appendix.

**Proposed token changes (additive, named).** One, load-bearing:
`--c-on-accent` — the text ladder allowed on an indigo ground. White is
6.3:1 and passes at every size; white at 0.90 is 5.4:1 and passes; white
at 0.72 is 3.98:1 and does not, so it never sets type. If C wins, that
three-step ladder is the thing Home, Notes and Tasks inherit for any
accent-ground surface.

**Candidate delight moments.**
- The ended state is the absence of indigo. In a direction where the
  accent is the answer, a page with no indigo on it says there is no
  longer an answer here, before anyone reads a word.
- The way down is a real control with a real count on it: "The whole
  plan · 9 moments". "There is more" without a number is a guess.

---

## What all three already refuse

These are not up for discussion in any direction, and the panel should
refute any finding that asks for them back:

- **A count that cannot be reconstructed.** The reference product says
  "2 of 9 complete" over a fixture of ten milestones and drops the
  cancelled one silently. All three say nine live, two done, one not
  going ahead, and show the struck row.
- **Four grammars for one fact.** The reference product says "3 Oct",
  "79 days to go", "Wedding day · 3 Oct 2026" and "in 16 days" on one
  screen. Each direction picks one grammar per fact and holds it.
- **Unanchored time.** Every direction states today somewhere on the
  surface, so "1 Aug" never needs arithmetic to feel.
- **Loading that promises what will not arrive.** No shimmer anywhere.
  A reserves the sections it will actually render; B refuses to draw a
  measure whose tick positions are among the things still loading;
  C paints the card, because the card is the frame and the frame is known.
- **Silent truncation.** Every clamped string keeps its full text in the
  accessible name and is trimmed to the last whole word, re-run on
  `fonts.ready` and on every repaint.

---

## Zones, for reactions

Numbered so a reply can name one without describing it:

| # | Zone | What is in it |
|---|---|---|
| 1 | The owner's home | what you land on with a project in flight: A the bench and the sheet, B the bar and the field, C the studio and the live card |
| 2 | Editing | where a change happens and what it feels like |
| 3 | The publish ceremony | the moment a private plan becomes someone else's copy |
| 4 | The received artifact, phone | the one screen that decides everything |
| 5 | The received artifact, desk | what the extra width is spent on |
| 6 | The object itself | the sheet / the measure / the card, and whether it is the right object |
| 7 | Type and colour | the ladder, the numerals, where the indigo goes |
| 8 | The long tail | the day, the print, the unfurl, the ended link, the loading frame |

The comparison surface (the Design Console) carries every direction at
every state and every width, with the two cross-direction decisions —
what happens to the past, and where the indigo goes — as live controls,
so a reaction can be to a combination rather than to a screenshot.

---

## The pick

**This is the founder's, and the loop stops here.** What is being chosen
is not a skin: it is what a shared timeline IS. A document (A), a
distance (B), or an answer (C). Whichever wins is elevated to the gate
and becomes the language Home, Notes and Tasks wear next.

Two questions ride with the pick because guessing them would waste a day:

1. **Does the light-lock hold?** B is the only direction that breaks it.
   If it holds, B can still be built inverted — say so and it will be.
2. **May the accent be a ground?** C stands or falls on it.
