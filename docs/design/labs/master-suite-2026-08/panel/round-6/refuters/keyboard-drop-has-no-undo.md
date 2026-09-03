Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=keyboard-drop-has-no-undo
Seat: interaction
Element: .card[data-id] Space-to-drop branch of onKey() — _gate-suite.html:14304-14324 (compare the pointer drop at _gate-suite.html:15114 and the move menu at _gate-suite.html:14887, which both call arm({kind:"move"}))
Problem: Driven at 1440 on tasks.board: focus a card, Space ("Picked up Confirm marquee sides with the hire company."), ArrowRight ArrowRight, Space. The board says "...dropped in the review column." Ctrl+Z then answers "Nothing left to undo." and the card stays in Review. The identical move by mouse drag answers "...is back in the to do column.", and the same move through the card's Move menu is undoable too. Only the keyboard-carry drop fails to arm, because the Space branch of onKey mutates the lane and never calls arm(). Escape covers the card only while it is still in hand; once Space commits, the keyboard route is the one route to the board's most frequent structural act with no way back. The card advertises aria-roledescription="Movable task" and aria-keyshortcuts="Space ArrowUp ArrowDown ArrowLeft ArrowRight", so this is precisely the promise the surface makes to the operator who cannot drag. A keyboard drop into Done IS undoable, because completed() arms — which is why the gap survives anyone who only tests the completion.
Proposed fix: In the Space-to-drop branch of onKey, before the mutation read `const heldWas = task.heldSince, doneWas = task.completedAt;`, then in the non-Done branch replace the bare `say(task.title + " dropped " + inLane(lane) + ".")` with `arm({ kind: "move", id: id, title: task.title, lane: carriedFrom.lane, index: carriedFrom.index, toLane: lane, wasHeldSince: heldWas, wasCompletedAt: doneWas }); say(task.title + " dropped " + inLane(lane) + ". Press " + keycap("Z") + " to undo.");` — runUndo's default branch already restores lane, index, heldSince and completedAt, so no new undo kind is needed. Add to interaction-check.mjs: carry a card two lanes by keyboard, drop with Space, press Ctrl+Z, require the card back in its original lane and the sentence to say so.

Score against this standard: the work of an award-winning design studio that
iterated on this product for months. 10 is that studio's best shipped work.
Benchmarks to hold it against, by name: Linear, Stripe, Vercel, xAI/Grok,
SpaceX. Score the ARTIFACT, not the effort. A polite 8 that should be a 6
makes the panel worthless.

WHAT YOU ARE REVIEWING
Signal Studio, as it would look in production: **Notes, Tasks and Timeline as one
running application** — one ink floor, one white sheet, one floating capsule spine
between them, and one world of data underneath all three. It is not a document about
three products; it is the three products, live, with the walls taken out. A person
captures a note, peels the words that matter off it, sends them to Tasks, watches the
card land in the lane the seam chose, and looks at the Timeline to see how far off the
day is. The single job the whole surface does is: **make a season of work legible to
one person who has to run it.**

The three products arrive here having each survived twelve to nineteen rounds of
adversarial review as standalone surfaces. What has never been reviewed is them being
one thing.
The audience: Orla, the venue manager at The Orchard — she runs weddings and events for a living, has.

CONSTRAINTS THAT ARE NOT NEGOTIABLE (do not propose breaking these):
- Palette is exactly 11 colours: Ink #111111, Indigo #4f46e5, White #ffffff, Indigo deep #4338ca, Status amber #a16207, Status orange #c2410c, Status green #15803d, Status yellow #eab308, Status orange bright #f97316, Status green bright #22c55e, Indigo on ink #a5b4fc, plus tints of those at
  stated alpha. NO other hue may be introduced. Status and hierarchy are
  expressed by ink density, weight and fill, not by colour.
