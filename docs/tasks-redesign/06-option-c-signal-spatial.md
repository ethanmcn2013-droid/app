# Option C — Signal Spatial

## Intent

Signal Spatial makes relationships between account, planning period, workspace, task state, dated work, and unscheduled work continuously visible. It is the most application-like and planning-heavy option, intended for users who coordinate complex launch work across views.

## Structural composition

- A dedicated hierarchical navigation rail for account, planning periods, and workspaces.
- A workspace context band with purpose, receipts, and an interactive status map.
- A dense command layer for view, search, filter, group, sort, fields, density, planning rail, saved view, and task creation.
- Primary view plus a collapsible planning rail containing selected-day work and unscheduled tasks.
- One shared docked inspector and one full-screen task dialog across every view.

The option has a dedicated spatial shell and dedicated Board, List, Timeline, Calendar, and planning-rail implementations under `src/components/design-lab/tasks/options/c/`.

## View behavior

### Board

Compact cards and narrow status lanes maximize cross-lane visibility. The adjacent planning rail keeps selected-day and unscheduled work in view. Status-map filtering, drag, keyboard movement, task menus, WIP receipts, and collapse behavior support active coordination.

### List

A frozen selection and task anchor sit beside configurable operational fields. Status/priority grouping, collapsible groups, inline values, field visibility/order/width controls, and the planning rail support dense review. The table has an explicit 992px planning width and remains contained on narrow desktops.

### Timeline

The spatial timeline emphasizes the relationship between task rows, date geometry, the current-day line, selected-day work, and unscheduled work. Range, due, and milestone shapes remain distinct; drag, keyboard, date controls, and range resizing share one schedule model.

### Calendar

The calendar balances a dense grid with the planning rail instead of a separate agenda column. Range continuity, due dates, milestones, selected day, dense overflow, and unscheduled work remain explicit. Movement preserves schedule type and never manufactures geometry for undated tasks.

## Interaction model

- Interactive status map, cross-view search/filter/group/sort, configurable fields, density, and a collapsible planning rail.
- Shared task palette, inspector, selection, bulk actions, context menu, and full-screen task mode.
- Drag operations always have keyboard, menu, or explicit date-control equivalents.
- Session-only saved-view signature includes view, density, filters, sorting, grouping, search, fields, and planning-rail state.
- Cross-view and cross-option mutations use the same normalized in-memory task store.

## Trade-offs

- Strongest option for planning relationships, command density, and distinct Signal Studio application character.
- Highest cognitive load and largest implementation surface.
- The planning rail competes with the primary work surface at narrow widths and therefore collapses or yields to the shared inspector at larger inspector breakpoints.
- It carries the greatest maintenance risk because more controls and spatial regions must remain coherent across four views.

## Evidence

- Live URL: `/__design-lab/tasks?option=c&view=board&dataset=normal&density=compact&mode=default`
- Contact sheets: `artifacts/tasks-redesign/comparison-normal-1440.png`, `comparison-dense-1024.png`, and `comparison-normal-1920.png`.
- Individual captures: `artifacts/tasks-redesign/screenshots/c-*.png`.
- Browser and accessibility proof: `e2e/design-lab/tasks-design-lab.spec.ts` and `artifacts/tasks-redesign/axe/c-*.json`.
- Representative interaction recording: `artifacts/tasks-redesign/video/phase1-interaction.webm`.
