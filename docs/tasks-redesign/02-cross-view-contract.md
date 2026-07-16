# Tasks four-view redesign — cross-view contract

This is the implementation contract for Option A, B, and C. Visual composition may differ; data meaning, capability, and interaction outcomes may not.

## Product hierarchy and language

The lab represents the production hierarchy:

`Account → Planning Period → Workspace → View → Task`

- Use “Planning period” and “Workspace” in structural navigation.
- Use contextual plain language in content, for example “Launch workspace” or “Website readiness.”
- Do not imply a persisted Project entity, saved account configuration, or production integration.
- The four views appear once, in the contextual view bar.

## Canonical domain model

```ts
type CalendarDate = `${number}-${number}-${number}`;

type TaskStatus = "queued" | "active" | "review" | "waiting" | "done";
type TaskPriority = "urgent" | "high" | "normal" | "low";

type TaskSchedule =
  | { kind: "unscheduled" }
  | { kind: "due"; dueOn: CalendarDate }
  | { kind: "range"; startOn: CalendarDate; dueOn: CalendarDate }
  | { kind: "milestone"; on: CalendarDate };

type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeIds: string[];
  schedule: TaskSchedule;
  estimate?: string;
  labelIds: string[];
  subtaskIds: string[];
  attachmentIds: string[];
  commentIds: string[];
  blockerIds: string[];
  blockedByIds: string[];
  completed: boolean;
  completedAt?: string;
  workspaceId: string;
  order: number;
};
```

Date display strings are derived with the frozen lab clock, `en-GB`, and `Europe/London`. They are never stored as scheduling truth. Range validation requires `startOn <= dueOn`. Completion does not erase historical schedule, but completed historical work is not labeled overdue.

## Canonical store

One normalized in-memory store is mounted above the option and view renderers:

```ts
type LabState = {
  tasksById: Record<string, Task>;
  taskOrder: string[];
  selectedIds: string[];
  activeId: string | null;
  inspectedId: string | null;
  previewId: string | null;
  editing: { taskId: string; field: string } | null;
  drag: DragOperation | null;
  undo: UndoEntry | null;
  filters: LabFilters;
  density: "compact" | "comfortable";
  readOnly: boolean;
};
```

Option switches and view switches preserve this store during the current mounted session. Reload and Reset restore the deterministic fixture. The lab must display: “Session-only prototype · reload resets.” No code writes to local storage, cookies, Server Actions, databases, or network APIs.

## Cross-view invariants

1. The same task ID resolves to the same canonical record in all options and views.
2. Moving a Board card changes canonical `status` and `order`.
3. Editing title, status, assignees, schedule, priority, or completion in the inspector updates every view immediately.
4. Timeline scheduling writes one explicit `TaskSchedule` variant.
5. Calendar scheduling writes the same schedule variant used by Timeline and List.
6. Unschedule replaces the complete schedule with `{ kind: "unscheduled" }`.
7. An unscheduled task appears in Timeline and Calendar trays and never in a date cell, marker, or range bar.
8. A due-only task renders as a due marker, never a fabricated range.
9. A milestone renders as a milestone marker, never a normal task range.
10. Completing a task updates all views; completed historical work is not shown as overdue.
11. Filters use one predicate implementation across A/B/C and all views.
12. Local saved-view definitions use one schema and are explicitly session-only.

## Shared interaction language

### State separation

- `activeId`: current keyboard-navigation target.
- `selectedIds`: explicit multi-selection.
- `inspectedId`: task shown in the shared inspector.
- `previewId`: optional read-only peek.
- `editing`: transactional field draft.
- `drag`: lifted item, origin, legal targets, and current target.

Focus does not imply selection. Inspection does not imply selection. Hover does not own unique actions.

### Click and selection

- Single click on the task title/open control opens the inspector.
- Visible checkboxes support selection in every view where bulk actions apply.
- Ctrl/Cmd-click toggles a task; Shift-click extends from a stable rendered-order anchor.
- While selection mode is active, a plain task-row/card click toggles selection rather than unexpectedly opening.
- Escape precedence is: cancel edit → close menu/preview → cancel drag → clear selection → close full-screen inspector.

### Keyboard

- Global: Ctrl/Cmd+P task palette; `C` create when a non-editable work surface owns focus; `/` search; `?` shortcuts.
- Task: Enter opens; Space selects; Shift+F10 opens context menu; F2 edits.
- Board: arrows navigate cards/lanes; Alt+Up/Down reorders; Alt+Left/Right changes status.
- List: native table navigation; Enter/F2 edits the current field; Space selects the row.
- Timeline/Calendar: arrows navigate; Alt+Left/Right moves by a day; Alt+Shift+Left/Right changes a range end; explicit Schedule fields provide full parity.
- A completion shortcut only acts when a real task control owns focus.

