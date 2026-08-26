Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.

FINDING id=the-reversibility-sentence-cuts-mid-word
Seat: ux
Element: .b-undoText, built by briefly() — render-b.js:59-62; used at :954, :982, :1137 and :1305
Problem: briefly() is round 11's own fix for the four-line undo bar, and it trims by character count: name.slice(0, 43).replace(/[s,;:]+$/, '') + ellipsis. Two defects in one line. (a) It cuts mid-word, the first entry under Typography in the paid-for defect library ('Trim to the last whole word, keep the full string in the accessible name and tooltip'). Ordinary wedding titles run 45-52 characters and all of them break: 'Photographs with both families by the lakeside steps' announces as 'Photographs with both families by the lake… was removed.'; 'Hair and make-up for the bridesmaids at the hotel' becomes 'Hair and make-up for the bridesmaids at the…', a complete-looking phrase with the place missing. Measured at 1440x960 and 390x844 on v=paper and v=ink, identical on all four. (b) The trailing-trim character class is /[s,;:]+$/ — it holds the LETTER s, plainly meant as backslash-s. It never strips the whitespace it was written for, and it silently eats a trailing 's': the lakeside case slices to '…by the lakes' and the regex deletes that s. The bar is role="status", so the truncated string is what a screen reader hears, and after a delete it is the ONLY remaining statement of what was removed, because the row has left the screen. .b-undoText carries no data-clamp, no data-full, no title and no visually-hidden twin — I read every attribute on it at both widths on both grounds. That is why the gate's two standing trim assertions — interaction-check.mjs:432 'every trim ends on a whole word' and :439 'a trimmed string keeps its whole self in the accessibility tree' — pass: both iterate document.querySelectorAll('[data-clamp]'), which on owner-flight is exactly the seven row titles and never the one string the product truncates in JavaScript. The gate's own long-title test at :3296 uses a 99-character title and asserts only /moved 7 days later/; it never reads the half of the sentence that names the moment.

SECOND FRAMING, from another seat, ruled on by this same verdict:
[also filed by type at 0.1] Round 11 made the bar hold at 64px by shortening the moment's NAME rather than clipping the plate. It shortens it with a raw character slice: name.slice(0, 43) + '…'. Driven in both rooms at 390 and 1440, typing four realistic wedding titles into the live field and pressing a stepper, three of four cut mid-word — 'Champagne and canapés on the west terrace b… moved 7 days earlier.', 'Coach leaves the hotel for the church, plea… moved 7 days earlier.', 'Ceremony music, readings and the exchange o… moved 7 days earlier.' Identical string on paper and on ink, at 390 and at 1440; the bar measures 64px in all sixteen cases, so the reserve is not what is at stake. This is the one trim on the surface outside the product's own trim engine, and that engine is excellent: every [data-clamp] element trims to a whole word, keeps the untrimmed string in an aria-hidden twin, and re-runs on every keystroke — I drove it at 21 widths from 320 to 1600, across 12 states and both rooms, with a 100-character title, and it never broke once. interaction-check.mjs:432 and :438 assert exactly those two properties, but only over [data-clamp] on owner-flight, so the undo sentence is invisible to them. On .b-undoText, data-full is null and title is null: nothing on the page or in the accessibility tree carries the whole name, so a screen-reader user is told that a moment called 'the exchange o' moved seven days. Two smaller faults ride along in the same expression: the trailing cleanup is /[s,;:]+$/ — an unescaped \s — so it never strips the space it was written to strip, and it does strip a final letter 's', turning a name ending in 'invitations' into 'invitation…' at the boundary. This is the exact class the defect library was paid for ('Mid-word clamps… trim to the last whole word, keep the full string in the accessible name').
Proposed fix: render-b.js:59 — function briefly(record) { var name = nameOf(record); if (name.length <= 44) return name; var cut = name.slice(0, 43); var space = cut.lastIndexOf(' '); if (space >= 20) cut = cut.slice(0, space); return cut.replace(/[\s,;:]+$/, '') + '\u2026'; }. The result is never longer than today's, so the 64px band and the label's 22-24px of air are unaffected. Then bring the string inside the gate that already exists for it: in paintUndo(), when the leading part differs from nameOf(top.record), wrap the name in a span carrying data-clamp, data-full set to the whole title and aria-hidden="true", followed by the sibling span[data-clamp-full="true"] holding the full title in the visually-hidden class — the exact shape .b-title already uses, so interaction-check.mjs:432 and :439 start covering it with no new assertion written. Confirm they fail against the current code first.

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
