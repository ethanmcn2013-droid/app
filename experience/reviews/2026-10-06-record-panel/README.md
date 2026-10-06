# Record side panel for a task (6 October 2026)

Branch `design/app-v3-record-panel`. Sprint to-do item 5: "Record side panel (reference 24) for the task detail panel and a project peek". This pull request is the task half. The project peek follows separately.

## What the reference asks for

Founder screenshot 24 (lab `reference/founder-screenshots/24.webp`) is a compact record panel:

- previous and next with "5 of 48", then Edit and Open, then close;
- the record's icon, its name, and a quiet line under it;
- one row per field, with an icon and a label on the left;
- a progress bar;
- then sections (Meetings, Progress, Notes, Activity), each with a link to see everything.

Port brief item 30 asks for the same idea: "Task panel that keeps your place, with a button to expand to a full sheet".

## Data map

| Element in the reference | Source in the app | Kept or dropped |
| --- | --- | --- |
| Previous, next, "5 of 48" | The panel's existing walk over the current view's visible order (`getVisibleTaskOrder`) | Kept. Up, down, j and k work as before. |
| Edit | The task's name field | Kept. It puts the cursor in the name with the text selected. |
| Open | The existing full page (`onExpand`, key E) | Kept. The two-column page is unchanged. |
| Record icon | The Project's colour tile (`projectColor`, the sidebar's own) and its first letter | Kept |
| Name and the line under it | Task title (editable); Project name, task number (`T-14`), "edited …" (`EditedStamp`) | Kept |
| Owner, Stage, Closes and the other field rows | Status, Assignees, Due date (with repeat), Priority, Labels, Contact, Amount, Held up by, Copies: the task's own fields, all editable in place as before | Kept, restyled with a wider label column |
| Probability bar | `task.subtaskDone` and `task.subtaskCount` (rollups `getTasks` already computes) | Shown as "Progress" only when the task has subtasks. No figure is invented for a task without them. |
| Last edited by | No editor is recorded per task | Dropped. "Edited …" in the line under the name says when, not who. |
| Meetings | No meetings exist | Dropped |
| Notes with "View notes" | The task description | Kept as "Notes", with "See all" |
| Progress section (updates) | No status-update history per task | Dropped. Subtasks keep their own section. |
| Activity with "View activity" | The task's conversation or its existing history | Kept, with "See all" |
| (not in the reference) Files and links | Task resources | Kept, with "See all" after Attach file |
| (not in the reference) Mark done | As before | Kept beside the name; under it on a phone |

"See all" opens the full page, where every section has room. On the full page there is no "See all".

## Behaviour change

Until now, from 1024px up an opened task skipped the panel and covered the app with the two-column page. Now a task opens in the side panel at every width, over a scrim that traps focus, with the list or board still in place behind it. Open, or E, shows the two-column page, and its button back is named "Back to the panel".

The Tasks board also had a dock that placed the sheet beside the board from 1280px, with no scrim. The 1024px rule had kept it unreachable, so it had never shipped. It is removed rather than revived:

- it would be a second behaviour, with its own focus rules (F6), that nobody has reviewed;
- the critical spec's promise, "a modal dialog at every width", stays true.

The board's empty dock slot is left alone.

## Registry and tests

Two registered sources changed:

- `tasks.surface.task-detail-panel` (`task-detail-panel.tsx`): the panel at every width;
- `tasks.resources.drive-upload` (`resources-section.tsx`): one optional `seeAll` slot in the section head.

`tasks.surface.task-detail-panel` is a mapped critical fixture, so its hash is refreshed by `pnpm experience:fixtures:write`. Its own critical case re-renders it. `tasks.resources.drive-upload` is refreshed with a receipt in `receipts/`, written by `pnpm experience:review` against the full critical run named there. That run is the task detail case, which renders the Files and links heading. The fixture manifest, the spec and the config are unchanged, so no other receipt is unbound.

No test changed. The critical case "tasks.surface.task-detail-panel / populated task" still asks for a dialog named by the task at every width, and passes.

## Evidence

Review-mode production build, `next start`, Chromium. Lab: `shots/app-reviews/2026-10-06-record-panel/` (`panel-<size>-<theme>.png`, plus `before-sheet-*.png` and `panel-laptop-dark-opened.png`). Sizes: wide 1920 and desk 1440 on the board, laptop 1180 on the list, tablet 768 and phone 390, each in dark and light. No console errors.

## Where this falls short

- Review mode's sample tasks have no subtasks, so the Progress bar has not been seen rendered. It is drawn from the real rollup and named for assistive tech ("2 of 5 subtasks done"). Visual check owed on the PC with a task that has subtasks.
- The project peek is not in this pull request.