- Type is Geist and Geist Mono at weights 400 and 600 only.
- The locked architecture:
  - **The Studio Floor architecture.** An ink floor the whole app sits on — not a frame
    drawn around it. One white sheet lifted off it. The spine off the wall: a floating
    capsule carrying the suite, pointing at the sheet it opened. The dock at the foot.
    Identity on the sheet's own head. On a phone the capsule and the dock are the same
    object.
  - **Tasks · Direction C, Studio Floor**, at the founder's locked configuration:
    elevated cards, soft radius, comfortable density, subtle indigo, calm type.
  - **Notes · Direction C, The Stack**: two planes with depth between them, a desk above
    carrying the newest paper, an index below, reading lifts a note onto the desk,
    dictating takes the floor to ink, the seam peels a second smaller sheet off the note.
  - **Timeline · Direction B, The Approach**: the organising object is a distance, not a
    list; the day is a horizon that never moves; the past is behind you; position on the
    measure is `daysFromToday × pixels-per-day` computed from real dates.
  - **The suite is one application.** One rail, rendered once. Three products mounted at
    once, none ever torn down, so nothing a person was doing is lost when they glance at
    another.
- Protected objects (polish, never redesign):
  - **The seam.** Notes → peel → send → a card on the Tasks board in the lane the seam
    chose → `open-task` reveals it → undo removes it from both. This is the whole
    argument for a suite existing. Polish it; do not redesign the gesture.
  - **Honest doors.** Home, Inbox, Help, More and the account tile are present,
    reachable, in the tab order, and say plainly that they are not here yet. That is a
    designed answer, not a gap. **A finding that says "build a Home screen" is out of
    scope.** A finding that says the sentence on one of those doors is wrong is in.
  - **One clock, one cast, one venue.** The fixture asserts it. Do not propose data.
Findings that amount to "add a colour", "add a weight" or "restructure the
locked architecture" are out of scope and will be discarded.
Also out of scope for this engagement:
- Building Home, Inbox, Help, More, or an account surface.
- A fourth colour, a third weight, a fourth typeface.
- Data-model changes: a moment has no time of day, a task has no created-at, and
  neither is this engagement's problem.
- The port into `src/`. This is a lab artefact; `references/handover.md` governs the
  port and it is not this engagement's job.
- Re-litigating the three direction picks. Direction C, C and B are the founder's.

MEASURED BASELINE. Two automated gates guard this master and both pass:
- /home/user/_wt-timeline-redesign/.claude/skills/elevate/scripts/audit.mjs --lab=/home/user/app/docs/design/labs/master-suite-2026-08
  (palette lock, weights, families, WCAG AA contrast against the real
  composited backdrop, hit targets, radii, motion, type ramp, leading)
- /home/user/app/docs/design/labs/master-suite-2026-08/interaction-check.mjs
READ the behaviour gate. Everything it asserts is already proven; a finding
that restates one of those assertions is worthless and will be refuted on
sight. Spend your findings on what automation cannot see.

Before scoring, also read the paid-for defect library at
/home/user/_wt-timeline-redesign/.claude/skills/elevate/references/lessons.md — those classes have
been found and fixed once already; check whether they are creeping back,
and spend the rest of your attention past them.

FRAMES (read the images):
/home/user/app/docs/design/labs/master-suite-2026-08/shots/paper-tasks.board--1920x1000.png    tasks.board
/home/user/app/docs/design/labs/master-suite-2026-08/shots/paper-tasks.dense--1920x1000.png    tasks.dense
/home/user/app/docs/design/labs/master-suite-2026-08/shots/paper-notes.notebook--1920x1000.png    notes.notebook
/home/user/app/docs/design/labs/master-suite-2026-08/shots/paper-notes.seam--1920x1000.png    notes.seam
/home/user/app/docs/design/labs/master-suite-2026-08/shots/paper-notes.review--1920x1000.png    notes.review
/home/user/app/docs/design/labs/master-suite-2026-08/shots/paper-notes.voice--1920x1000.png    notes.voice
/home/user/app/docs/design/labs/master-suite-2026-08/shots/paper-timeline.owner-flight--1920x1000.png    timeline.owner-flight
/home/user/app/docs/design/labs/master-suite-2026-08/shots/paper-timeline.desk--1920x1000.png    timeline.desk
/home/user/app/docs/design/labs/master-suite-2026-08/shots/paper-timeline.phone--1920x1000.png    timeline.phone
/home/user/app/docs/design/labs/master-suite-2026-08/shots/paper-tasks.board--390x844.png    tasks.board at 390x844
/home/user/app/docs/design/labs/master-suite-2026-08/shots/paper-tasks.board--768x1024.png    tasks.board at 768x1024
/home/user/app/docs/design/labs/master-suite-2026-08/shots/paper-tasks.board--1280x900.png    tasks.board at 1280x900
/home/user/app/docs/design/labs/master-suite-2026-08/shots/paper-tasks.board--1440x960.png    tasks.board at 1440x960
Source: /home/user/app/docs/design/labs/master-suite-2026-08/_gate-suite.html

