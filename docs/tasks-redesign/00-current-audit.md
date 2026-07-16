# Tasks four-view redesign — current audit

Date: 2026-07-16
Phase: 1, pre-implementation
Baseline commit: `e5a4680` (`origin/main`)
Working branch: `codex/tasks-four-view-design-lab`

## Scope and evidence

This audit covers the shipped Board, List, Timeline, Calendar, shared task state, inspector, review fixtures, design tokens, test tooling, and repository constraints. Evidence came from source inspection, live review-mode browser inspection, deterministic screenshots at 1440 × 1000, console and accessibility inspection, and the existing repository checks.

Baseline evidence is stored outside the repository worktree in:

- `work/baseline/board-1440x1000.png`
- `work/baseline/list-1440x1000.png`
- `work/baseline/timeline-1440x1000.png`
- `work/baseline/calendar-1440x1000.png`

The screenshots are diagnostic evidence, not final acceptance evidence. The Board capture clipped horizontally despite all four lanes existing in the DOM, so final evidence must use settled, deterministic browser automation and assert document dimensions before capture.

## Current product and technical model

- The real hierarchy is Account → Planning Period → Workspace → View → Task. There is no production `Project` entity or projects table.
- Board, List, Timeline, and Calendar share the `TasksProvider` and the layout-mounted task inspector.
- Mutations use optimistic client state and Server Actions; live updates use SSE.
- Date truth is fractured across human-readable `due`, structured `dueAt`, relative `startDay`, and `durationDays` fields.
- Board custom columns can carry a `boardColumnKey` that diverges from the canonical status/lane used by other views.
- Board uses native HTML drag events. Timeline uses pointer events. There is no shared drag, grid, table, or virtualization dependency.
- Styling uses Tailwind v4, vendored design-system tokens, Geist, and custom components. Product-local token additions must use the `--x-` prefix.
- Review mode is safe from durable writes, but its Server Actions rehydrate the unchanged seed. It is therefore not a credible interactive comparison store.

## Confirmed strengths

1. One shared client task provider already establishes the right direction for cross-view continuity.
2. One inspector is mounted at the application layout rather than reimplemented in every view.
3. Board includes an explicit Move command as a non-drag starting point.
4. List includes selection and a bulk toolbar, establishing useful interaction vocabulary.
5. The command palette and quick-create shortcut are recognizable productivity primitives.
6. The repository has lint, type-check, unit, browser, accessibility, and experience-quality infrastructure.
7. The design-system token surface is mature enough to support a neutral, product-specific extension without a new visual system.

## Blocking findings

### P0 — silent date fabrication

Review fixtures include tasks without `startDay` or `durationDays`. Timeline renders them with `startDay ?? 0` and `durationDays ?? 1`. Calendar places them on Today using a comparable fallback. A task with no schedule therefore appears scheduled.

This violates the primary invariant:

> An unscheduled task must never be silently scheduled on today or an arbitrary date.

The redesign lab must use a fail-closed schedule union. No view may infer a missing date.

### P0 — date edits do not share one source of truth

The inspector edits a display-oriented due value while Timeline manipulates relative range fields. A change in one surface cannot be trusted to mean the same thing in all other surfaces. Due-only, ranged, milestone, and unscheduled work need explicit, mutually exclusive canonical states.

### P0 — review mode cannot prove cross-view persistence

Review mutations optimistically appear and then restore the deterministic server seed. Timeline also maintains some date behavior locally. A polished prototype built on these paths could imply continuity it does not actually have. Phase 1 therefore needs one in-memory lab store shared by A/B/C and all views, with the persistence boundary visibly labeled.

### P1 — hierarchy and context conflict

The workspace switcher can name one context while the page heading presents another. Board/List/Timeline/Calendar are repeated in the sidebar and project-level tabs. “Your work” and “Live” are ambiguous. The shell consumes vertical space without giving the user a clear Planning Period, Workspace purpose, owner, target, or progress.

Resolution: the lab uses the real nouns Planning Period and Workspace. It may use a human context label such as “launch workspace,” but it will not invent a production Project object.

### P1 — status can drift by view

Board custom-column membership can diverge from the canonical lane used by List, Timeline, and Calendar. Moving a card can therefore appear to change workflow state in Board while leaving other views unchanged.

Resolution: one canonical status field drives every option and view. Board lanes are views of status, not a second status model.

### P1 — interaction models are inconsistent and pointer-first

