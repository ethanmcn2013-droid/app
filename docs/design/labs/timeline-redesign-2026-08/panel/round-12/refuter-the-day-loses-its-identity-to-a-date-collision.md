Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=the-day-loses-its-identity-to-a-date-collision
Seat: ux
Element: theDayRecord() / isTheDay() — render-b.js:163-172; consumed by row()'s data-anchor (:180), setTitle() (:871) and editor()'s theDay (:916)
Problem: The single object the whole composition is measured from is identified by scanning F.milestones for the FIRST record whose date equals F.project.primaryDate.date — a date match alone, which the function's own comment says it never does ('never by a date match alone, which any second moment on the day would also satisfy'). The project record carries no id, so the date scan is the only path and array order decides which moment becomes the wedding. Two gestures the product explicitly supports break it. Driven at 390x844 and 1440x960, v=paper AND v=ink, from state=owner-flight: open 'Send the invitations', type '3 October 2026' — accepted, with the product's own bespoke note 'This is as far as it goes. Nothing can sit after the day itself.' — then rename it 'Post the invitations', Done, Preview, Back. Result, identical on both grounds: the guest's phone header reads '79 / days / Saturday 3 October 2026 / Post the invitations'. That .b-sub string is the one the unfurl card and the printed sheet also read, so the wedding is named after an errand everywhere it is sent. data-anchor — the mark that makes the day the day on the measure — has moved to 'Post the invitations', and 'Wedding day' is now an ordinary row. Opening 'Wedding day' gives aria-label 'Editing Wedding day' with 'Delete this moment' and Shown/Hidden present; baseline on the untouched fixture is 'Editing the day itself', no delete, no visibility. I pressed it: the wedding day is gone from its own plan and the horizon still counts 79 days to 'Post the invitations'. Multi-moment days are neither exotic nor unanticipated — states.day carries a plural branch ('Happening today' when todayItems.length > 1) written for exactly this case, and commitDate has a bespoke sentence for landing exactly on the day. The behaviour gate has six assertions guarding this precise property — interaction-check.mjs:2971-2975 ('exactly one row is the day', 'the day cannot be hidden from guests', 'the day cannot be deleted as a moment', 'the day's editor says what it is'), :2994 ('renaming the day renames it everywhere') and :352 ('exactly one item is the day itself') — and every one runs on the untouched fixture, where nothing else sits on 3 October. Six passing assertions proving nothing about the state one legal move away.

