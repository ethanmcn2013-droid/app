Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=display-tier-frozen-against-the-readers-text-size
Seat: type
Element: The five display steps of the size ladder — --size-titleWide, --size-figure, --size-card, --size-count, --size-countWide (shell.css:129-134) — plus the hard-px lanes .b-measureHead (width:76px / 84px, b.css:142 and :1372) and .b-behindDate (width:96px, b.css:499)
Problem: Eight of the thirteen size steps are rem and five are px, and the file says why: 'a rem count at a 24px root clips the day, the sheet and the phone'. That reason is measurably true of a naive rem swap — I applied it and the day word overflows its column by 36px at 390 and the count block by 65px at 1440. But the freeze it bought has a cost nobody measured, and the cost is the design's own thesis. Driving with CDP Page.setFontSizes at standard 16/18/20/22/24, identical in both rooms: the reading tier scales and the display tier does not, so the ratio the whole page rests on collapses. On the phone the count against the moment title goes 96:17 = 5.65 at the default to 96:25.5 = 3.76 at a 24px root, a third of the step gone; the count against the ceremonial date goes 4.80 to 3.20 and the date line, at 1440, breaks to two lines and out-inks the numeral beside it. On publish the headline against its own body paragraph goes 48:17 = 2.82 to 48:25.5 = 1.88 — at 1.88 it is no longer a headline, it is a slightly larger line. In the unfurl card, the object the file itself calls the product's first impression inside a message, the figure against its caption goes 64:15 = 4.27 to 64:22.5 = 2.84, and the caption breaks from one line to two while the figure does not move. This is not a fringe axis for this audience: the plan is opened once, on a phone, by the couple's families, and enlarged system text is what that population sets. It is also invisible to both gates — audit.mjs and interaction-check.mjs read a 16px root only, and neither ever calls setFontSizes. Alongside the ramp, seven classes begin overflowing their boxes above the default that do not overflow at it: .b-measureHead spills its 76px lane by 9px at root 18, 18px at 20 and 37px at 24 — its string measures 76.0px at the default, zero slack in a hard-px lane holding a rem string — .b-behindDate spills 10px at 24, .b-unfurlTitle at 20 and above, .b-when in the print sheet at 20 and above.
Proposed fix: Put the display tier back on the reader's root with a measured ceiling instead of freezing it, in shell.css:129-134: --size-titleWide: clamp(38px, 2.375rem, 48px); --size-figure: clamp(48px, 3rem, 60px); --size-card: clamp(64px, 4rem, 80px); --size-count: clamp(96px, 6rem, 120px); --size-countWide: clamp(148px, 9.25rem, 180px). At a 16px root every value is byte-identical to today's, so nothing moves for the default reader and neither gate changes. The one object the freeze was protecting is .b-dayCount — it is letters, not figures, it never steps to countWide, and 'Today' already measures the full 350px column at 390 — so pin it off the token with an explicit .b-dayCount { font-size: 96px } at b.css:1181, and extend the comment above it to say it is pinned because it is the one display object already at its column width. I drove that exact CSS at root 16/20/24, across 12 states, 7 widths from 320 to 1440, in both rooms: no count, day word, empty headline, publish headline or unfurl figure overflows its box or the page at any combination. Then release the two hard-px lanes that hold rem strings: .b-measureHead { width: auto; min-width: 76px } (and min-width: 84px in place of width: 84px at b.css:1372) and .b-behindRow > .b-behindDate { width: auto; min-width: 96px } — min-width keeps today's right-aligned column against the .b-away figures at the default and lets the label grow with the reader instead of hanging out of its lane. Finally add one assertion to interaction-check.mjs that opens owner-flight and publish through CDP Page.setFontSizes at standard:24 and asserts the count-to-title and headline-to-body ratios stay within 10% of their 16px values; the ladder is the one thing on this surface with no gate on the axis a reader actually controls.

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
