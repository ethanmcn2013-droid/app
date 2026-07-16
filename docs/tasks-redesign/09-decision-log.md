# Tasks redesign decision log

## 2026-07-16 — Phase 1 boundaries

- Phase 1 is an isolated comparison exercise. Production task routes, production data access, database schema, and migrations are outside its write scope.
- The lab route is `/__design-lab/tasks`; it must fail closed unless the process is in development, review mode is explicit, and `SIGNAL_TASKS_DESIGN_LAB=true`.
- Phase 2 is prohibited until Ethan explicitly selects A, B, C, or a precisely defined hybrid.

## 2026-07-16 — Product hierarchy

- Canonical hierarchy: Account → Planning period → Workspace → View → Task.
- The current Tasks product has no separate Project entity. The prototypes therefore use “workspace” and “planning period” rather than inventing project persistence or navigation.
- Board, List, Timeline, and Calendar are peer views of one workspace and one task model.

## 2026-07-16 — Task and schedule truth

- All options use one normalized in-memory store and one shared inspector.
- Schedule is an explicit union: unscheduled, due-date-only, start-and-due range, or milestone.
- Unscheduled tasks remain in trays or planning rails and receive no fabricated geometry.
- Drag movement preserves schedule type where possible; scheduling an undated task requires an explicit user date.

## 2026-07-16 — Comparison fixture

- Canonical manifest: `tasks-2026-07-16-v1-48`.
- Canonical SHA-256: `ff72c1e8f0fba3791f5474afc444ae2d2eeb52473d6fdbee4f6fa0d4005fc0be`.
- Dataset projections: Sparse 8, Normal 40, Dense 48, Edge cases 24.
- Every task has a distinct purpose description; the fixture includes long titles, heavy relationships, dense dates, many/no assignees, attachments, comments, subtasks, blocked work, milestones, ranges, due dates, and explicit unscheduled work.

## 2026-07-16 — Option separation

- A — Quiet Command: restrained operational density and keyboard-first execution.
- B — Editorial Project Room: purpose, progress, and commitments frame the work surface.
- C — Signal Spatial: hierarchy, commands, planning relationships, and unscheduled work remain spatially adjacent.
- Each option has a dedicated shell and dedicated Board/List/Timeline/Calendar implementations. Shared code is limited to the task/domain contract, store, inspector, command palette, selection/bulk tools, context menu, icons, and fixture.

## 2026-07-16 — Evidence rules

- Scores must point to screenshots, tests, live interactions, source, axe output, or measured browser observations.
- Development render timings are comparative only; the lab is intentionally absent from production and cannot supply production Web Vitals.
- The 9.9 target is aspirational. Scores will not be raised to meet it without evidence.

## 2026-07-16 — Final acceptance disposition

- Four fresh acceptance reviewers found no automatic-fail condition and no unresolved critical or serious defect in A, B, or C.
- Final panel means are A 9.27, B 9.50, and C 9.18. None reaches the 9.9 average/every-category gate.
- B is the strongest unmodified option. Its project orientation and coherence outweigh its additional contextual overhead.
- A is the strongest source of operational restraint and maintainability, but it is under-oriented and less distinctive.
- C contributes the strongest signature language, but its full model is not the recommended base because of cognitive load and materially worse development long-task evidence.
- Final production build passed. With `SIGNAL_TASKS_DESIGN_LAB=true` and review mode requested, both tested lab URLs still returned 404 from the built production server.

## 2026-07-16 — Chair recommendation, not selection

Recommend an exact hybrid for Ethan to accept or reject:

1. B project shell: workspace purpose, planning-period context, progress, commitments, and selected-day agenda.
2. A command layer, Board/List density, quieter inspector relationship, and Timeline geometry/performance baseline.
3. B compact planning-story treatment on Timeline and B's restrained selected-day Calendar context.
4. C optional planning rail only at wide desktop, plus milestone language, spatial grouping, and restrained Signal-specific accents.
5. Exclude C's full always-visible metadata system and preserve the shared store, inspector, schedule union, state contracts, keyboard model, and accessibility evidence.

This recommendation does not authorize Phase 2.

## Selection status

No option has been selected. Phase 1 stops at the following explicit gate:

- `SELECT A — Quiet Command`
- `SELECT B — Editorial Project Room`
- `SELECT C — Signal Spatial`
- `SELECT HYBRID — followed by the exact components to combine`
