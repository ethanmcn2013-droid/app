# Tasks four-view redesign — state matrix

Every A/B/C option must cover this matrix with the same canonical fixtures and behavior. `Inspector` means the one shared component. “Tray” always means an explicit unscheduled location, never a fallback date.

## Surface matrix

| State | Board | List | Timeline | Calendar | Inspector |
| --- | --- | --- | --- | --- | --- |
| Empty | Five quiet lane states; compact add | Table empty state; add task | Empty grid + empty tray | Empty date surface + empty tray | No task selected guidance |
| Sparse | 8-task layout, one empty lane | 8 rows with useful fields | Scheduled shapes + 2 tray items | Dated items + 2 tray items | Sparse task specimen |
| Normal | 40 realistic tasks | 40 rows, grouped | Representative dates/shapes | Month with useful spread | Fully populated task |
| Dense | 48 tasks; lane/WIP overflow | 48 rows; field pressure | Overlap, tray pressure, horizontal planning | 9+ tasks on one day | Long feed/content |
| Overflow | Intentional surface scroll | Intentional table scroll | Bounded horizontal/vertical scroll | Actionable `+N more` | Internal panel scroll only |
| Loading | Lane skeletons | Row skeletons | Pane/bar skeletons | Cell skeletons | Section skeletons |
| Error | Recoverable surface message | Recoverable surface message | Recoverable surface message | Recoverable surface message | Section-level and whole-panel retry |
| Read-only | No drag/edit/add/bulk mutation | No edit/resize mutation | No drag/resize/schedule | No create/move/resize | Fields readable, edits disabled |
| Completed | De-emphasized Done lane | Collapsible completed group | Historical shape, not overdue | Historical item, not overdue | Reopen control unless read-only |
| Overdue | Semantic date treatment | Semantic date treatment | Due marker/range end before today | Semantic item/agenda treatment | Clear overdue text |
| Blocked | Dependency indicator + reason | Blocked field/indicator | Optional relationship cue | Agenda indicator only | Blockers and dependents |
| Unscheduled | Card remains in status lane | “Unscheduled” date text | Explicit tray only | Explicit tray only | Schedule kind is Unscheduled |
| Long title | Two-line clamp + full name on focus | Controlled wrap/truncate | Sticky pane wrap/truncate | Item truncate + preview | Full editable title |
| Many assignees | Compact stack + count | Names/stack + count | Compact stack in task pane | Agenda stack/count | Complete list |
| No assignee | “Unassigned,” no fake avatar | “Unassigned” | “Unassigned” in task pane | Agenda label when needed | Explicit empty state |
| Multi-day | Date range summary | Start and due fields | Real resizable range | Continuous range treatment | Start/due fields |
| Due-date-only | Due text/marker | Due only; no start | Due marker, never a bar | Single due item | Due-only schedule choice |
| Milestone | Diamond/label indicator | Milestone type/date | Milestone diamond | Milestone item | Milestone schedule choice |
| Subtasks | Progress summary | Expandable child rows | Summary in task pane only | Agenda summary only | Full list and progress |
| Attachments | Count indicator | Optional count field | Inspector-only detail | Inspector-only detail | Complete attachment list |
| Comments | Count indicator | Optional count field | Inspector-only detail | Preview/inspector detail | Complete feed |
| Dependencies | Compact blocker indicator | Dependency field | Optional progressive lines | Agenda indicator | Full blocker/dependent detail |
| Keyboard focus | Real card/control focus | Cell/row control focus | Task/bar/marker focus | Date/item/overflow focus | Logical initial and restored focus |
| Multi-selection | Checkboxes + bulk toolbar | Checkboxes/ranges + bulk toolbar | Task-pane selection + bulk toolbar | Agenda/item selection where useful | Not selection-owning |
| Narrow desktop | Surface scroll; controls reachable | Frozen title + table scroll | Sticky pane + grid scroll | Compact toolbar + day agenda | Dock width bounded; full-screen available |

## Interaction-state matrix