GRADE BY DRIVING, NOT ONLY BY READING FRAMES. Open the master in Playwright
(chromium; import { chromium } from "@playwright/test") at
file:///home/user/app/docs/design/labs/master-suite-2026-08/_gate-suite.html?v=paper&state=<state> and operate it:
tab through everything, press what looks pressable, exercise the keyboard
model end to end, resize across 390/768/1280/1440/1920, and watch what every
repaint does to scroll position and focus.
Everything is driven against the wrapped copy, which is what `verify.mjs` and
`tools/wrap.mjs` produce:

```
docs/design/labs/master-suite-2026-08/_gate-suite.html?state=<product>.<state>
                                                      &v=paper|ink
                                                      &layout=across|down
```

- **The spine**: `.rail [data-rail="notes|tasks|timeline"]` — click or Enter. Arrows
  walk it (down/up at desk, left/right at ≤720). It never rebuilds a product.
- **Tasks**: cards are draggable and keyboard-carryable (Space picks up, arrows walk,
  Enter drops). The tick completes. `Ctrl/⌘Z` undoes. Press a card body to open its
  note. The chips in the head filter.
- **Notes**: type in `.topField`. Click an index row to lift it onto the desk. Select
  words in `.readBody`, then `[data-act="peel"]`, then `[data-act="send"]`. `Ctrl/⌘K`
  searches. The suite tiles live in the dock at ≤720.
- **Timeline**: `[data-layout-to="across"|"down"]` on the measure's head switches
  orientation. `.b-grab` opens a moment's editor; the steppers move it on the measure.
  `Ctrl/⌘Z` undoes.
- **Grade by driving.** Frames hide exactly the defects that cost most — a live region
  that never announces, a repaint that loses your place, a keyboard model advertised
  and not implemented.

ROUND NOTES
This is the first round on a FROZEN surface: the build you are driving is commit
8c6d4380 and it does not change while you sit. Rounds 4 and 5 ran 86% and 79%
self-inflicted because building continued between them; this one cannot.

What is new since round 5 — the 2 September ledger, 33 findings closed by decision
(the long form is COMPOSITION.md § "The 2 September ledger, closed"):

- Tasks: below 1100 the board is a LIST; on a phone the board is one lane paging
  sideways at 86%. Filter, Sort and Display are one word, Show, with the live count
  on its face while shut. A ticked row holds its slot until the undo window closes.
  The head carries a pace meter (role=meter), an overdue chip and the undated door,
  and no count. The phone head carries search as a pill; the tool panel is a bottom
  sheet on a phone. The card note is capped at five lines at 1280 and above.
- Notes: the head carries NO count — the way into review is the quiet text control
  in the index head ("8 to decide"). The stack is 1120, back from 1440. The phone
  seam opens the sheet a tap opens, with the peel out. A caret the layout takes on
  the 720 crossing is kept for one paint.
- Timeline: the horizon's gap note is silent while a moment is ahead. Add a moment is
  the primary; Preview and Get the link stand beside it at a desk and fold behind ···
  on a phone. Across is never offered on a phone. The whole row is the handle; its
  word is for the screen reader only and the title's hairline underline is the
  visible affordance.
- Suite: every closed door answers ON SCREEN ("Your account, in Signal Studio · Not
  here yet"), Settings is a real card (You, Email, Plan), and the world holds three
  of Orla's projects.

Deliberate decisions you may argue with, but must not report as oversights:
- The Notes head has no count on purpose (a tally of how far behind you are is the
  wrong loudest object on a capture surface).
- The 1120 stack overturns round 5's 1440; the reason is legibility of a row as a
  sentence, recorded.
- The timeline's gap note is EMPTY at rest by decision; "Nothing is planned yet."
  is the only sentence it carries.
- The grab handle's word is invisible by decision; the underline is the affordance.
- Doors that are not built say "Not here yet." in a card; the doors are kept because
  deleting an honest door is how a product starts lying about what it is.
- Timeline's wordmark sits lower and to the right of the other two (flagged in
  round 5, not changed — argue for or against, with the measurement).

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
