Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=draft-publishes-a-date-before-the-draft
Seat: Brand and copy
Element: owner-draft, its Publish control, and the publish screen it lands on (.b-pressTitle and the .b-live strap)
Problem: The new draft branch says "Only you can see this" and stamps "Updated 16 July 2026". Pressing its primary control, Publish, lands on a screen headed "Mara & Finn have had this since 15 July." and announces "The link is below." — the wording reserved for a plan somebody is already holding. Pressing "Back to the plan" then restores "Live since 15 July · anyone with the link can read it" and rolls the stamp back to "Updated 15 July 2026". In two clicks a plan nobody holds becomes a plan held since the day before it existed, and time runs backwards in the footer. The cause: states["owner-draft"] renders under a temporary draft record and restores the fixture's published record on the way out, so the draft half of the press heading — "Send it to Mara & Finn.", which the fresh-project path does reach and which reads correctly — never renders from the state built to show it. The gate asserts the publish VERB knows whether anyone is holding a copy; the screen that verb leads to does not.
Proposed fix: In states["owner-draft"], set F.publication = { state: "draft", publishedAt: null } and F.updatedLabel to today, and do not restore them at the end of the builder. The existing transition in the copy handler (F.publication = { state: "published", publishedAt: F.today }) then does the flip once, where it belongs. Publish from the draft lands on "Send it to Mara & Finn." with "Ready to send. The link is below."; after Copy the link the same heading becomes "Mara & Finn have had this since 16 July.", the status line becomes "Live since 16 July · anyone with the link can read it", and the stamp stays at 16 July.

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
