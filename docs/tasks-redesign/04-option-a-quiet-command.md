# Option A — Quiet Command

## Intent

Quiet Command is the lowest-friction evolution of Tasks: a restrained, operational desktop surface that makes hierarchy, task state, and keyboard control legible without turning the workspace into a dashboard. It is designed for sustained daily use at normal and dense task counts.

## Structural composition

- Persistent Signal Studio account rail.
- Compact `Planning period > Workspace` context header with purpose, owner, target, progress, and visible-count receipts.
- One view bar for Board, List, Timeline, and Calendar; view-specific controls appear only when they can act.
- Full-width primary work surface with a lightweight task preview.
- One shared docked inspector and one full-screen task dialog across every view.

The option is implemented with a dedicated composition and dedicated view DOM under `src/components/design-lab/tasks/options/a/`; it is not a recolour of another option.

## View behavior

### Board

Five restrained status lanes prioritize scanability over card decoration. Cards expose title, priority, schedule, assignees, labels, progress, and dependency signals. Drag moves and reorders tasks; `Alt` plus arrow keys and the task menu provide equivalent non-drag operations. WIP receipts stay in lane headers.

### List

A dense operational table supports status grouping, collapsing, multi-selection, inline status changes, column visibility, column ordering, and column resizing. The task column remains the primary anchor. Bulk actions use the shared selection model.

### Timeline

The timeline separates the task pane from dated geometry and keeps unscheduled work in an explicit tray. Due dates, milestones, and ranges have distinct shapes. Drag, keyboard movement, explicit date controls, and range resizing all update the canonical schedule union.

### Calendar

Month, week, and agenda modes share the same schedule model. Dense days use an overflow popover; a selected-day agenda and unscheduled tray preserve context. Calendar movement and range resizing have keyboard and explicit-control alternatives.

## Interaction model

- `/` focuses search; `Ctrl/Cmd + P` opens the task palette.
- Arrow keys navigate; `Enter` opens; `Space` selects; `F2` edits; `Shift + F10` opens task actions.
- `Alt + arrows` moves status, order, or date; adding `Shift` resizes a range where valid.
- Search, filter, sort, group, density, fields, and a session-only saved view are functional.
- Selection, active task, inspector state, edits, schedule changes, and completion persist while switching views or options because they use the shared store.

## Trade-offs

- Strongest option for density, predictability, and implementation restraint; least expressive option for project storytelling.
- The full-width work surface favors execution over contextual planning aids.
- The compact typography requires careful preservation of contrast and pointer targets.
- At narrow desktop widths, complex planning surfaces use contained horizontal scrolling to preserve usable geometry.

## Evidence

- Live URL: `/__design-lab/tasks?option=a&view=board&dataset=normal&density=compact&mode=default`
- Contact sheets: `artifacts/tasks-redesign/comparison-normal-1440.png`, `comparison-dense-1024.png`, and `comparison-normal-1920.png`.
- Individual captures: `artifacts/tasks-redesign/screenshots/a-*.png`.
- Browser and accessibility proof: `e2e/design-lab/tasks-design-lab.spec.ts` and `artifacts/tasks-redesign/axe/a-*.json`.
- Representative interaction recording: `artifacts/tasks-redesign/video/phase1-interaction.webm`.
