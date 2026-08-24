Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=row-plate-crosses-the-right-margin
Seat: ui
Element: The hovered and being-edited row plate — box-shadow: 0 0 0 12px on .b-item .b-copy
Problem: The plate behind a row is painted as a 12px spread box-shadow rather than on the element, and .b-copy's right edge is exactly the page's content column: measured 370 at 390, 672 at 768, 1254 at 1440. So the plate paints to 382 / 684 / 1266 and is the only ink anywhere on the page that crosses the margin the header rule and the footer both stop on. On the left the 12px lands in the empty channel between the rail and the words and reads as intended; on the right it simply overhangs. While a moment is open that plate is the loudest object on the screen — in the 1440 owner-editing frame you can see its right edge standing proud of the rule above it — and on a phone it leaves 8px to the screen edge where every other object keeps 20. One broken edge on a page whose entire argument is measured alignment.
Proposed fix: Paint the plate on the element instead of outside it. Add to the base rule: .b-item .b-copy { padding: 12px; margin: -12px 0 -12px -12px; border-radius: 16px; } and change the three plate rules — .b-item:hover .b-copy, .b-item:focus-within .b-copy and .b-item[data-editing="true"] .b-copy — from box-shadow: 0 0 0 12px <tint> to background: <tint> alone (keep the existing background declarations and the transition). The plate then runs from 12px left of the row's words to the column's right edge — 698 to 1254 at 1440 — the words gain a 12px right gutter they do not have today, and the page keeps one right margin. Leave the [data-crowded="true"] knockout shadow as it is; that one is a knockout, not a plate.

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
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-owner-flight--1440x960.png    owner-flight
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-owner-empty--1440x960.png    owner-empty
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-owner-editing--1440x960.png    owner-editing
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-owner-undone--1440x960.png    owner-undone
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-publish--1440x960.png    publish
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-phone--1440x960.png    phone
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-desk--1440x960.png    desk
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-day--1440x960.png    day
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-print--1440x960.png    print
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-unfurl--1440x960.png    unfurl
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-ended--1440x960.png    ended
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-loading--1440x960.png    loading
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-loading-slow--1440x960.png    loading-slow
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-owner-flight--390x844.png    owner-flight at 390x844
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-owner-flight--768x1024.png    owner-flight at 768x1024
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-owner-flight--1152x800.png    owner-flight at 1152x800
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-owner-flight--1279x800.png    owner-flight at 1279x800
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-owner-flight--1280x900.png    owner-flight at 1280x900
Source: C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\master.html

GRADE BY DRIVING, NOT ONLY BY READING FRAMES. Open the master in Playwright
(chromium; import { chromium } from "@playwright/test") at
file://C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\master.html?v=approach&state=<state> and operate it:
tab through everything, press what looks pressable, exercise the keyboard
model end to end, resize across 390/768/1152/1279/1280/1440, and watch what every
repaint does to scroll position and focus.

ROUND NOTES
Round 8 notes — what changed since you last saw this, and what not to
report as an oversight.

Round 7 fixed eighteen confirmed findings. The ones most likely to look
new to you:

- The field labelled WHEN in the owner's editor is now written by
  setAway(), the single writer of an item's distance, guarded on focus.
  A confirm on an unchanged field is a deliberate no-op.
- Undo of a move no longer throws; it restores focus to the stepper and
  returns the owner to the place they were standing when they made the
  change. Rename, hide and delete now restore focus too.
- The count in the gutter travels with the words it names; only the tick
  stays on the true pixel. Where a row is crowded, a leader runs down the
  rail to say which mark belongs to which row. This is a deliberate
  answer to a real question - argue with it if you disagree, but it is a
  decision, not an oversight.
- The two-column composition now begins at 1024 rather than 1280. The
  geometry inside it is unchanged.
- The contents of the docked editing sheet are capped to a 480px measure
  below 1024.
- "Try again" on the stalled load is wired, with its own live region.
- The ended link says "This link has ended", and its tense follows the
  clock.
- The printed sheet states the ceremonial date once.
- data-spacing is GONE. The console publishes three named decisions, not
  four, because the fourth was never implemented. Do not report its
  absence as a missing feature.
- There is a THIRTEENTH state, owner-undone. It exists so the
  reversibility bar renders filled and can be graded. It is a test
  fixture for the gate as much as a screen; judge it, but know why it is
  there.

Deliberately OPEN, carried from round 6, not an oversight and not a
regression: the owner cannot edit a moment once it has passed. It is a
build, and the last rounds are the wrong place for it. Do not spend a
finding on it.

Refuted in round 7, with reasons - do not simply re-raise these unless
you have new evidence the refuter missed:
- Moving the editor's reserved band to the foot (it puts the undo bar
  off screen and behind Delete in tab order).
- Adding a type breakpoint between 391 and 766 (the real breakpoint is
  701, and the proposed sizes are off the declared ramp).
- Demoting the today rule to spend indigo elsewhere (both the rule and
  the lead tick are named, ratified uses in the lock).
- Deleting one of the two statements of today (it reintroduces the
  unanchored-time defect a prior round paid for).
- Scrolling the measure to follow a move at desk width (the steppers do
  NOT hold still under scroll; it seats Delete under a repeat-press
  point).
- Raising the edit field to the row's type (the field is a single-line
  input; it cannot show a break at any size).

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