| State | Required treatment |
| --- | --- |
| Default | Complete information hierarchy; no hidden active state |
| Hover | Secondary controls may appear, but keyboard focus reveals the same controls |
| Active | Pressed/lifted feedback without changing selection implicitly |
| Selected | Visible checkbox and surface treatment; announced count |
| Keyboard-focused | High-contrast focus indicator on the actual operable element |
| Editing | Field boundary, draft value, commit/cancel instructions where needed |
| Dragging | Origin, lifted item, legal targets, current target, exact outcome |
| Drop target | Insertion marker or date target; illegal targets visibly unavailable |
| Disabled | Not operable, correctly exposed to assistive technology |
| Read-only | Mutation paths absent or disabled consistently, including keyboard |
| Loading | Deterministic mode; preserves surrounding structure |
| Error | Named failure, retained unaffected content, retry path |

## Deterministic fixture contract

Environment:

- Frozen clock: `2026-07-16T09:00:00+01:00`
- Locale: `en-GB`
- Timezone: `Europe/London`
- Stable IDs, people, initials, labels, ordering, and relationship metadata
- One manifest and fixture hash shared by A/B/C

Profiles:

| Dataset | Shape |
| --- | --- |
| Sparse | 8 tasks; one empty lane; 2 unscheduled; 1 completed; 1 minimally populated |
| Normal | 40 tasks across all statuses and schedule kinds over a three-month window |
| Dense | All 48 tasks; one lane above WIP; 9 tasks on one day; 12 unscheduled; overlapping ranges; long inspector feed |
| Edge cases | Purpose-built selection from the same 48-task universe, emphasizing every state below |

The 48-task universe must include:

- At least 12 unscheduled tasks, with three prominent Edge specimens.
- At least four due-only tasks.
- At least five ranges, including weekend and month-boundary work.
- At least three overdue tasks and one completed historical task that must not appear overdue.
- At least three milestones.
- Two blocked chains, one cleared dependency, and one safely handled orphan reference.
- Zero, one, four, and seven-assignee specimens.
- Two titles longer than 140 characters and one long unbroken token.
- One parent with eight subtasks in mixed completion states.
- One task with six attachments, including a long filename and one failed-upload specimen.
- One task with twelve comments and mixed activity.
- One calendar day with at least nine tasks.
- One empty Board lane in Sparse and one lane above WIP in Dense.
- Urgent, high, normal, and low priorities.

Modes are query-driven and do not corrupt fixture truth:

- `default`
- `empty`
- `loading`
- `error`
- `readonly`

Editing, dragging, keyboard focus, and multi-selection are interaction states exercised by browser tests rather than alternate records.

## P0 acceptance flows

### Unscheduled round-trip

1. Confirm task exists in Board/List and both unscheduled trays.
2. Confirm it does not exist in any Timeline date geometry or Calendar date cell.
3. Schedule via Timeline drag or explicit Schedule fields.
4. Confirm canonical JSON and all four views agree.
5. Move/resize via Calendar or Timeline.
6. Unschedule.
7. Confirm all schedule fields are gone and both trays contain the task again.

### Cross-view mutation ledger

Using one stable task ID:

1. Move status in Board.
2. Edit title and assignees in Inspector.
3. Schedule in Timeline.
4. Move in Calendar.
5. Complete in List.
6. After every step, assert title, status, order, assignees, schedule, completion, and relationships from the canonical store and visible surfaces.

### Read-only integrity

Open each view and Inspector in `mode=readonly`. Confirm no control, drag handle, context command, shortcut, or optimistic state can mutate the store.

### Inspector identity and focus

Open the same task from every view. Confirm one component, one task ID, identical fields, URL state, docked semantics, full-screen containment, Escape order, and return focus to the trigger.

### Failure isolation

Exercise route-level error and inspector-section error. Unaffected content remains usable, the failed area names itself, and Retry restores deterministic data.

## Evidence requirements

Each applicable matrix cell must be backed by at least one of:

- Automated browser assertion
- Deterministic screenshot
- Accessibility output
- Interaction receipt / canonical before-and-after state
- Source reference
- Browser inspection
- Performance observation

An `N/A` requires a product rationale. Phase 1 cannot pass with an unresolved P0/P1 state defect, critical/serious accessibility issue, fabricated date, inaccessible drag-only operation, production-isolation failure, or capability/data mismatch between A/B/C.
