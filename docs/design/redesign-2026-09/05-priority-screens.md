# 05 · Priority screens (wave 1), in build order

Ethan's priority: the **sidebar/shell**, **Home**, **Tasks** (list plus refined Kanban), **Projects**, **analytics (Overview)**, **chat (Messages)**, **Files/storage** and **Settings**. Lock these first so the suite reads as one product, then roll the system out to the long tail.

Each brief lists the reference, required content (backed by existing data), and the states to design.

---

### 0. App shell: sidebar, top bar and ⌘K
- **Reference:** `key-frames/10`, `11`, `12`, `13`, `15`, and still 1 (palette).
- **Content:** see `04-information-architecture.md`. Counts come from existing Inbox attention and My Tasks queries. Projects come from the project catalog. The theme switch lives in the account menu.
- **Behaviour:**
  - The sidebar persists across client navigation, with no remount flash.
  - Collapsed state and density are remembered.
  - Keyboard: ⌘K palette, `/` for search, `g h` (Home) and `g t` (Tasks) optional.
  - The palette searches tasks, projects, notes, files and people, and also runs commands (New task, Switch theme).
- **States:** expanded, collapsed, mobile drawer; active, hover and focus on items; project row hover actions (☆, ⋯, +).
- **Must fix on the way:** the current "Checking your session…" gate renders the whole page blank until the client auth loads. Render the shell immediately and gate only the data regions.

### 1. Home
- **Reference:** `key-frames/10` and `12` (dark and light Gr8r), and `01` (clip C KPI tiles and Ongoing works).
- **Content (existing data):**
  - The greeting, which must follow local time: today it says "Good morning" at night.
  - The date line.
  - KPIs: Active projects · Open tasks (assigned to me) · Completed this week · Overdue (red), plus the Signal briefing count.
  - **My tasks**, with a segmented filter Upcoming / Overdue / Completed and a row anatomy of status, title, project chip, priority, due.
  - **Upcoming deadlines**: Today / Tomorrow / This week.
  - Project progress table.
  - The "Today's signal" briefing as a card: 3 calling items with a "Why this" disclosure.
  - Recent activity.
- **Actions:** New task (primary), New project, Invite member.
- **States:** new user (empty but guiding), normal, heavy.

### 2. Tasks: List, Board (keep and refine), Table, Calendar, Timeline
- **Reference:** `key-frames/19` (list), `20` (board), `22` (calendar), `23` (timeline), and still 2 (New task modal).
- **List:** grouped by Status (Group: Status / Project / Assignee / Due), with columns ✓, ID (mono), Title, Status, Assignee, Priority, Due, Project, ⋯. Inline "+ Add task" per group.
- **Board:** keep the current behaviour. Restyle the column header (status icon, name, count, +, ⋯), cards (label chips, title, ID, priority bars, due, comments count, avatar), and the "+ Add task" footer.
- **New task:** the modal from still 2. Title, description, and property chips (Project, Status, Assignee, Priority, Due, Start, Labels, Repeat), plus subtasks, attachments, "Create more" and ⌘↵.
- **Task detail:** a right panel with header chips, description, subtasks, Resources, and Conversation (restyle).
- **States:** empty project, filtered to nothing, loading skeleton rows, drag in progress, overdue emphasis.

### 3. Projects
- **Reference:** `key-frames/21` (grid) and `20` (project header and tabs), plus `26` (no access) and `27` (archive empty).
- **Grid card:** icon + colour, name, ☆, status pill, two-line description, progress bar + %, and a meta row (tasks done/total, due, updated, avatars).
- **Project page:** header (icon, name, ☆, status dropdown, people, Share, ⋯), then tabs **Overview · Board · List · Timeline · Messages · Files · Activity**. The Overview tab uses the dashboard recipe scoped to the project.
- **States:** archived and read-only, restricted, empty, and a template-created project.

### 4. Overview (analytics)
- **Reference:** `key-frames/18` (portfolio, tasks by status, workload), plus clip C's trend footers and mini bar charts.
- **Content:** KPIs (Projects, Tasks, Completion rate, Members), a **Portfolio** table, a **Tasks by status** segmented bar with legend, **Workload per person**, and a completion trend from `analytics_snapshots` (a daily cron now verified).
- **States:** not enough data yet, and a single-person workspace (hide workload).

### 5. Messages (internal chat)
- **Reference:** Notifications feed styling (`key-frames/17`) and generic two-pane chat. There's no chat screen in the references, so extrapolate from the system.
- **Layout:** a left list of project rooms and recent task discussions (unread dot, last message snippet, time), then the thread (messages grouped by author and day, @mention highlight in `--accent-soft`, "Create task from message", reply), then the composer (Notify people, 8,000-character counter, ⌘↵).
- **States:** no conversation yet, a removed member shown as "Project member", sending, failed with retry, and read-only.

### 6. Files (new)
- **Reference:** Projects grid and Tasks list grammar; this is a new page.
- **Content:** every Resource across projects: native uploads and Google Drive files. Show name + type icon, project, task, uploaded by, size, date, and location badge (Signal Studio or Drive), filtered by project, type and uploader. Row actions: open or download, go to task, copy link.
- **Data:** existing attachment and Drive tables. Add one tenant-scoped read endpoint or server query. No new storage behaviour.
- **States:** Drive not connected (with a connect CTA), empty, and a file on a Drive whose owner has left.

### 7. Settings
- **Reference:** `key-frames/28–32` and still 3 (Team members).
- **Structure:**
  - General: Workspace, Appearance (Theme, Accent, Density, Motion), Language, Date & time.
  - Workspace: Members, Teams, Projects, Permissions.
  - Connections: Google Drive.
  - Notifications: Email, Mentions, Assignments, Daily digest.
  - Personal: Profile, Preferences, Keyboard shortcuts.
  - Privacy & data: Export, Delete account.
  - Security: Sessions.
- **Row pattern:** label and description on the left, control on the right, hairline dividers.

### 8. Inbox and notifications (wave 1.5)
- **Reference:** `key-frames/17`. A single feed: Unread/All, Mark all as read, rows as actor + verb + object with a snippet, project and time, unread dot, and hover actions. It absorbs Project attention, Stuck and Direct alerts. The digest becomes a pinned summary card at the top.

---

## Wave 2 (after wave 1 is locked)
Notes (capture, notebook, review), Timeline (plan, share manager, artifact studio, public shared page), Calendar as a full page, Task detail full page, onboarding, import, sign-in and invite flows, and every empty, error and loading state across the long tail. Mobile passes for all of them.
