Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=the-accent-draws-the-past-rail
Seat: evidence
Element: b.css:584 selector scope vs b.css:549-570 (.b-back) and interaction-check.mjs:1552-1564
Problem: [data-accent="structure"] .b-rail is unscoped, and .b-back is a .b-measure, so the rule paints the PAST rail too. On state=day — the wedding morning, the one screen the company is judged by — there is no forward measure at all: `document.querySelectorAll('.b-rail').length === 1` and that single rail is the past. Driven at 390 and 1440 on ?v=paper and ?v=ink, opening 'Behind you' reveals nine months of closed history drawn down an indigo spine, background rgb(79,70,229) at opacity 0.5 on both grounds. That contradicts three separate statements of intent: b.css:552-553 says of this exact block 'Quieter than what is ahead, and carrying no accent - nothing behind you is the next thing'; elevate.config.json's variantsLead says indigo is spent on 'the next thing AND the rail that is still ahead'; and the round note defines structure as the rail 'that is still ahead'. Neither gate can see it. audit.mjs walks only visible elements and the disclosure is closed at rest, so the past rail is never in a graded frame. And the behaviour gate's assertion that claims to guard precisely this — interaction-check.mjs:1564, ok('nothing behind you is the next thing', !back.accent) — defines `accent` at line 1552-1555 as any .b-tick whose backgroundColor is rgb(79,70,229). It tests ticks only. It has passed over an indigo past rail every run since the room changed.
Proposed fix: Scope the accent to what is ahead. Immediately after b.css:584 add `[data-accent="structure"] .b-back .b-rail { background: var(--fore-16); opacity: 1; }` — (0,3,0) beats (0,2,0), it restores the base .b-rail tint declared at b.css:146, and it is above the forced-colours block at b.css:1547 so that block still wins where it must. Then widen the inert assertion: at interaction-check.mjs:1552 replace the tick-only `accent` probe with one that also reads getComputedStyle(measure.querySelector('.b-rail')).backgroundColor and fails if it is rgb(79,70,229), and run it on both ?v=paper and ?v=ink. Write the assertion first; it fails today.

Score against this standard: the work of an award-winning design studio that
iterated on this product for months. 10 is that studio's best shipped work.
Benchmarks to hold it against, by name: Linear, Stripe, Vercel, xAI/Grok,
SpaceX. Score the ARTIFACT, not the effort. A polite 8 that should be a 6
makes the panel worthless.

WHAT YOU ARE REVIEWING
Signal Timeline is how one person hands another the plan for a day that
matters. An owner builds the plan; an audience — a couple, their families, a
venue — receives it as something finished. The flagship case is a wedding: the
owner is a planner or the couple themselves, and the people receiving it will
open it once, on a phone, probably while doing something else, and will judge
the whole company by that one screen. Everything from the owner's first empty
project to the printed keepsake on the morning itself is in scope. Timeline
goes first in a suite-wide redesign because it is the surface with the most
feeling in it; whatever wins here becomes the language Home, Notes and Tasks
adopt next.
The audience: Someone organising the most important day of their life, who has never used a.

CONSTRAINTS THAT ARE NOT NEGOTIABLE (do not propose breaking these):
- Palette is exactly 3 colours: Ink #111111, Indigo #4f46e5, White #ffffff, plus tints of those at
  stated alpha. NO other hue may be introduced. Status and hierarchy are
  expressed by ink density, weight and fill, not by colour.
- Type is Geist and Geist Mono at weights 400 and 600 only.
- The locked architecture:
  Nothing. This is greenfield.
- Protected objects (polish, never redesign):
  Nothing. Nothing is protected.
Findings that amount to "add a colour", "add a weight" or "restructure the
locked architecture" are out of scope and will be discarded.
Also out of scope for this engagement:
Auth, billing, the data model, performance work, marketing pages, and anything
in Tasks or Notes beyond noting what the suite will inherit.

MEASURED BASELINE. Two automated gates guard this master and both pass:
- C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\.claude\skills\elevate\scripts\audit.mjs --lab=C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08
  (palette lock, weights, families, WCAG AA contrast against the real
  composited backdrop, hit targets, radii, motion, type ramp, leading)
