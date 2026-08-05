# Tasks board — launch-grade redesign

2026-08-05 · branch `tasks/board-world-class` · owner: Claude Code (product lane)

The board works — column CRUD, WIP limits, saved views, keyboard model,
optimistic sync and the inline composer all shipped between T·96 and T·131.
What it does not yet do is look authored. This pass keeps every behaviour
and rebuilds the visual system: precision-white canvas, one compact context
band, a real segmented view control, quiet column headers, a signature card,
truthful metadata copy, and the planning rail rehoused as a drawer.

## Verdicts on the four framing layers

| Layer | Today | Verdict |
|---|---|---|
| Studio bar + rail | 56px black bar, 60px rail (suite chrome) | Keep. Surgical fixes only: rail-foot avatar overlap, tooltip QA. Shared with Notes/Timeline/Home — no rebuild. |
| Workspace brief | 2–3 column dashboard: h1 + progress panel + milestones panel + money line (~96px) | Replace with a single ~54px context band. Milestones + money move to the Planning drawer. |
| View bar | Tabs styled as boxes + outlined Filter/Sort/Save view/Share/••• row (~46px) | Segmented view control left; ghost Filter/Sort/Views right. Share + print/overflow move up to the context band (project level). |
| Board canvas | 5% full-column tint, 58px two-row headers, dashed empty panels, rotated Add-column rail, rotated Planning rail, 30px keyboard strip | Rebuild per below. |

## The decisions

1. **Pure white field.** `--x-task-canvas` maps to `--paper`. The full-lane
   tint (`.boardLane[data-tinted]` 5% wash) is deleted. A column's colour
   lives in exactly three places: the status pip, a 2px top rule on its
   header, and its near/over-limit count state. Done loses its grey
   recession — completed cards already read done by check + strikethrough.
2. **One context band.** Title (editable h1, 17px/650) · description
   (editable, muted, single line, ghost "Add a short description" when
   empty) · right cluster: progress (76px bar + tabular %) · overdue chip
   (only when > 0) · sync whisper · Share · Planning (badge = unscheduled
   count) · ••• (print, shortcuts). The h1 keeps its accessible name —
   `experience/critical-fixtures.json` asserts a heading named after the
   workspace.
3. **Segmented views.** Board/List/Schedule/Calendar as one capsule on
   `--paper-deep`, active segment white with hairline. Real links (kept).
4. **Column header, one row, 44px.** Pip · name (13px/600, click-to-rename
   kept) · count (12px mono, plain number; "n/limit" only when a limit is
   set, tooltip carries the sentence). `+` and `•••` fade in on
   hover/focus-within, always visible on coarse pointers. Collapse moves
   into the column menu (keyboard + touch reachable); the always-on chevron
   dies. Optional description stays as a quiet second line when authored.
5. **Card.** Radius 10 (DS `--radius-lg`), hairline border, white, no rest
   shadow. Hover = border-strong only (motion contract forbids hover lift).
   Drag = existing scale + float shadow. Completion is a 16px circle that
   fills `--x-task-success` with a drawn check (140ms, reduced-motion safe).
   Title 13.5px/580. Footer hairline removed. Selected/focus states kept.
6. **Truthful metadata.** New `formatScheduleForTask` in
   `hybrid/dates.ts`: completed tasks never read "overdue" — a done card
   with a past due date reads "Was due 14 Jul", a done milestone keeps
   "Milestone · 1 Aug" in neutral ink. Open milestones gain explicit
   grammar: "Milestone due tomorrow" / "Milestone overdue by 3 days".
   Unit-tested beside the existing dates tests.
7. **Empty lane.** One muted line ("Nothing here yet") over the existing
   add row. The dashed panel dies. While a board drag is live, every lane
   paints a 3% accent wash and the empty slot becomes an explicit dashed
   drop target — feedback only exists when it means something.
8. **Add column.** The rotated pinned rail dies. An end-cap ghost tile
   (header-height, horizontal text) sits after the last lane inside the
   scroll; it expands into the existing AddColumnForm in place. The
   per-column "Add column after" menu item remains, so nothing is lost on
   long boards.
