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

| Site | Treatment shipped |
|---|---|
| Task panel open/close | Slide from right edge, 420ms glide in / 260ms out |
| Lane collapse/expand | Width travel 240ms glide + rail fade-in |
| Card completion | 200ms colour/background settle |
| Card hover | Border strengthen + shadow lift, 120ms |
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

## Review checklist (when the catalog closes)

1. Operator supplies reference components per family (popovers, overlays,
   list reflow, drag/drop, confirmations).
2. Group entries into families; one treatment per family, not per site.
3. Decide **animate vs restrained** for every entry — a restrained verdict is
   recorded here, not silently dropped.
4. Implementation plan ordered by traffic (S1/S2 and B1/B2 first).
