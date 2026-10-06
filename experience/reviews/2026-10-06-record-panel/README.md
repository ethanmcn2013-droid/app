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

Until now, from 1024px up an opened task skipped the panel and covered the app with the two-column page. Now a task opens in the panel at every width:

- on the Tasks board from 1280px it docks beside the board (the dock the board already had, which the 1024px rule had been pre-empting);
- elsewhere, and below 1280px, it is a side panel over a scrim that traps focus;
- Open, or E, shows the two-column page. Its button back is now named "Back to the panel".

## Registry and tests

Two registered sources changed:

- `tasks.surface.task-detail-panel` (`task-detail-panel.tsx`): the panel at every width;
- `tasks.resources.drive-upload` (`resources-section.tsx`): one optional `seeAll` slot in the section head.

Both hashes are refreshed with receipts in `receipts/`, written by `pnpm experience:review` against the critical capture named there.

One test changed deliberately. In `experience/tests/critical-experiences.spec.ts`, "tasks.surface.task-detail-panel / populated task" expected a dialog at every width. At the desktop (1280) and wide (1440) projects the panel now docks beside the board as a labelled region (`complementary`) named by the task, so the test asks for that role there and for the dialog below.

## Evidence

Review-mode production build, `next start`, Chromium. Lab: `shots/app-reviews/2026-10-06-record-panel/` (`panel-<size>-<theme>.png`, plus `before-sheet-*.png` and `panel-laptop-dark-opened.png`). Sizes: wide 1920 on the board (docked), desk 1440 on the board (docked), laptop 1180 on the list (side panel), tablet 768, phone 390, each in dark and light. No console errors.

## Where this falls short

- Review mode's sample tasks have no subtasks, so the Progress bar has not been seen rendered. It is drawn from the real rollup and named for assistive tech ("2 of 5 subtasks done"). Visual check owed on the PC with a task that has subtasks.
- The project peek is not in this pull request.