- Board cards are visually “focused” while DOM focus can remain on `body`; document-level shortcuts can mutate the first task.
- Board drag changes lanes but does not provide complete same-lane reorder semantics.
- List selection is primarily modifier-click and rows are generic `div` elements.
- Timeline bars are not keyboard-operable and lack scheduling alternatives.
- Calendar is effectively read-only; overflow is inert text.
- Inspector opening does not consistently set, contain, or restore focus. Escape can leak from field editing into panel closing.

Resolution: focus, active item, selection, inspection, editing, and drag state are separate. Mutating shortcuts only act when a real task control owns focus. Every drag action has a menu, field, or keyboard equivalent.

### P1 — incomplete planning surfaces

Timeline lacks a real unscheduled tray, bounded navigation, zoom, keyboard scheduling, and explicit due-only treatment. Calendar lacks expected navigation, agenda, creation, move/resize, actionable overflow, and an unscheduled tray. The current views cannot be treated as behavioral foundations for the lab.

### P1 — fixture and state coverage is too weak

The current ten-task review fixture is uniformly assigned and does not prove dense, overflow, overdue, blocked, milestone, multi-day, relationship-rich, read-only, loading, error, or accessibility states. It is insufficient for typography, density, wrapping, and interaction judgment.

## Visual and accessibility findings

- The interface has too many stacked navigation and heading layers.
- Board columns float in one undifferentiated canvas; the giant dashed Add area reads as unfinished.
- List separates related values and does not use table semantics.
- Timeline rows are oversized because a design-system spacing token maps `h-12` to 96px in this context.
- Indigo carries too much of the product identity instead of serving as one restrained semantic accent.
- Board accessibility scored 100 in the sampled Lighthouse run, with an account-menu accessible-name mismatch.
- Calendar scored 96, including an accent-tint contrast failure and the same account-menu mismatch.
- Task cards/rows, Timeline bars, Calendar overflow, hover-only controls, and inspector focus behavior still contain serious keyboard/semantic risks that aggregate scores do not reveal.

## Baseline verification

Executed before Phase 1 edits:

| Check | Result |
| --- | --- |
| `pnpm lint` | Pass |
| `pnpm test` | Pass |
| `pnpm ds:check` | Pass |
| `pnpm experience:self-test` | Pass |
| `pnpm typecheck` | Pass after stopping the dev server and regenerating `.next`; the prior error was a concurrent generated route-types artifact |
| Live Board/List/Timeline/Calendar | All opened in review mode; no console errors observed |

## Constraints for Phase 1

- Do not replace or edit production view routes.
- Do not call production Server Actions, databases, or persistent storage.
- Do not introduce a schema migration.
- Do not edit vendored design-system tokens.
- Do not add a new runtime dependency unless evidence proves it necessary.
- Use the same dataset, canonical store, inspector, and capability contract for A/B/C.
- Keep the lab outside `/app` and fail closed unless development, review mode, and an explicit server-only flag are all active.
- Label persistence honestly: session-only; reload resets.

## Council disagreements and chair decisions

### “Project” framing versus the real Workspace model

The brief requests a project context header; the IA review confirmed no Project entity exists. The lab will express project-like orientation through the real Workspace and Planning Period hierarchy. It will not create a fake product noun or persistence model.

### Modal versus complementary inspector

Accessibility review correctly rejected the current modal claim without modal behavior. On desktop, the lab inspector will be a non-modal complementary panel that can be expanded into a true full-screen dialog. The dialog mode will trap focus; the docked mode will not falsely declare `aria-modal`.

### Fixture scale

QA proposed 120 tasks for Dense. The direct brief requests approximately 30–50 realistic tasks shared across options. The lab will use one 48-task canonical universe: Sparse selects 8, Normal selects 40, Dense uses all 48 with deliberately concentrated lanes/dates, and Edge cases selects purpose-built records from the same universe. This preserves fair comparison and still creates stress conditions.

### Shared structure versus meaningful option difference

Architecture favors maximum reuse; the red team warns against three skins. The decision is to share domain state, data, behavior primitives, inspector, commands, and accessibility contracts while giving A/B/C separate information architecture and view composition. Shared behavior does not require shared DOM.

## Audit verdict

The shipped implementation is a useful terminology and integration reference, but it is a no-go behavioral foundation for a fair four-view comparison. Phase 1 will be an isolated coded lab with a canonical schedule model, deterministic data, honest local state, capability parity, and three structurally distinct compositions.
