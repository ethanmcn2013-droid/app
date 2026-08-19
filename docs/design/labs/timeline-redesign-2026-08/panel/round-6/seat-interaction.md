You are the Interaction and states seat on an independent design review panel. Round 3.

YOUR LENS
Hover, focus, active, selected, drag, empty, loading, dense. Affordance at rest. Reflow on hover. Discoverability of reveal-on-hover controls. Keyboard model and focus order. What the loading frame promises versus what arrives.

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
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-publish--1440x960.png    publish
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-phone--1440x960.png    phone
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-desk--1440x960.png    desk
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-day--1440x960.png    day
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-print--1440x960.png    print
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-unfurl--1440x960.png    unfurl
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-ended--1440x960.png    ended
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-loading--1440x960.png    loading
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-owner-flight--390x844.png    owner-flight at 390x844
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-owner-flight--768x1024.png    owner-flight at 768x1024
C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\shots\approach-owner-flight--1280x900.png    owner-flight at 1280x900
Source: C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\master.html

GRADE BY DRIVING, NOT ONLY BY READING FRAMES. Open the master in Playwright
(chromium; import { chromium } from "@playwright/test") at
file://C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\master.html?v=approach&state=<state> and operate it:
tab through everything, press what looks pressable, exercise the keyboard
model end to end, resize across 390/768/1280/1440, and watch what every
repaint does to scroll position and focus.

Say plainly what this is: name the score, name what earned it, and name what
still stands between it and 9.5 in terms a founder can act on — is what
remains polish, a build, or a different decision, and roughly how big. Do not
inflate to be kind and do not deflate to look rigorous.

Return ONLY a JSON object matching:
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "seat",
    "score",
    "findings",
    "biggestWin"
  ],
  "properties": {
    "seat": {
      "type": "string"
    },
    "score": {
      "type": "number"
    },
    "findings": {
      "type": "array",
      "minItems": 3,
      "maxItems": 5,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "id",
          "element",
          "problem",
          "fix",
          "cost"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "a short kebab-case slug naming this defect"
          },
          "element": {
            "type": "string"
          },
          "problem": {
            "type": "string"
          },
          "fix": {
            "type": "string",
            "description": "implementable exactly as written"
          },
          "cost": {
            "type": "number"
          }
        }
      }
    },
    "biggestWin": {
      "type": "string"
    }
  }
}

Score to one decimal. 3 to 5 findings, each with a short kebab-case id and a
cost in tenths. Do not hedge, do not give credit for effort, and do not
guess at any other seat's opinion. Write the JSON to C:\Users\ethan\signal-studio-workspace\_wt-timeline-redesign\docs\design\labs\timeline-redesign-2026-08\panel\round-6\seat-interaction.json.

ROUND-SPECIFIC NOTES (round 6)
Round 5 scored 7.8 at the floor (UI composition). Every seat now sits between
7.8 and 8.4 — the spread is six tenths, so the work is converging and the
remaining distance is specific rather than general. Twenty-four findings were
confirmed and fixed, eleven refuted.

Fixed since you last saw it — drive it before re-reporting any of it: the
keepsake is a real A4 page (a @page rule, a print media block that takes the
lab's furniture and its stage padding off the paper, the past moved into the
left column, eight pixels a day, break-inside on every row) and the gate now
renders the actual PDF and counts its pages; the sheet dates its own figure
("days away on 16 July 2026") and states today once; the printed and on-screen
links are readable rather than clipped; type size joins ink, leading, tracking,
space and motion as a declared role-named ladder, and size and space are both
enforced AT THE SOURCE; leading and tracking are graded across the whole state
matrix; the past rail says "days back" in the words a screen reader hears; the
past has one name on every surface; today is one mark across the 701–1279 band;
focus is followed out from behind the docked sheet; the first run has a second
frame; the pinned column names where the plan is now; no sentence ends on one
word. The language is named and written down: LANGUAGE.md.

Two things were adjudicated and are NOT open unless you can overturn them with
evidence: (1) whether the wedding morning should carry a running order — the
fixture has no time and no place field, inventing them is forbidden, and a
refuter ruled it a founder decision about the data model, not a design defect;
(2) a QR code on the keepsake was endorsed by a refuter but deliberately NOT
shipped, because a QR that does not scan is worse than none and it cannot be
verified offline here. Both are recorded as open in the round report.

This round, do two things:
- Name, in one sentence in your biggestWin, THE SINGLE THING that holds your
  own seat below 9.5. Be specific enough to build from.
- Then spend your findings on it and on whatever else you can still prove.

Deliberate decisions, so argue with them rather than reporting them as
oversights:
- Scale is a page-size decision: 14/18 pixels a day for the owner, 12 or 14 for
  guests, 8 on paper, 2 for the past on the morning. The proportion between one
  gap and the next is identical at every scale.
- The editor is docked, not modal: no scrim, no scroll lock, no focus trap.
- The reversibility bar is one node that travels, silent until it has something
  true to say, and it restores the view as well as the data.
- Where the past folds it is one sentence and a disclosure; where it is listed
  there is no control at all.
- Nothing on a guest surface animates. Four motion proposals have been refuted.
- Anything not built has no button element. Inert text is deliberate.
