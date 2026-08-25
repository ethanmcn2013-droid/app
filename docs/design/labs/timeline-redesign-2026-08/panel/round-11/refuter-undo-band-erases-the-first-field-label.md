Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=undo-band-erases-the-first-field-label
Seat: ui
Element: .b-edit .b-undo over the editor's first .b-label ("What it is"), owner-flight/owner-editing, both grounds, every width from 1024 up
Problem: The editor's undo band is absolutely positioned (top:16px) against a hand-measured reserve, .b-edit { padding-top: 88px }, whose comment reads "88, measured: the bar's bottom edge sits 85px below the panel top when it wraps to two lines". That was measured in the docked sheet, where the panel is 480-514px wide and the bar is two rows. In the shipping desk layout the panel is the 344px rail column, content width 310px, and the same bar is THREE rows - the sentence takes two lines and Undo / Ctrl Z takes a third. Driven at 1440, 1280, 1152 and 1024 on both grounds: open any moment and press +7 once. The bar measures 94px, bottom lands at panel-top+110 against a reserve of 88, and because the bar is opaque (computed background rgb(255,255,255) on paper, rgb(17,17,17) on ink) it does not overlap the label, it deletes it. elementFromPoint at the label's own centre returns .b-undoAct, not .b-label. The owner is then typing into a nameless box while the WHEN field two rows down still carries its label and its air, so the panel reads as one labelled field and one orphan - and on ink the pure-black bar reads as a hole punched through the panel's fore-06 wash. The same constant fails the other way on the coarse-pointer path: at 390 the reserve is 104 and the bar is 88, so the label sits flush against the bar's hairline with 0px of air where every other label in the panel has 22. Neither gate can see it: audit.mjs grades states at rest and interaction-check.mjs asserts behaviour, and this only exists two clicks into the primary flow. It is also the exact class the paid-for library names first under Composition - "Floating objects erase what is under them... reserved in real layout, or it will eat controls at some density".
Proposed fix: Bound the bar, then reserve its real height. (1) In b.css, clamp the panel's undo sentence to two lines so the bar's height stops depending on the title's length: `.b-edit .b-undoText { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }`, keeping the full string in the bar's accessible name the way the row titles already do. (2) Replace the sheet's constant with the rail's real geometry: `[data-medium="full"] .b-editHost .b-edit { padding-top: 132px; }` - 16 top + 94 bar (two sentence lines plus the action row at 310px content width) + 22 air, the same air the empty bar leaves today - and under `@media (pointer: coarse)` raise `.b-edit { padding-top: 104px }` to 126px on the same arithmetic (16 + 88 + 22). Driven verbatim at 1440 on both grounds: bar bottom 690, label top 712, air 22px, elementFromPoint at the label returns .b-label, panel height identical between the empty and filled bar, so the stepper still never moves under the pointer - which is what the 88 was protecting. Cost of the correction, stated honestly: the resting panel's reserved band grows by 44px. That is the same band three refuters have already ruled is not a void; if the founder would rather not pay it, the alternative is a build - let the bar be the panel's first row in flow and re-anchor the panel from its bottom edge - and that is an architectural change, not this round's.

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
Round 11 notes.

THE ROOM. Two rooms are graded and nothing else:

  ?v=paper   ground PAPER · past folded · accent STRUCTURE   ← ships
  ?v=ink     ground INK   · past folded · accent STRUCTURE   ← the same
             four decisions, ground flipped. Not a theme.

Grade BOTH. A fix that lands in one room and not the other is itself a
defect — the two ink ladders do not permit the same token, and round 10
found exactly that: one accent alpha serving both grounds and surviving
on only one.

NO FINDING QUOTA. Report only what you actually found. Zero is a valid
and expected answer for a finished surface. Round 10 proved the point:
with the minimum removed the panel filed 22 instead of 33, refutation
fell from 52 per cent to 12, and every seat's score rose. Typography
filed ONE finding and scored 9.2. Do not reach for a second finding.

Where this stands. Round 10 floor 8.6, ceiling 9.2, five of seven seats
at or above 9.0. The remaining distance is small and specific, so a
finding has to be worth its place. Score honestly against 9.5 — the work
of an award-winning studio that iterated for months, against Linear,
Stripe, Vercel, xAI and SpaceX. If it deserves 9.5, say 9.5.

SETTLED — 59 items at panel/SETTLED.md. READ IT FIRST. Each was raised
by a seat and killed by a refuter with a measured reason. A finding
matching one is discarded before it reaches a refuter unless you bring
evidence that meets the stated objection.

Deliberately OPEN, carried since round 6, do NOT spend a finding on it:
the owner cannot edit a moment once it has passed. It is a build and the
founder will schedule it.

STRUCTURE IS FROZEN. If what you found needs an architectural change
rather than a correction, say so in the fix field and mark it a build —
it goes on a list for the founder rather than being made mid-round.

Fixed in round 10, so do not report as new: indigo is scoped to the
forward measure and carries a per-ground alpha; the past rail takes the
ordinary hairline; adding a moment no longer unpublishes a live plan;
taking the link publishes and rewrites the heading in place; Enter
commits in the first field; the editor's visibility label has its air
back; the pinned horizon line has ONE writer at every width; the chosen
visibility segment survives a forced palette; the unfurl card's
accessible name carries "when this was sent"; the disclosure no longer
speaks its own +/− mark; the publish strap no longer says "below"; the
loading frame draws the real today rule; the keycap names the platform's
own modifier; the forced-colours reset no longer gives the past the ring
that means "this one".

Both gates pass on BOTH grounds: audit.mjs exits 0 across fifteen
categories for paper and for ink; interaction-check.mjs reports 644
assertions, 0 failing, every one run on both grounds.

Say plainly what this is: name the score, name what earned it, and name what
still stands between it and 9.5 in terms a founder can act on — is what
remains polish, a build, or a different decision, and roughly how big. Do not
inflate to be kind and do not deflate to look rigorous.

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