SECOND FRAMING, from another seat, ruled on by this same verdict:
[also filed by brand at 0.4] theDayRecord() (render-b.js:163) identifies the day by matching a milestone's date against F.project.primaryDate.date, and setAway() (render-b.js:727) writes record.date without ever writing F.project.primaryDate.date. So one press of a stepper in the day's own editor severs the day from the project, and every string built on that identity goes false while staying on screen. Driven at 1440 on ?v=paper&state=owner-flight, opening the row aria-labelled 'Edit Wedding day' (the editor names itself 'Editing the day itself' and carries the standing note 'Everything on this plan is measured from this day'), then one press of the minus-one stepper: the row becomes 'Wedding day / Fri 2 Oct', the undo bar says 'Wedding day moved 1 day earlier.', and the horizon four hundred pixels away still reads '79 / days / Saturday 3 October 2026 / Wedding day' - the largest type on the surface naming a date the plan no longer contains. Three further strings fall with it. (a) Reopening that row now says 'Editing Wedding day', not 'Editing the day itself', and the panel now offers 'Shown / Hidden' and 'Delete this moment' on the day itself - the exact controls render-b.js:1065 exists to withhold ('Hiding it would hide the thing every figure on the page is measured from'). (b) Renaming it now leaves the horizon on the old name: setTitle()'s isTheDay branch (render-b.js:866), written precisely so 'the row and the horizon carry two names for one day' cannot happen, no longer fires - measured 'Our wedding' on the row and in the undo bar against 'Wedding day' on the horizon in the same frame. (c) The ceiling is still computed from F.project.primaryDate.date, so with the day on 2 October another moment can be typed to 3 October and is accepted with no refusal, landing last in the measure, while the sentence the same field prints one press earlier still says 'Nothing can sit after the day itself.' The same sequence with no prior move renames correctly, which is what isolates the date-match as the cause.
Proposed fix: Resolve the day by id, never by date. (1) fixture.js: give the project the id it already has — project.primaryDate becomes { label: 'Wedding day', date: '2026-10-03', id: 'demo-audience-item-wedding' }. (2) render-b.js:163, theDayRecord() becomes: function theDayRecord() { var pinned = F.project.primaryDate.id && recordFor(F.project.primaryDate.id); if (pinned && pinned.date === F.project.primaryDate.date) return pinned; for (var i = 0; i < F.milestones.length; i++) { if (F.milestones[i].date === F.project.primaryDate.date) { F.project.primaryDate.id = F.milestones[i].id; return F.milestones[i]; } } return null; } — the date scan survives only as the one-time seeder for a project whose day has no milestone yet (states['owner-empty'] mints primaryDate with id: null and the synthesised day row at :241 still renders), and it stamps the id the first time it runs, so a later arrival can never take it. (3) Write the gate assertion first and watch it fail: from owner-flight move a spare moment onto the day, remount, then assert document.querySelectorAll('.b-item[data-anchor]') is exactly the wedding id; that its editor reads aria-label 'Editing the day itself' with no [data-act="delete"] and no .b-seg; that the moved row's editor reads 'Editing <its own name>' WITH both; and that renaming the moved row leaves F.project.primaryDate.label unchanged at 'Wedding day'. Run it on both grounds.

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
# Round 12 · what you are grading

## Two rooms, and only two

The founder has picked the configuration that ships. Everything else has
been deleted from the master.

- `?v=paper` — **the room as it ships.** Ink on white, the past folded to
  a line, indigo spent on the next thing AND on the rail that is still
  ahead.
- `?v=ink` — **the same four decisions with the ground flipped** through
  the declared fore/back ladder. Not a theme laid over the work: the same
  room read at night, for a reader whose system is set to dark.

Grade both. A fix that lands in one room and not the other is itself a
defect, and this panel has found that class twice — a rail alpha that
survived only on paper, and a focus-ring token that painted white on
white in the ink room. The two ladders do not permit the same values:
over paper, ink at 0.62 is the floor for type; over ink, paper at 0.46 is
the floor. A rule written against a literal white or a literal ink,
rather than against the ladder, is the shape both of those took.

Print forces the paper ground by design. That is not a defect.

## There is no finding quota

Report only the defects you actually found. **None, or up to five.** An
empty findings array is a valid and expected answer for a finished
surface.

This is not a formality. For nine rounds the seat schema required a
minimum of three findings each, so seven seats produced 33 to 35 findings
every round whether or not 33 defects existed — and because the gate is
the LOWEST seat, the floor measured the quota rather than the work.
Removing it moved the floor 7.2 → 8.6 → 9.1 in two rounds.

## Where it stands

| | Round 10 | Round 11 |
|---|---|---|
| Floor | 8.6 | **9.1** |
| Ceiling | 9.2 | **9.4** |
| Spread | 0.6 | **0.3** |
| Findings | 22 | **13** |
| Refuted | 2 | **0** |

Every seat rose in round 10. Every seat rose again in round 11. Thirteen
findings were filed and **not one was refuted** — eight met a refuter at
0.2 and above and all eight came back REAL on measurement, several
reproducing the seat's own figures to two decimal places.

Read that as the bar you are being held to. The panel is no longer
finding things by looking harder in the same places; it is finding the
last few by looking somewhere nobody has looked. The remaining distance
is 0.4 on the floor. A finding has to be worth its place.

## Read the settled ledger first

