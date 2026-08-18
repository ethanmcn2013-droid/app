# Tasks · three directions · 2026-08

Design exploration only. Branch `design/tasks-exploration`, local, no PR, no
deploy. The chrome and navigation contract gates are knowingly not satisfied by
any of this; they get updated at lock-in, once all three products are decided.

Reference "before": `docs/design/shots/reference-2026-08/`.
Artboards: `direction-a.html` · `direction-b.html` · `direction-c.html`.
Frames: `shots/` (3 directions × 5 states × 4 viewports = 60).

Every direction is built over the real review-mode fixture — The Orchard,
events; Mara & Finn; Orla; the pinned 16 July clock — in the real Geist. The
one extension is the dense state, which peak-season fills out using the two
other couples the fixture already names (Nora & Cian, Aisling & Tom) plus the
venue's own upkeep. It is labelled as an extension wherever it appears.

---

## The brief all three answer

**The top black rail is retired.** Between them it carried five jobs: product
identity, universal search, the account menu, suite switching, and Add task.
Each direction rehouses all five, differently, and none of them drops one.

| Job | A · Ledger | B · Atelier | C · Studio Floor |
|---|---|---|---|
| Identity | the spine's head, `tasks.` turned to face down the rail | the masthead's kicker, on the paper, beside the season | the sheet's own head, the way a file names itself |
| Search | a dedicated cell in the spine with its keycap | the masthead's right cluster, with `⌘K` | the floating dock, first position |
| Account | the spine's foot (unchanged from today) | the masthead's far right | the dock's far right |
| Suite switching | three labelled tiles in the spine | four glyph tiles, name plate on hover | four glyph tiles in the floating capsule |
| Add task | the scope band's right end | the masthead's primary button | the dock's centre, the loudest thing on screen |

**The left rail stays the one spine**, and each direction argues a different
thing about what a spine is: a labelled instrument (A), a column of glyphs with
an inverted plate (B), or an object that has come off the wall (C).

---

## A · Ledger

**Thesis.** A venue's Saturday is a ledger, not a whiteboard. The card as an
object is retired: work is written in five columns of ruled lines on one
continuous white sheet, and typography carries every distinction that borders
and pills used to carry. The whole day fits without scrolling.

