Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=mono-semibold-is-a-synthesised-fourth-face
Seat: type
Element: .b-switch span — the "ONE OF THREE" label in the owner's bar (b.css:643-650), on owner-flight, owner-empty, owner-editing, owner-undone, owner-draft and publish, at every width
Problem: The label is drawn with a browser-synthesised bold. .b-switch sets font-weight:600 for the project name; .b-switch span then overrides family, size, leading, tracking, case and colour and NOT weight, so the 11px uppercase mono micro-label inherits 600. fonts.css loads Geist Mono at 400 only (measured: document.fonts holds exactly Geist 400, Geist 600, Geist Mono 400), so Chromium smears the 400 outlines. That is a fourth face on a surface whose lock says "Geist 400 and 600, Geist Mono 400. Three faces, no others, no third weight" — and a synthesised face is the one thing a type system cannot ship. Rendered at 4x, a 400/600/400 probe of the same string inside the live document shows the middle line with visibly thickened, blurred stems; in situ "ONE OF THREE" is plainly heavier than "TODAY IS 16 JULY" and "NOTHING TO PREVIEW YET", which are byte-identical in family, size, tracking, case and ink at a real 400 — on owner-empty two of them sit on the same line, 900px apart. Neither gate can see it: audit.mjs checks weight in {400,600} and family in {Geist, Geist Mono} but never the PAIR, and the advance width is unchanged (100.33px at 400 and at 600, because a smear does not move a monospace advance); interaction-check's uppercase-register test (L2038) keys on fontFamily|fontSize|letterSpacing|color and omits weight, so it counts this string as the same object as the real 400 labels. Round 8's refutation of one-of-three-has-no-noun rested on exactly that claim — that this string sits in "the inert-label register that on the very same bar carries 'NOTHING TO PREVIEW YET'". At the pixel it does not.
Proposed fix: Add `font-weight: 400;` to the `.b-switch span` rule in b.css, immediately under `font-family: var(--mono);`. Nothing else moves: the string keeps its 11px, its 0.16em, its uppercase and its fore-62, no ladder changes, and the interaction-check uppercase key is unaffected because it never read weight.

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
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-owner-draft--1440x960.png    owner-draft
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
Round 9 notes — what changed, and what is settled.

New since you last saw this (round 8 fixed twelve confirmed findings):

- The owner's DESK surface is now two panes in a fixed frame. The page
  does not scroll at 1024 and above; the rail scrolls its own content
  and the plan scrolls its own. This is the lock's "the horizon never
  moves at desk width", built properly. It is a decision - argue with
  it if you disagree, but do not report it as an accident.
- A row box is no longer a pointer target; the count, the tick and the
  words inside it are. Two moments on one day used to make the earlier
  row's Edit control stop answering.
- The forced-colours map moved to the foot of b.css, where it can
  actually win. It was inert before.
- A brand-new plan renders a draft branch: "Only you can see this",
  "Publish", and today's stamp. Taking the link publishes it. There is
  a FOURTEENTH state, owner-draft, for exactly that branch.
- The reversibility bar reserves its own band when it is fixed, whether
  or not the editor is open.
- The stalled load is no longer itself a live region; it has a region
  landmark and a separate .b-live announcer. The retry reassurance is
  stated once, not twice.
- The day-is-set screen states today.
- The empty project stands on the page's own margin.
- The printed gutter figure keeps the phone step.

Deliberately OPEN, carried since round 6. Do NOT spend a finding on it:
the owner cannot edit a moment once it has passed. It is a build.

SETTLED - refuted with reasons, some more than once. Do not re-raise
without new evidence that meets the stated objection:
- The editor's reserved band at the top of the panel. Raised in three
  consecutive rounds, three different fixes, all refuted: moving it to
  the foot puts the undo bar off screen and behind Delete in tab order;
  filling it with the moment's name prints that name three times within
  250px; filling it with the date duplicates the readout below it.
- Scrolling the window to follow a move at desk width. Refuted twice.
  The pane now handles this; the window must not.
- The desk editor's foot below the fold. Refuted twice.
- Adding an arrival animation for the audience. Refuted twice against
  the direction's motion doctrine: position is animated because it
  renders a change of QUANTITY, never to decorate a state change.
- Demoting the today rule to spend indigo elsewhere. The lock names
  both the rule and the lead tick as ratified uses.
- Deleting one of the two statements of today - it reintroduces the
  unanchored-time defect a prior round paid for.
- A type breakpoint between 391 and 766: the real breakpoint is 701.
- Raising the edit field to the row's type: it is a single-line input
  and cannot show a break at any size.
- The past rail's tick knot, the loading skeleton's filled slabs, the
  cancelled row's collapsed date lane, the morning's closing sentence,
  the "one of three" wording, "Untitled moment", the printed URL's
  break, the away figure's baseline, and the stepper readout's two
  lines. All measured, all refuted.

Both gates pass: audit.mjs exits 0 across fifteen categories;
interaction-check.mjs reports 605 assertions, 0 failing.

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