9. **Planning drawer.** The rotated collapsed rail dies; its trigger is the
   Planning button in the context band. Expanded: 336px docked panel
   (overlay + dialog semantics below 768px — existing logic kept), now also
   housing the Milestones list and the money coverage line (T·124's "renders
   only here" constraint moves with it — still an owner-only app surface,
   still absent from share/print/embed). Collapsed state persists per
   browser like lane collapse.
10. **Keyboard strip dies.** `KeyboardLegend` is removed from board, list
    and schedule. Replacement: a Shortcuts dialog (existing Dialog
    primitive) on `?`, plus a "Keyboard shortcuts" item in the band's •••
    menu. The strip's ⌘ glyph (wrong on Windows) dies with it.
11. **Sidebar polish.** Selected project: 2px indigo inset marker + 4%
    tint, not a lavender slab. Counts: plain 11px tabular, no pill. Header:
    "Tasks" + collapse control (the SIGNAL STUDIO eyebrow duplicated the
    black bar's identity). Base width 248 → 236px. Period names get
    `title` tooltips so a truncated "Act…" is recoverable.
12. **"Project" in the rail stays singular.** `/app/project` is the active
    workspace's overview (D-011). Renaming it "Projects" would promise a
    list it does not show. Recorded as a deliberate divergence from the
    design brief, which assumed the label was a plural nav item.
13. **Money stays visible to the operator** — in the Planning drawer, not
    the always-on header. If this proves wrong in use, it is one component
    move back.

## Motion (governed by docs/design/TASKS_DELIGHT_MOTION_CONTRACT.md)

Kept within budget: completion check draw (140ms local settle), composer
swap (fast token), drop-target wash (instant token), drawer layout bounds
(base token — allowed exception), existing placement receipts and
LayoutGroup settles. Explicitly not done: hover lift/tilt, staggers,
full-view slides, bounce, celebrations. `prefers-reduced-motion` zeroes the
duration tokens already; new keyframes are added to the existing
reduced-motion blocks.

## Functional guardrails (verified in code before the rewrite)

- All server actions and store dispatches untouched.
- `data-task-id` stays on card/title buttons — `use-task-panel.ts` restores
  focus via `button[data-task-id]`.
- Critical fixtures assert ARIA roles/names (workspace h1, palette dialog,
  quick-create textbox) — all survive.
- Saved views (localStorage, per workspace), lane collapse, density,
  suite-context params: untouched semantics.
- `src/ds/tokens.css` is vendored — never edited. All new styling uses
  existing semantic tokens or the `--x-task-*` extension layer.
- Copy passes the brand voice rules (no jargon, no exclamation marks).

## Issue checklist from the design brief

Resolved by this pass: pastel lane fills · grey canvas · oversized
header · permanent milestones module · duplicated progress statements ·
green progress bar (→ indigo) · placeholder description presented as
content · generic outlined toolbar · Save view housing (already truthful —
button relabels to "Views · n"; it moves into the quiet group) · Share at
project level · two-row column headers · red Queued (already fixed — Queued
is toneless) · "Review vs Reviewing" (naming: system columns are Queued /
In progress / Review / Waiting / Done; rename stays one click on the
header) · completed-still-overdue copy · ambiguous milestone copy ·
count-badge inconsistency · zero-badge on Planning (badge only when > 0) ·
tiny permanent column controls · dashed empty panel · rotated Planning
rail · rotated Add column rail · bottom keyboard strip · ⌘ glyph on
Windows · mixed radii on board surfaces · uppercase micro-labels in the
board area · small hit targets (44px coarse-pointer rules kept/extended) ·
sidebar slab selected state · "Act…" truncation without recovery.

Out of scope, recorded: print/share views still render the four canonical
lanes (predates this work); the marketing SuiteHeader is sealed by
`check-chrome-contract`; ds-foundation React primitives remain unconsumed
(vendored CSS only); the legacy `components/app/board/board-app.tsx` tree
is unrouted and untouched.

## Validation plan

`pnpm typecheck` · `pnpm lint` · `pnpm test:calendar-truth` (dates) ·
targeted unit tests (board-config/colors/lanes) · `pnpm ds:check` ·
`pnpm first-contact:language` · full `pnpm test` · Playwright captures at
1920/1440/1280 + ~1024, keyboard-only pass, reduced-motion pass, console
sweep — evidence in the PR.