`panel/SETTLED.md` — **59 findings already raised and killed**, each with
the measured reason it died. A finding matching one of them is discarded
before a refuter is ever spent on it, unless it brings new evidence that
meets the stated objection.

Three items were raised in three consecutive rounds each and refuted every
time; they are closed: the editor's reserved band, the desk editor's foot
below the fold, and an arrival animation for the audience.

## Fixed in round 11 — do not re-report these

- The editor's undo band no longer paints over the first field's name.
  The reserve was hand-measured in the docked sheet; the shipping room is
  the 344px rail, where the same bar took three rows. The bar now sets as
  **one paragraph** — the action follows the last word — so it is 64px in
  either column, the label keeps 22 to 24px of air at every width, and
  the steppers hold at zero. A title long enough to take the sentence to
  four lines shortens the NAME rather than clipping the plate, because
  clipping would have hidden the Undo control itself.
- A day carrying three or more moments no longer deletes the date line of
  the row above. Each crowded plate paints an opaque 12px halo outside its
  own box; a stacked follower now carries the bottom padding the lead
  always had.
- The focus ring on the chat plate follows the LOCAL ground, not the
  room's. The plate is somebody else's white surface in both rooms, so
  the ink room's white ring was painting white on white at 1.00:1 — on
  the unfurl screen, where that card is the only focusable element there
  is.
- The artifact frame (`.tl-device`, `.tl-paperEdge`) is laddered, not
  literal. Its alpha edge used to composite over its own hard-white box,
  which made the bezel the loudest line in the ink room at 13.4:1 against
  an indigo rail at 3.0. It is now 1.59:1 on both grounds.
- A forced palette no longer flattens the loading frame's four slabs or
  the open editor's plate. Both carried their meaning by translucency and
  repainted Canvas-on-Canvas.
- The freshness stamp moves for every change an owner can make, not one
  in six. It is the only string that dates the plan for a guest.
- The publish headline no longer claims possession at the instant of
  publishing, and the live region no longer says the recipients can open
  it "now" when nothing has been sent.
- The printed sheet carries a scannable route as well as the typed URL,
  generated at build time from the same token. Still one A4 page.
- The date readout sets as two lines instead of one sentence whose
  separator ended line one alone in white space.
- An empty date field is refused as an empty field, not as an unreadable
  date; the over-ceiling refusal no longer shares its words with the note
  the panel writes when a date IS accepted at the limit.
- The three typing fields meet the 44px thumb floor on a coarse pointer.
- The badge on an open row hands focus to the panel it names instead of
  refusing the press while still announcing `aria-expanded="true"`.

## One item is open, and it is a build, not a regression

**The owner cannot edit a moment once it has passed.** It is on the
founder's list. Reporting it again costs a refuter and tells us nothing.

## The structure is frozen

The lock's decisions — position as `daysFromToday × pixels-per-day`, the
day as a horizon, the past folded, ground as a named decision — are not
open. A finding that amounts to restructuring goes on a build list for
the founder to schedule; it is not this round's work. Findings that
amount to "add a colour", "add a weight" or "restructure the locked
architecture" are out of scope and will be discarded.

## Both gates pass, on both grounds

- `audit.mjs` — **0 across fifteen categories**, for paper and for ink.
- `interaction-check.mjs` — **787 assertions, 0 failing**, up from 644.

Read the behaviour gate. Everything it asserts is already proven, and a
finding that restates one of its assertions is worthless.

But read it sceptically too. Three of this round's own new assertions
were caught proving nothing before they were trusted, and one STANDING
assertion — "the refusal says why" — had been passing for rounds on the
exact ambiguity round 11 finally found: it checked the refusal for the
words the panel writes when a date *is* accepted. **A passing assertion
that proves nothing is a real finding.**

One structural lesson worth carrying: a forced palette is applied by the
compositor, and `getComputedStyle` still reports what the author wrote.
Any check phrased against declared values passes while the screen is
blank. The new assertions read painted pixels. Anywhere else the gate
still reads computed style to judge what is PAINTED, it is lying.

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