### Editing and recovery

- Enter commits.
- Escape restores the original value without closing the parent surface.
- Tab commits and advances where a next editable field exists.
- Validation retains the draft and identifies the error.
- Every mutation updates a polite live region and offers one-step Undo.
- Read-only mode exposes no active mutation path, including drag and keyboard shortcuts.

### Context menu

The same command set is available from right-click and Shift+F10:

- Open
- Edit title
- Change status
- Schedule / change dates / unschedule
- Assign
- Complete / reopen
- Duplicate in session
- Delete in session

## Shared inspector contract

- One component and field schema serves all views and options.
- Docked mode uses `aside` with an accessible name and remains non-modal.
- Full-screen mode uses `role="dialog"`, `aria-modal="true"`, initial focus, focus containment, Escape handling, and trigger-focus restoration.
- The title, description, status, priority, assignees, dates, labels, subtasks, attachments, comments, and dependencies are inspectable.
- Date controls expose explicit unscheduled, due-only, range, and milestone choices.
- Empty, loading, error, read-only, long-content, and relationship-rich states are deterministic.

## View contracts

### Board

- Semantic lane sections with headings, counts, optional WIP signal, task lists, and compact Add task.
- Task cards use real controls and two-line titles.
- Same-lane reorder and cross-lane status move include insertion feedback.
- Menu and keyboard alternatives exist for both operations.
- Multi-selection, floating bulk actions, inline title/status editing, context menu, empty lane, and de-emphasized Done are available.

### List

- Native table structure with caption, sticky header, and a frozen task/title column where space permits.
- Fields can be hidden, reordered, and resized in session; an explicit Fields dialog provides non-drag control.
- Group headings include count, progress, Add task, and collapse.
- Rows distinguish hover, selected, focused, editing, completed, and read-only states.
- Subtasks expand in place; bulk actions remain reachable without covering selected rows.

### Timeline

- Sticky task pane and date header, compact rows, today line, bounded range navigation, Fit, and useful zoom levels.
- Range, due-only, and milestone geometry are distinct.
- An explicit unscheduled tray supports drag to schedule and a Schedule command.
- Range move and resize include exact date feedback, Escape cancellation, and keyboard/date-field alternatives.
- Geometry never leaves the rendered planning range without navigation or auto-scroll.

### Calendar

- Native calendar table with caption and complete day labels.
- Previous, Next, Today, Month, Week, and Agenda controls have real lab behavior.
- Empty space can create a dated task; tasks can move and multi-day ranges can extend.
- Overflow is an actionable, keyboard-operable popover.
- Selected-day agenda and the explicit unscheduled tray keep work discoverable.
- Move/resize has command, keyboard, and inspector alternatives.

## Design-lab URL contract

Route: `/__design-lab/tasks`

Query parameters:

- `option=a|b|c`
- `view=board|list|timeline|calendar`
- `dataset=sparse|normal|dense|edge`
- `density=compact|comfortable`
- `mode=default|empty|loading|error|readonly`
- `task=<stable-task-id>` when the inspector is open

Invalid values fail safely to documented defaults; invalid task IDs leave the inspector closed and show no fabricated task.

## Production-isolation contract

The server route renders only when all conditions are true:

1. `NODE_ENV === "development"`
2. `SIGNAL_ACCESS_MODE === "review"`
3. `SIGNAL_TASKS_DESIGN_LAB === "true"`

Otherwise it calls `notFound()` before loading the client lab. The route is outside `/app`, has `noindex`, imports no production action/database/persistence module, and can be removed as one isolated route plus component directory. Production verification must prove a 404 with the lab flag absent and with it maliciously set to true.

## Accessibility semantics

- Board: `section` + heading + `ul`/`li` + task `article`, real title button, checkbox.
- List: native `table`, `thead`, `tbody`, row headers, checkboxes, buttons, inputs.
- Timeline: labelled planning surface, semantic task controls, explicit schedule form, focusable bars/markers.
- Calendar: native table/caption, complete accessible date labels, buttons for tasks and overflow.
- Inspector: complementary `aside` when docked; conforming modal dialog only in full-screen mode.
- Focus targets remain visible at 200% zoom, controls meet target-size expectations, and color is never the only state cue.

## Performance and dependency decision

The canonical universe contains 48 tasks. Virtualization is unnecessary at this Phase 1 scale and would complicate semantics and screenshots. No new runtime dependency is approved. Memoized selectors, normalized state, bounded rendering, and CSS containment are sufficient; performance observations will be captured under Dense data.
