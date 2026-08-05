# Delight Catalog — Tasks

**Status: cataloging. Do not implement.**

The operator's direction (2026-07-28): before building any more micro-interactions,
catalog every site in the product where one belongs. The operator is sourcing
reference components to match against — implementation happens only after the
catalog is complete, reviewed, and each entry has a decision (animate vs stay
restrained). Sessions working in this repo should append newly noticed sites to
this file rather than animating them ad hoc.

Ground rules for the eventual pass (from the design system):
- Motion is spent, not sprinkled: `--spring-glide` / `--spring-snap` / `--ease-out`
  are the only curves; `prefers-reduced-motion` is absolute; no confetti or
  celebration animations (BRAND refusal).
- Every entry below gets a verdict at review time: **animate** (with the chosen
  reference) or **restrained** (explicitly decided, not forgotten).

## Already done (for register calibration)

Values re-verified against the shipped CSS/JS 2026-07-31 — the table had
drifted from the code (420ms/240ms were never what production ran).

| Site | Treatment shipped |
|---|---|
| Task panel open/close | Slide from right edge, 320ms ease-out in (the contract's moderate-token exception) / 200ms out |
| Lane collapse/expand | Width travel 220ms glide + collapsed-rail fade-in |
| Card completion | 200ms colour/background settle |
| Card hover | Border strengthen + shadow, 120ms — no translate/lift (contract forbids it) |
| ••• and diamond reveal | 120ms opacity on hover/focus |

## Catalog — board view

| # | Site | Current behaviour | Notes |
|---|---|---|---|
| B1 | Workspace ••• menu (project options, "The Orchard, events") | Appears instantly | Operator called this out explicitly |
| B2 | Card ••• actions dropdown | Radix menu, appears instantly | Same register as B1; right-click context menu too |
| B3 | Fields panel (toolbar) | Appears instantly | |
| B4 | Compact/Comfortable density switch | Instant reflow of every card | Could stagger-settle; may be better restrained |
| B5 | Add-task composer appear/dismiss | Instant swap with the add row | Could grow from the row |
| B6 | New card landing after composer commit | Appears instantly in lane | Candidate: brief rise-in |
| B7 | Drag insertion marker | Static 2px bar | Candidate: subtle stretch |
| B8 | Drop landing | Card teleports to slot | Candidate: settle at destination |
| B9 | Assignee avatar / profile hover | No affordance today | Operator wants profile cards; catalog the reveal |
| B10 | WIP fraction crossing near/over limit | Colour snaps | Candidate: pulse once on crossing |
| B11 | Lane header + (add) and collapse chevron | 120ms colour only | Probably restrained |
| B12 | Milestone diamond toggle | Instant fill swap | Candidate: diamond draw/scale beat |

## Catalog — task panel

| # | Site | Current behaviour | Notes |
|---|---|---|---|
| P1 | Due-date calendar popover | Appears instantly | All panel popovers share one register |
| P2 | Priority picker popover | Appears instantly | |
| P3 | Status (lane) picker popover | Appears instantly | |
| P4 | Assignee picker + avatar add/remove | Instant | Avatar join/leave could scale in/out |
| P5 | Repeats picker | Instant | |
| P6 | Make-copies popover | Instant | |
| P7 | Add-field reveal (Contact/Amount) | Row appears instantly | Candidate: height ease |
| P8 | Mark done press | Instant label swap | Pairs with board completion settle |
| P9 | Subtask add/complete | Instant | |
| P10 | Resources: file drop overlay | 120ms fade (motion/react) | Already decent; recheck against references |
| P11 | Resource row add/remove | AnimatePresence list | Recheck register |
| P12 | Description editor focus | Instant border | |
| P13 | Panel j/k task switch | Content swaps instantly inside open panel | Candidate: content cross-fade |
| P14 | Nudge send → "Nudged just now" | Instant swap | Candidate: check-draw beat |

## Catalog — shell & chrome

| # | Site | Current behaviour | Notes |
|---|---|---|---|
| S1 | Search / command palette (Ctrl K) | Appears instantly | Highest-traffic overlay in the app |
| S2 | New task quick-create dialog (C) | Appears instantly | |
| S3 | Product rail switch (Notes/Tasks/Timeline/Signal) | Hard navigation | Suite-level; see loading canon §13 before touching |
| S4 | Projects sidebar collapse | Instant | |
| S5 | View tab switch (Board/List/Schedule/Calendar) | Instant swap | Candidate: 120ms content fade; may be restrained |
| S6 | Toasts | Existing toast primitive | Recheck register |
| S7 | Saved-view bar appear | Instant | |
| S8 | Inbox/updates list rows | Instant | |

## Catalog — list / schedule / calendar views

| # | Site | Current behaviour | Notes |
|---|---|---|---|
| L1 | Group collapse/expand | Rows appear/vanish instantly | Height ease candidate |
| L2 | Subtask row expand | Instant | |
| L3 | Column resize / reorder | Live but dry | Probably restrained |
| L4 | Schedule bar drag/resize | Instant snap to days | Candidate: snap settle |
| L5 | Calendar month navigation | Instant grid swap | Candidate: directional slide |
| L6 | Unscheduled tray → timeline drop | Teleport | Same family as B8 |

## Catalog — Timeline product (added 2026-07-29, world-class pass sweep)

Structural motion matching what Tasks shipped (panel/sheet entrances, fold/
collapse, state settles) is already ratified and excluded from this list;
these are the discretionary micro-interaction sites only.

| # | Site | Current behaviour | Notes |
|---|---|---|---|
| T1 | Project switcher menu (plan header) | Radix-free custom menu, appears instantly | Same family as B1/B2 popovers |
| T2 | View/Edit mode toggle | Full navigation, instant swap | Content crossfade candidate; may be restrained |
| T3 | Manual-add milestone form appear/dismiss | Instant swap with the "+ Add a milestone" link | Fold candidate — same family as Tasks B5 (ratified structural scope) |
| T4 | Curation "Saved" tick | Appears/vanishes at 1.5s timer, 160ms opacity only | Candidate: check-draw beat, pairs with Tasks P14 |
| T5 | Curation public-state segmented change | 120ms colour swap | Probably restrained |
| T6 | Curation reorder drop (drag + keyboard) | Row teleports to new position | Same family as Tasks B8 drop-settle |
| T7 | Hidden-milestones details expand | Instant | Height ease, same family as Tasks P7 |
| T8 | Sync-from-Tasks button → result chip | Instant swap between idle/zero/count/error | |
| T9 | Audience manager publish → share-receipt reveal | Instant | The one-time-link moment; deserves weight |
| T10 | Copy-link confirmations (artifact header, share receipt) | Instant label swap | Same family as Tasks P14 |
| T11 | Milestone point select → detail panel | Already animated: 220ms crossfade + rail draw on load | Done register — calibration reference for Timeline |
| T12 | TimeLens progress ↔ countdown flip | Already animated: 140ms directional slide + 220ms sweep | Done register |
| T13 | Milestone label hover reveal (desktop rest-hidden labels) | 140ms opacity | Recheck against references |
| T14 | Phone preview scroll affordance | None; device sits static | Probably restrained |

## Catalog — Signal product (added 2026-07-29, world-class pass sweep)

Structural motion matching what Tasks shipped (sheet entrances, fold/collapse,
state settles) is ratified and excluded; the evidence drawer entrance/exit and
the Why-this fold shipped with the Signal pass. These are the discretionary
micro-interaction sites only.

| # | Site | Current behaviour | Notes |
|---|---|---|---|
| SG1 | Why-this fold + chevron rotate | Already animated: 200ms height ease, chevron on the same duration and ease, unified in both directions | Done register — calibration reference for Signal. Two corrections, both 2026-07-29: the durations were unified first (a 320ms panel against a 140ms chevron finished 180ms early), which fixed the open only — on close the panel carried `hidden` on the same commit, so it vanished a frame before its own chevron. The panel is now always rendered and simply empty when closed, so the exit height ease and the rotate land together. |
| SG2 | Empty-state "briefing complete" mark | Already animated: `steps(1, end)` tick, 3.6s period, comes to rest after 3 cycles | Done register. Corrected 2026-07-29: this was a 320ms eased breathe, which is the Tasks `pulse` shape wearing Signal's period. DESIGN.md §5 defines Signal's gesture as a tick that jumps between samples, never between them, and the screen whose message is "nothing needs you" must not move forever. |
| SG3 | Ledger entrance stagger | Already animated: 220ms rise, 60ms stagger, CSS on server-rendered markup | Done register. Moved off motion/react variants 2026-07-29: a hidden-then-revealed variant gated the whole page on hydration, so the honest skeleton handed off to a blank page. |
| SG4 | Row hover/focus tone rail | Tone present at rest (34%), strengthens to full on hover/focus, 140ms | Restrained, decided. A hover-only rail does not exist on touch or in a static read, so the resting state now carries the tone and the pointer only deepens it. |
| SG5 | "Review in Tasks" press → server action | Honest busy state shipped: `disabled` + `aria-busy` via `useFormStatus`, no animation | The *pressed-state micro-interaction* stays deferred to the reference review. What shipped is state correctness, not delight: the control gave zero feedback for 2+ seconds and was double-submittable. |
| SG6 | Coverage note appearance | Renders with the page, no entrance of its own | Probably restrained |
| SG7 | Freshness suffix (dateline, non-fresh reads) | Static toned text | Probably restrained — honesty surface, not decoration |
| SG8 | Scope switcher Show (flag-gated planning periods) | Full navigation, instant swap | Same family as Timeline T2 |
| SG9 | Onboarding Confirm → "Linking…" | Instant label swap | Same family as Tasks P14 |
| SG10 | Cadence option select (retained settings control) | Instant border/background swap | Same family as B4 density switch |
| SG11 | Evidence drawer pagination Previous/Next | Honest busy state shipped: `useTransition` holds the round-trip, a polite status line names the destination page, the record pane rests at 0.7 opacity while it is in flight (140ms settle, no spinner) | The *page-swap micro-interaction* stays deferred to the reference review; same family as Tasks P13 panel content swap. What shipped is state correctness: `aria-busy` alone sat on a plain container, which announces nothing to a reader and shows nothing to anyone else, so the drawer looked frozen for the whole fetch. |

| SG12 | The ping on the lead attention mark, in the POPULATED briefing | Not animated | **Candidate, deliberately not shipped.** Raised twice by the same panel seat: the product is named Signal, the hero makes the name literal with a ring leaving the NOW marker every ~4s (`the-read.tsx` `rd-ping`), and the only perpetual motion in the app today lives in the empty state, i.e. the screen whose message is that nothing happened. Porting it would give the daily read its one signature moment. Held because a perpetual mark on the primary surface is exactly the discretionary micro-interaction this catalog exists to gate, and because the empty-state tick is already Signal's ratified gesture. The decision needed is whether the product gets one perpetual mark or none, not how to build it. |

## Open structural question (not a delight item)

The cold-eyes seat's highest-leverage finding, twice, was that the app does
not use its canvas: the hero fills 1080px with a three-column row
(`rail | body | action at the right edge`) where the rail carries a claim
word, and the ledger is a single left-aligned stack in a 600px measure inside
an 880px column. Porting that grid was argued to fix four things at once —
the emptiness, first-row primacy that font-size alone cannot buy,
scannability, and family resemblance to the hero.

It is NOT ported, and the reason is a real tension the panel did not address:
in the hero there are no sections, so the claim word (NOW / NEXT) *is* the
section. In the product, "Needs attention" and "Quiet risks" already carry
that meaning, so a per-row claim word would say it twice. Any port therefore
needs a decision about what the rail carries instead. That is a design
direction call, not an implementation detail, so it is recorded here rather
than guessed at.

## Review checklist (when the catalog closes)

1. Operator supplies reference components per family (popovers, overlays,
   list reflow, drag/drop, confirmations).
2. Group entries into families; one treatment per family, not per site.
3. Decide **animate vs restrained** for every entry — a restrained verdict is
   recorded here, not silently dropped.
4. Implementation plan ordered by traffic (S1/S2 and B1/B2 first).
