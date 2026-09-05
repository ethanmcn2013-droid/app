# Elevation brief · weddings · 2026-09

## Target
The weddings section of Signal Studio. Signal Studio is project management for
normal people; its core rail is Notes, Tasks and Timeline, and Weddings is the
first add-on section a person adds with the `+`. This engagement elevates what
that section contains: four destinations in the rail — Guests, Money, Seating,
The Day — and the nineteen modes beneath them, rendered on the Studio Floor (ink
floor, floating rail, one white sheet). The single job: two people run the
planning of their own wedding from these four places without being taught how.

## Audience
Two people planning their own wedding, tired, on a laptop, who have never used
project-management software and will not read a manual.

## Fixture
Nadia & Cal, marrying at Wrenfield Barn on 12 September, seven days out. 139
people invited across 74 households; 104 coming, 19 not, 16 who have not
answered; 88 of the 104 in a chair, 16 still to seat, 13 tables. £32,000
planned, £26,840 committed, £19,310 paid, £2,000 not yet funded. Every figure
derives from one object (`WED` in the master's source) so no two screens can
disagree — the panel that preceded this engagement found the prototypes doing
exactly that. Names, hotels, suppliers and jobs are real fixture rows, never
placeholder text.

## States
The nineteen modes, addressed as `<destination>-<mode>`:
- guests-list · guests-household · guests-replies · guests-sends · guests-food · guests-travel
- money-number · money-category · money-paying · money-due · money-supplier
- seating-queue · seating-room · seating-table · seating-plans · seating-check
- day-order · day-who · day-contacts

Folded: the four landing modes are also each destination's "resting" state;
there is no separate empty or loading state in scope for this round.

## Register and materials
The Signal register, exactly: Ink `#111111`, Indigo `#4f46e5`, White `#ffffff`
and tints of those three at stated alpha. Geist 400 and 600; Geist Mono 400.
Radii 4 · 6 · 8 · 12 · 16 · pill. Motion 80 / 140 / 220ms on
`cubic-bezier(0.23, 1, 0.32, 1)`, plus the 400ms rare tier, spent on named
moments only. Type ramp 10 · 11 · 12 · 13 · 14 · 15 · 18 · 22 · 28.
**Severity is ink density and fill, never hue.** Indigo marks what is live or
selected and never what is wrong. All of this is copied into
`elevate.config.json` and enforced mechanically.

## The gate
9.5, unanimous, across the seven standard seats. The gate is the lowest seat,
never an average.

## Decided — inherit, do not re-explore
- The Studio Floor shell: ink floor, floating labelled rail, one white sheet at
  16px on the floating shadow.
- The add-on is a labelled **section in the rail** — WORKSPACE, then WEDDING ·
  12 September — not a tab strip in the sheet.
- Four destinations: Guests, Money, Seating, The Day. Nineteen modes, shown as a
  segment row in the sheet head's right cell.
- Adding Weddings **seeds before it adds anything**: the plan, the jobs, the
  categories, the sends, the moments land first; the section appears second.
- **Seating opens on the list** (Still to seat), with the room as the second
  mode.
- The three panel corrections stand: shares are never drawn on the severity
  ramp; a check that could not run is never drawn as passed; the household view
  keeps the salutation, the unnamed plus-one and the part-replied state.

## Protected — elevate with a scalpel, never re-imagine
- The palette lock and the two weights. Any change must survive `audit.mjs`.
- The rail, the `+`, the picker and the seed sequence: they are the frame.
  Polish is welcome; a finding that redesigns them is out of scope.
- The IA above: four destinations, nineteen modes, their names.
- The 400ms tier stays reserved for named moments; nothing decorative moves at
  it.

## Open — the actual exploration
Directions were skipped on the founder's instruction (see `lock.md`). What is
open is everything inside the nineteen modes: composition, rhythm, density,
type, the tables and figures, every visible string, hover / focus / active /
selected states, the empty edges, the one composed phone frame beside Seating,
and the emotional register — the panel called the section "competent admin
software" and asked for the three moments the product owns to be felt.

## What binds
- The palette lock, mechanically (`elevate.config.json`).
- The Studio Floor canon: `docs/design/FLOOR_CANON.md` in this repo.
- The brand voice: plain, active, sentence case, no exclamation marks, no
  jargon; a first-time user understands the surface unaided.
- The composition floor: views were composed for the sheet the 1440 and 1280
  viewports give them and must never clip.

## What is out of scope
Home, Notes, Tasks and Timeline. The rail, the `+`, the picker and the seed as
objects (frame, not findings). Phone layouts — desktop and laptop only this
round; phone is recorded in the honest distance. The RSVP form, the wedding
website, the supplier pipeline. Persistence, backend, real data. A finding that
amounts to "add a colour", "add a weight" or "restructure the locked
architecture" is discarded on sight.

## Drive
Open `master.html?v=a&state=<state>`. The rail: `1`–`8` jump between the eight
destinations (Home, Notes, Tasks, Timeline, Guests, Money, Seating, The Day).
Within a wedding destination the mode row in the sheet head switches modes;
each button carries `aria-current`. Escape leaves the picker or the date
question. `Print place cards` is disabled while anyone is unseated or a check
is unrun. The `+` opens the picker; "Replay setup" in the rail foot re-runs the
seed — both are frame, not findings. Everything else on screen is static
content in this round; a control that does nothing is a legitimate finding.

## Delivery
Branch `design/weddings-exploration` in `ethanmcn2013-droid/app`, worktree
`worktrees/app/design-weddings-exploration`. Lab
`docs/design/labs/weddings-2026-09/`. Artifacts: "Weddings Design Console" and
"Weddings Elevation Log", republished to the same URLs after every round; the
Session Record at close. Exploration only — no PR, no merge, no app-code change.
