Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=taking-the-link-never-makes-the-plan-theirs
Seat: ux
Element: states.publish copy handler (render-b.js:1810-1827) against the dead copy branch in wireOwner (render-b.js:1270-1288); the owner bar's verb and the "Only you can see this" status line
Problem: Driven end to end on BOTH grounds with a stubbed clipboard: owner-empty, type "3 October 2026", Set the day, Add a moment, name it, Escape, Publish, Copy the link (the URL genuinely reaches the clipboard), Back to the plan. The plan still reads "Only you can see this", the primary verb is still "Publish", and pressing it again lands on "Send it to Aisling & Tom." Identical from state=owner-draft, on paper and on ink. The product's own model is written into the code -- "Taking the link IS the publish in this model, so the verb, the status line and the press heading flip once, together, at the moment it becomes someone else's" -- but that branch lives in wireOwner, which is only wired onto ownerSurface, and the owner surface carries no [data-act=copy] control. The only Copy the link button in the product is on states.publish, whose own handler sets "Copied" / "Link copied." and never touches F.publication. So no plan built through this product ever leaves draft: "Live since 15 July - anyone with the link can read it", the "Get the link" verb and "Mara & Finn have had this since 15 July." are reachable only because the demonstration fixture is pre-seeded as published. The one question the owner of a wedding actually asks this screen -- have they got it yet -- is answered "Only you can see this" forever, and the reassurance "You can turn the link off at any time" promises an on/off state the product never enters. This is not round 8's publish-contradicts-its-own-headline (a published plan offering "Publish"); it is the inverse, and round 9's draft-branch-restored-before-it-is-used drove this exact path but stopped one press short of Copy.
Proposed fix: Extract the flip into one function used by both handlers: takeTheLink() { if (F.publication.state !== "published") { F.publication = { state: "published", publishedAt: F.today }; F.updatedLabel = F.fmt.medium(F.today) + " " + F.fmt.year(F.today); } }. Call it from the success path of states.publish's writeText, then rewrite the press heading from the same accessor that built it (F.publication.state === "published" ? name + " have had this since " + F.fmt.medium(F.publication.publishedAt) + "." : "Send it to " + name + ".") so the screen the owner is standing on changes under them, and let paintPublication pick the rest up when go("owner-flight") remounts. Delete the now-duplicated dead branch in wireOwner. A correction, not an architectural change: about twenty lines, no new state and no new string.

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

--- brand · taking-the-link-leaves-the-plan-saying-nobody-has-it (cost 0.4)
Driven at 1440x960 with clipboard permission granted, from state=owner-draft: press Publish, press Copy the link (the live token is verifiably on the clipboard — readText returns https://timeline.signalstudio.ie/s/j7Qm2...), press Back to the plan. The plan then says "Only you can see this" and the primary control still says "Publish". The owner has just put a working link into a message and the surface asserts nobody can see it, while offering to do a thing already done. The code states the intended model verbatim at render-b.js:1268 — "Taking the link IS the publish in this model, so the ver
Proposed fix: In the copy success callback of states.publish (render-b.js, the navigator.clipboard.writeText(...).then branch around line 1815), before setting action.textContent = "Copied", add: if (F.publication.state !== "published") { F.publication = { state: "published", publishedAt: F.today }; F.updatedLabel = F.fmt.medium(F.today) + " " + F.fmt.year(F.today); var head = node.querySelector(".b-pressTitle"


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
