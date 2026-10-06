# Concept house rules

Delegated decisions from the 30 September 2026 concept passes. Every concept in
the gallery follows these; a concept that breaks one is not finished.

## Colour means one thing

- **Red** is late or danger. **Amber** is at risk, stuck or over. The **accent**
  is selection, primary action or "next".
- **Calm is quiet.** On track, healthy, finished, latest and waiting states use
  neutral ink, grey and hairlines. Only trouble gets fill.
- **Green** is not used for a standing state. It may mark an added line or a
  lower price in a diff, a done tick that the shared Tasks glyphs already draw,
  or a confirmation that fades.
- **Project and person colours never look like warnings.** Sample data uses
  indigo, blue, teal, green, purple and pink (`--v3-project-1` to `-4`, `-8`,
  `-9`). Amber, orange and red (`-5` to `-7`) stay available for people to
  choose by hand, never as a default or in sample data. The product's automatic
  colour also skips pink, because a pink tile beside a red count reads as red.

## Words

- Project health is **On track / At risk / Off track**, everywhere.
- Plain sentence case, no exclamation marks, no concept or internal names in
  the interface. Every number says what it counts. "Sep", not "Sept"; dates as
  "3 Oct".
- Say each thing once. A summary sentence ends in an action that does the thing.

## Tasks views

Board, list and calendar share `tasks/`: one header, one view switch, five
statuses (To do, In progress, Waiting, To check, Done). "New task" is always the
primary button; a view's own signature action sits beside it as secondary.

## Keyboard

Everything is reachable. Composite widgets use one tab stop and arrow keys.
Shortcut hints use `useModKeys()` so Mac shows ⌘ and ⌥, everyone else Ctrl and Alt.

## One product (from the 1 October 2026 review)

- **One store.** Every count, owner, date and status comes from
  `demo/store` (selectors and `useDemoStore`). No surface hand-writes a number
  another surface can contradict.
- **One header.** `PageHeader` (alias of `TasksHeader` in `tasks/header.tsx`):
  title and scope pill on the first row, one summary line, an optional health
  sentence that ends in an action, the primary action top right with its
  shortcut. Lens or view switches sit on the row below, at the left. No
  centred hero headers.
- **One search.** Ctrl/⌘ K finds projects, tasks, people and files and hands
  questions to Files (what was written) or Analytics (how the work is going).
  `/` always means "search this page". G then a letter belongs to the frame,
  which catches both keys first, so no surface may use a bare G.
- **One set of words.** Tasks: To do, In progress, Waiting, To check, Done; a
  task past its date is "late", never "overdue". Projects: On track, At risk,
  Off track, with "Too early to tell" when there is no evidence yet; "past its
  date" is a prompt to wrap up, not a fourth health state. Dates: "Fri 25 Sep",
  "3 Oct", "in 17 days" (never "in 2 weeks"), "Sep" not "Sept".
- **Plain words (round 2, 2 October 2026).** Nothing the landing page strikes
  out may render: no sprint, epic, backlog, stakeholder, Kanban, burndown,
  velocity, story points, workflow, dashboard, swimlane, deliverable, resource
  allocation, OKR, and no ticket, roadmap or milestone either. Say "Big date"
  (not milestone), "Areas" (not workstreams), "How it is doing" (not health)
  and "To check" (not review).
- **In progress is ink, not amber.** Amber is at risk, stuck or over capacity;
  red is late. Busy is not a warning: show load in neutral ink and use amber
  only when it exceeds what the team can do.
- **Links everywhere.** Any project name or task title opens the same project
  home (`/demo/projects/<id>`) or task (`/demo/tasks/<view>?task=<id>`) from any
  surface, via `useDemoLinks()` in `demo/links.tsx`.
- **New task is the same everywhere.** Label "New task", shortcut N, accent
  button top right on desktop; on phone one round button at the bottom right.
  Clicking it puts the cursor in the new task's title.
- **Ask honestly.** When an answer is a weak match, say so and offer the
  better place to ask. Never answer a different question without saying so.
