Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=moment-title-measure-collapses-at-1024
Seat: type
Element: .b-title in .b-plan, across 1024-1279px on both grounds
Problem: The moment title - the owner's own words, the largest reading-tier object on the plan - loses 45% of its measure at one pixel of window growth and never gets it back. Measured on owner-flight and desk, paper and ink, identically: the title box is 544px (22.7em at 24px) at 900, 1000 and 1023; at 1024 it is 298px (12.4em) on owner-flight and 306px on desk; it climbs 0.92px per px of window and caps at 534px, so the 544px it had at 1023 is never regained at any width up to 1920. The cause is the two-pane composition engaging at @media (min-width:1024px): .b-plan = .b-two - 344 - 56, i.e. title = window - 726 capped at 534, so at 1024 the pane hands a 24px display-tier title 12.4em of line - narrower than the 18.8em the same title gets at 768, and half the 22.7em the same surface gives it 1px earlier. This is not cosmetic: it deletes text. Driving state=owner-editing and typing 'Champagne reception on the terrace at The Orchard, then dinner' (62 chars, an ordinary wedding line), the word-safe trimmer cuts it to 'Champagne reception on the terrace at The Orchard,' at 1024 and to '...The Orchard, then' at 1080, while the identical string sets in FULL at 768, 900, 1023, 1152, 1200, 1279 and 1440. Widening the window from 1023 to 1024 removes two words from the owner's sentence. The shipped fixture's lead moment 'Menu tasting at The Orchard' - the one object indigo marks - breaks 'Menu tasting / at The Orchard' across two lines at 1024 while setting on one at 1023 and at 1152. Identical on ink (298 vs 306px, same trim, same break), so this is not a ground-specific artifact. 1152 and 1279 are both listed frames and both still sit 22% and 2% below the 544px the same element gets at 900; 1024 - iPad landscape, the commonest tablet width an audience will open this on - is not framed at all. Not covered by any settled item: tablet-band-is-the-blown-up-phone-stack was vertical scale and its refuter conceded 'the boundary mismatch is real (geometry at 701, composition at 1024)'; keepsake-loses-the-baseline-and-the-measure-floor was print baselines; stepread-never-fits-its-measure was .b-stepRead.
Proposed fix: Give the plan pane its own type step for the band in which it is a phone-width column, rather than moving any ratified geometry. Add to b.css after the @media (min-width:1024px) block:

@media (min-width: 1024px) and (max-width: 1179px) {
  [data-medium="full"] .b-plan .b-title { font-size: var(--size-lead); letter-spacing: var(--track-body); }
  [data-medium="full"] .b-plan .b-away { font-size: var(--size-body); }
}

1179 is the last width at which the pane is below the 452px measure the design already ships at 768 (title = window - 726, so 1180 -> 454px); above it the 24px step already has room and nothing changes. The title and gutter figure step back to exactly the phone pair the file already declares (--size-lead / --track-body / --lead-head, and --size-body for .b-away), so no new value enters the ladder and the tracking stays on its own size step per the file's rule 3. Verified by driving the patched master on both grounds at 1024/1080/1152/1179/1180: the 62-char title sets in full at every width with zero trims (measure 17.5em -> 26.6em, all inside the comfortable band), 'Menu tasting at The Orchard' returns to one line, and the handoff to 24px at 1180 lands at 18.9em. Two declarations, no change to the 344px rail, the 1024 two-pane, or any gate.

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