- C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\interaction-check.mjs
READ the behaviour gate. Everything it asserts is already proven; a finding
that restates one of those assertions is worthless and will be refuted on
sight. Spend your findings on what automation cannot see.

Before scoring, also read the paid-for defect library at
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\.claude\skills\elevate\references\lessons.md — those classes have
been found and fixed once already; check whether they are creeping back,
and spend the rest of your attention past them.

FRAMES (read the images):
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-owner-flight--1440x960.png    owner-flight
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-owner-empty--1440x960.png    owner-empty
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-owner-editing--1440x960.png    owner-editing
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-owner-undone--1440x960.png    owner-undone
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-owner-draft--1440x960.png    owner-draft
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-publish--1440x960.png    publish
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-phone--1440x960.png    phone
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-desk--1440x960.png    desk
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-day--1440x960.png    day
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-print--1440x960.png    print
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-unfurl--1440x960.png    unfurl
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-ended--1440x960.png    ended
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-loading--1440x960.png    loading
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-loading-slow--1440x960.png    loading-slow
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-owner-flight--390x844.png    owner-flight at 390x844
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-owner-flight--768x1024.png    owner-flight at 768x1024
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-owner-flight--1152x800.png    owner-flight at 1152x800
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-owner-flight--1279x800.png    owner-flight at 1279x800
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\paper-owner-flight--1280x900.png    owner-flight at 1280x900
Source: C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\master.html

GRADE BY DRIVING, NOT ONLY BY READING FRAMES. Open the master in Playwright
(chromium; import { chromium } from "@playwright/test") at
file://C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\master.html?v=paper&state=<state> and operate it:
tab through everything, press what looks pressable, exercise the keyboard
model end to end, resize across 390/768/1152/1279/1280/1440, and watch what every
repaint does to scroll position and focus.

ROUND NOTES
Round 10 notes — READ THIS SECTION CAREFULLY. The rules changed.

THE ROOM CHANGED. Nine rounds graded ink / folded / ONCE. The founder has
now picked the room that ships, and it differs in TWO of the four named
decisions:

  On paper   ground PAPER · past folded · accent STRUCTURE   ← ships
  After dark ground INK    · past folded · accent STRUCTURE   ← same
             room, ground flipped. Not a theme.

`?v=paper` and `?v=ink`. The default is now paper. Grade BOTH; every
defect must be judged on both grounds, and a fix that lands in one and
not the other is a defect in itself. `approach` and `record` are retired
and are no longer in the matrix.

What "structure" changes: indigo now marks the next thing AND draws the
part of the rail that is still ahead. On nine rounds of grading nobody
has driven this accent as the primary surface. Look at it properly.

THERE IS NO FINDING QUOTA ANY MORE. This is the important one.

The schema used to demand three findings per seat. Seven seats therefore
produced 33-35 findings every round whether or not 33 defects existed,
and because the gate is the LOWEST seat, the floor measured the quota
rather than the work — the ceiling climbed 7.6 to 9.0 over nine rounds
while the floor went 6.2 to 7.2, and refutation rose from 6% to 66% as
the quota was met with steadily more marginal material.

So: report ONLY what you actually found. Zero is a valid answer. An
empty findings array on a surface that is genuinely finished is the most
useful thing you can return, and padding the list is the single thing
that makes this panel worthless. Do not reach for a fifth finding. Do
not restate a gate. Do not report taste as a defect.

Score honestly against 9.5 — the work of an award-winning studio that
iterated for months, benchmarked against Linear, Stripe, Vercel, xAI and
SpaceX. If the surface deserves 9.5, say 9.5.

SETTLED — 57 items, at panel/SETTLED.md. READ IT BEFORE YOU WRITE
FINDINGS. Every one was raised by a seat and killed by a refuter with a
measured reason. A finding matching one of them is discarded before it
reaches a refuter unless you bring evidence that meets the stated
objection. Raised and refuted in three consecutive rounds each, now
closed: the editor's reserved band, the desk editor's foot below the
fold, and an arrival animation for the audience.