**Chrome.** No top rail. The spine widens 60 → 72px and absorbs everything:
the wordmark at its head in the same object the bar used to carry (Geist 600,
-0.045em, indigo full stop as the word's own `::after`), the three products as
labelled tiles, then search with its keycap, inbox, help and the account at the
foot. The page you are on is marked in **white**, not indigo, so the one indigo
moment can be spent on the board.

**What it deliberately sacrifices.**
- Drag affordance. Without card edges, "pick this up and move it" has to be
  taught by motion instead of by shape.
- Warmth. This is the most instrument-like of the three, and the least likely
  to make someone say "that's lovely".
- Room for a second line of card metadata. Long supplier names and long tags
  compete on one line.

**Where it breaks a pinned decision.**
1. **Board pass 3, decision 5 — "Card. Radius 10, hairline border, white."**
   A deletes the card. The argument: the border was not doing work a row rule
   cannot do better, and it was costing roughly a third of the vertical space
   on a board whose entire promise is that you can see the day. Everything the
   card decision protected survives — the Done token chain, priority-off-when-
   done, header-only colour, hover with no lift.
2. **"Studio bar + rail — Keep. Surgical fixes only."** Retired by this brief,
   in all three directions.

**Proposed token change (additive, named).** `--x-studio-chrome` from `#111111`
to `#0c0c0d`, so the spine reads as a material rather than as ink that leaked
off the page. Nothing in `src/ds/tokens.css` is touched.

**Candidate delight moments** (recorded here, appended to
`docs/DELIGHT_CATALOG.md` only at lock-in):
- Completing a row draws a hairline strike outward from the tick, and the lane
  counts tick over as the row settles into Done.
- The spine's white active bar slides between products instead of cutting.

---

## B · Atelier

**Thesis.** Timeline already earned a register this company can be proud of:
big confident type, real air, one accent spent once. Tasks still reads like a
competent kanban from the category Signal Studio says it is not in. B brings
the studio register across. The project is named at a size you can read from
across a room, the day is stated in one plain sentence, and the board is a wall
of work with air around it rather than five boxes pressed together.

**Chrome.** No top rail. Its jobs move into a white masthead the **product**
owns — identity, search, share, planning, account and the project's own truth.
The spine narrows to 64px, drops its labels, and earns the width back with
material: the page you are on is an **inverted white plate**, nothing else in
the chrome is white, and a name plate slides out on hover.

**The IA opinion.** The permanent 244px projects sidebar is retired to a drawer
behind a Projects control. A venue with one live project does not need a
permanent list of it, and BRAND §2.2 names exactly that as the bloat the 80%
read as "this is not for me". The width goes to the board.

**What it deliberately sacrifices.**
- Roughly 104px of vertical canvas, permanently, to the masthead.
- Density. Fewer cards visible than either A or the current board.
- One click to reach a second project instead of zero.

**Where it breaks a pinned decision.**
1. **Board pass 3, decision 11 — the sidebar's existence and its 236px width.**
   Replaced by a drawer. Argued above.
2. **Board pass 3, decision 1 — "Pure white field."** The board area sits on
   `#fbfbfa`, a hair off white, so the white masthead and the white cards read
   as separate planes. This is a smaller departure than it sounds — it is
   `--paper-soft` — but it is a departure and it is named.
3. **"Studio bar + rail — Keep."** Retired by this brief.

**Candidate delight moments.**
- The masthead's progress sentence recomputes with a count-up when something
  completes, and the indigo "next milestone" edge travels to whatever is next.
- The rail's white plate morphs between tiles rather than cross-fading.

---

## C · Studio Floor · the one that reaches furthest

**Thesis.** Stop drawing a frame around the work and give the work a surface.
The app becomes a warm stone floor holding one white sheet. The spine lifts off
the wall and becomes a floating capsule. The five statuses become shallow trays
cut into the sheet, so a card is *somewhere* rather than merely listed, and
dragging one is moving an object between two real places. The verbs — search,
add, account — collect into a single floating dock at the foot of the sheet,
which is where your hands already are.

**Chrome.** Three floating objects on one ground: the capsule, the sheet, the
dock. Identity is on the sheet's head. The capsule points at the sheet it
opened with a small diamond at the active tile. On a phone the capsule and the
dock become the same object — one floating bar carrying the suite and the verbs
together, with the same diamond pointing up at the page you are on.

**What it deliberately sacrifices.**
- Density. The lowest of the three: trays cost padding on both axes.
- A clean foot. The dock floats over the bottom of the board while you scroll.
  It is scrimmed and trays scroll clear of it, but it is still occlusion.
- Convention. The dock is a pattern that has to be learned once, and the
  first-contact test is the thing that decides whether that is acceptable.
- Build cost. This is by far the most expensive of the three to implement.

**Where it breaks a pinned decision.**
1. **Board pass 3, decision 1 — "Pure white field."** Broken outright. The
   argument: BRAND §5 has always specified warm-stone as the background and
   says "never pure white in elevated surfaces". DS 2.0 locked `--paper` to
   white for *surfaces*; it did not legislate the floor those surfaces sit on.
   C keeps paper white and gives it a floor.
2. **Board pass 3, decision 1 — the deleted 5% lane tint.** The trays are a
   wash. The argument: what was deleted was *per-status colour* — pastel lanes
   that colour-coded the board. C's tray is one neutral warm value across all
   five, carrying no status meaning at all. The objection was to the coding,
   not to the surface.
3. **DS law 2 — "Hairlines, not shadows."** Three objects carry a shadow: the
   sheet, the capsule and the dock. The argument: the law reserves its two
   shadows for "surfaces that genuinely float", and in C those three genuinely
   do. Cards keep hairlines.
4. **"Studio bar + rail — Keep."** Retired by this brief.

**Proposed token changes (additive, named).** `--x-ground-stone` `#efece7` for
the floor and `--x-tray` `#f6f4f1` for the trays. Both warm. A cool grey wash
on a warm floor is the fastest way to make a surface look unauthored.

**Candidate delight moments.**
- A card lifts out of its tray on drag and the destination tray deepens under
  the pointer. Drop settles with a single overshoot, inside the motion budget.
- The dock's Add expands in place into the composer rather than opening a
  dialog.

---

## What the reference set already proved, before any of this

The loading frame is the same in all four products: the black L, and one indigo
dot in the middle of an empty canvas. No wordmark echo, no shape of what is
coming, no words. All three directions replace it with a frame that shows the
shape of the board that is arriving, and says what is being opened.

Separately: `/app/layout.tsx` is `force-dynamic`, so Next never prefetches a
loading shell and a **client navigation between products shows the previous
page until the next one arrives**. There is no route-level loading frame on
that path at all today. That is an implementation finding, not a design one,
and it is recorded here so it is not lost.

---

## Zones, for reactions

Five zones per direction, matching the brief. The numbers exist so a reply in
chat can name one without describing it.

| # | Zone | What is in it |
|---|---|---|
| 1 | **Chrome** | the spine, its width, material, active state, hover, wordmark, mobile behaviour, and wherever identity / search / account / suite switching ended up |
| 2 | **Board** | the scope band or masthead, the view control, column heads and their copy, the shape of the lanes, empty and loading |
| 3 | **Cards** | the card or row itself: anatomy, hierarchy, metadata, completion, hover, the Done treatment |
| 4 | **Type & colour** | the type scale and weights, where colour is spent, the one earned indigo, status colour |
| 5 | **Motion** | described in the designer's notes, not yet built: what moves, when, and why |

The comparison surface carries a like / dislike / note control per zone per
direction and produces a copyable digest.
