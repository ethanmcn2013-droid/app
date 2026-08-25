Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=ink-room-focus-ring-dies-on-the-chat-plate
Seat: interaction
Element: .b-unfurl (states publish and unfurl), ?v=ink only
Problem: The focus ring token is scoped per ground - b.css:30 gives :root --focus: var(--fore) and b.css:31 gives [data-ground="paper"] --focus: var(--accent) - but .b-chat is a messaging-app plate that is hard white in BOTH rooms. On ink the ring therefore resolves to white and paints onto white. Measured on the real composite at 1440x960 and 390x844: the ring on .b-unfurl computes rgb(255,255,255) and the pixel 6px outside it is [255,255,255] on all four sides, in publish and in unfurl. Contrast 1.00:1 - the focus indicator does not exist. The same element on paper reads indigo at 6.29:1 on all four sides. On state=unfurl this is the ONLY focusable element on the screen, so an ink-room keyboard user tabbing that state gets no indicator at all; on publish it is tab stop 2 of 4, the owner's own preview of what the couple receives. Neither gate can see it: interaction-check.mjs:118 'focus paints a visible treatment' asserts only outlineWidth > 0, and audit.mjs's composited-backdrop contrast pass grades ink, not outline colour. This is the round-10 class verbatim - one token serving both grounds and surviving on only one - recurring on a different token.
Proposed fix: In b.css, beside the .b-chat block, add one rule: `.b-chat { --focus: var(--accent); }`. The chat plate is a paper island in both rooms, so it must carry the paper ring. Driven verbatim at 1440x960 and 390x844 on both grounds and both states: .b-unfurl's ring becomes rgb(79,70,229) against the [255,255,255] plate (6.29:1) in the ink room, paper is unchanged, and every control outside the plate keeps its own ground's ring (paper rgb(17,17,17), ink rgb(255,255,255)) - nothing else moves.

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