Deliberately OPEN, carried since round 6, do NOT spend a finding on it:
the owner cannot edit a moment once it has passed. It is a build and the
founder will schedule it.

STRUCTURE IS FROZEN. If what you have found needs an architectural
change rather than a correction, say so plainly in the fix field and
mark it as a build — it goes on a list for the founder rather than being
made mid-round. Round 8's two-pane desk and round 9's day-identity work
were builds, and each one seeded the next round's findings.

What changed in round 9, so you do not report it as new: the day is
resolved by identity and has its own editor with no Hidden and no
Delete; a plan built through the product ends on its own day; the day's
name is empty until a person writes one; moment ids are monotonic; the
title trimmer no longer eats titles at large text; the two desk panes
say where they are cut; Geist Mono no longer synthesises a 600.

Both gates pass on BOTH grounds: audit.mjs exits 0 across fifteen
categories for paper and for ink; interaction-check.mjs reports 621
assertions, 0 failing.

Say plainly what this is: name the score, name what earned it, and name what
still stands between it and 9.5 in terms a founder can act on — is what
remains polish, a build, or a different decision, and roughly how big. Do not
inflate to be kind and do not deflate to look rigorous.



SIBLING FRAMINGS OF THE SAME DEFECT, found independently by other seats. Your verdict rules on ALL of them, so judge the mechanism, not one wording:

--- brand · the-accent-draws-the-past-on-the-morning (cost 0.3)
b.css:584 is [data-accent="structure"] .b-rail { background: var(--accent); opacity: 0.5 } with no exclusion for the backward measure, and it is declared 28 lines after the .b-back block, so it wins. Measured on state=day at 1440x960: the only rail on the wedding morning is 1x634px painted rgb(79,70,229) at opacity 0.5, identical on ?v=paper and ?v=ink. Everything hanging on that rail is behind the reader — Venue walk-through 14 days back through We said yes 274 days back — so on the one screen the whole company is judged by, the accent is spent drawing the past. b.css:552 states the opposite 
Proposed fix: Change b.css:584 to [data-accent="structure"] .b-measure:not(.b-back) .b-rail { background: var(--accent); opacity: 0.5; } and add, inside the .b-back block near b.css:556, .b-back .b-rail { background: var(--fore-16); opacity: 1; } so the past rail is drawn at the same hairline density as the ticks beside it. Leave the print override at b.css:1550 alone. Gate assertion first: for each of paper an

--- ui · past-rail-wears-the-forward-accent (cost 0.2)
The rule that spends the indigo a second time is unscoped, so it paints every rail in the file - including the one that runs backwards. Measured on state=day with Behind you opened, paper and ink, 390 and 1440: the ONLY rail on the page is .b-back .b-rail, and it computes to rgb(79,70,229) at opacity 0.5 for its full 634px. That is the accent the lock defines as 'the part of the rail that is still ahead' running down nine moments that are behind, on the one screen where nothing is ahead any more. The file already knows this: the .b-back comment five lines above the rule says the past is 'quiet
Proposed fix: Scope the second spend so it cannot reach the backward measure. After master.html:967 add: `[data-accent="structure"] .b-back .b-rail { background: var(--fore-16); opacity: 1; }`. Verified by injection on both grounds: the days-back rail returns to rgba(17,17,17,0.16) on paper and rgba(255,255,255,0.16) on ink, and the forward rail on owner-flight is untouched at rgb(79,70,229)/0.5. Gate it by ass


Refute if: it is factually wrong about the frames or the code; it is already handled; it would violate a non-negotiable constraint; it is taste stated as a defect with no argument; the fix would make the work worse; or it restates something the gates already prove. Confirm only if real, specific, and an improvement at a 9.5 bar. Echo the finding id back exactly so the verdict can be matched to its finding.

Return ONLY a JSON object matching:
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "id",
    "real",
    "reason"
  ],
  "properties": {
    "id": {
      "type": "string"
    },
    "real": {
      "type": "boolean"
    },
    "reason": {
      "type": "string"
    },
    "sharpenedFix": {
      "type": "string"
    }
  }
}
