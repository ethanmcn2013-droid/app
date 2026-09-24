# 01 · Reference analysis

Source material Ethan collected on 24 Sep 2026 as the quality bar for the Signal Studio redesign. Frames were extracted at **2 frames per second** (`frames/`). The best frame of each screen is copied with a descriptive name into `key-frames/`.

| Clip | File | Length | What it is |
|---|---|---|---|
| A | `reference-videos/video-A.mp4` | 7 s, 1440×1080 | Light-theme **Calendar**: week view with a to-do rail. The same product family as C. |
| B | `reference-videos/video-B.mp4` | 81 s, 1232×720 | Full walkthrough of **"Gr8r Studio"**, a dark-theme work OS with a light theme. **The primary reference.** |
| C | `reference-videos/video-C.mp4` | 6 s, 1440×1080 | Light-theme **Home dashboard**: KPI strip and "Ongoing works" cards with sparkline bars. |
| Stills | `reference-images/` (Ethan to drop in) | — | ⌘K palette (dark), New task modal (dark), Settings › Team members (light). Described in `reference-images/README.md`. |

A fourth clip in Downloads (`…563286.mp4`) is a Claude brand film, not UI, so it was excluded.

---

## Clip B: "Gr8r Studio" screen by screen

Frame numbers are `frames/video-B/f_NNNN.jpg`. At 2 fps, time in seconds ≈ N ÷ 2.

| Frames | Screen | What matters |
|---|---|---|
| f_0001–0020 | **Home** (dark) | "Good evening, Alex" plus the date line. Three actions top right: Invite member (ghost), New project (ghost), **New task (accent)**. KPI strip of four tiles in one bordered row (Active projects 5 · 1 at risk / Open tasks 39 · 7 assigned to you / Completed 9 · this week / Overdue **2 in red** · need attention). Left: **My tasks**, a list with a segmented filter (Upcoming 6 · Overdue 1 · Completed 1) and each row showing status ring, title, project chip with colour dot, priority bars, and due date (Today in amber). Right: **Upcoming deadlines**, grouped Today / Tomorrow / This week with count badges, priority bars and avatar. Then Project progress (table) and Recent activity. |
| f_0021–0024 | Transition | A soft blur and zoom as the camera pushes into the sidebar. It shows the motion style: calm, not springy. |
| f_0025 | **My Tasks** | The same row anatomy as Home, full page, grouped by due bucket. |
| f_0029 | **⌘K palette** over Favorites | Centred dark panel, a search input with an Esc hint, filter chips (All · Tasks · Projects · People · Files · Comments), Recent searches, Suggested queries, and a keyboard footer (↑↓ navigate · ↵ select · ← back). |
| f_0033–0040 | **Favorites** | Starred projects as cards (icon, name, star, status pill, two-line description, progress bar with %, and a meta row of tasks done · due date · updated · avatars), plus starred tasks as rows. |
| f_0041 | **Notifications** | A single column feed with an Unread pill in the title, All/Unread toggle, Mark all as read, and a filter icon. Rows: avatar, actor + verb + object in bold, quoted snippet with @mention highlight, project · time meta, unread dot, and a check/mail action on hover. |
| f_0042–0058 | **Workspace overview** (analytics) | KPI strip (Projects / Tasks / Completion rate / Members). **Portfolio table** (project icon + name, lead avatar, status dot, inline progress bar + %, open, overdue in red, due). **Tasks by status**: a segmented bar plus a legend with counts and %. **Workload**: per-person stacked bars coloured by status. The "analytics" look to copy. |
| f_0061–0064 | **Tasks** (all) | Title plus subtitle "Every task across 6 projects". Toolbar: search, Filter, Sort: Manual, Group: Status, and a List/Board/Table switch. Grouped sections (Backlog 8, To Do 17) with + add. Columns: checkbox, ID (WEB-130 in mono, muted), title, status, assignee avatar + name, priority, due date, project chip, and a ⋯ menu. Dense (≈30px rows), calm, no heavy borders. |
| f_0065–0070, f_0081–0088 | **Calendar** (month) | Month grid with project legend dots, Month/Week switch, and a Today pill. Events are compact chips; completed ones are struck through. Today's date sits in an accent circle. |
| f_0071–0076 | **Timeline** | A Gantt: task list left with status icons and assignee initials, bars coloured by status, dependency curves, a today line, Weeks/Months switch, and Group: Project. |
| f_0077–0080 | **Members** | Tabs (Members · Teams · Roles & permissions), search, role filter chips (All/Owner/Admin/Member/Guest), and rows with avatar, name + email, role dropdown and team. |
| f_0089–0092 | **Projects** grid | 3-column cards (as in Favorites). Toolbar: search, All statuses, Sort: Recently active, and a Grid/List/Table switch. Status pills: In Progress (blue), At Risk (red), Planning (grey), On Hold (amber), Completed (green). A restricted project shows a lock and "Restricted, request access to see tasks". |
| f_0093–0096 | **Project, Board** | Header: project icon, name, star, status dropdown, avatar stack, invite, Share, settings, ⋯. **Tabs: Overview · Board · List · Table · Calendar · Timeline · Files · Activity · +**. Columns (Backlog/To Do/In Progress/Review/Done) each with a status icon, count, + and ⋯. Cards: label chip (dot + text), title, ID, priority, due date, comment count, assignee. "+ Add task" at the foot. The sidebar shows the project expanded with Board/List/Timeline/Files. |
| f_0097–0104 | **No access** | A centred lock icon, "You don't have access", one line of explanation, then Back to projects and Request access (accent). |
| f_0105–0108 | **Archive** | Tabs (Tasks/Projects) and a friendly empty state with an icon and a two-line explanation. |
| f_0109–0116 | **Team pages** (Engineering, Marketing…) | Team icon and name, Edit team, Invite. Two-column body: Projects (status + progress) and Members (role chip), then Open tasks. |
| f_0117–0120 | **Settings › Appearance** | Settings has its own **second-level nav**: General (Workspace, Appearance, Language, Date & time), Workspace (Members, Teams, Projects, Permissions), Notifications (Email, Push, Mentions, Task assignments), Personal (Profile, Preferences, Keyboard shortcuts), Security (Password, Sessions, 2FA). Appearance: theme cards (Light/Dark/System with mini previews), 6 accent swatches, **density** (Sidebar and Task display: Comfortable/Compact), Motion: Follow system. |
| f_0121–0136 | Settings: Date & time, Members, Permissions (toggle list plus a role × capability matrix), Email (toggle rows) | Settings rows use label + description on the left and a control on the right, 1px dividers, no boxes. |
| f_0141–0148 | Back to Home | — |
| f_0149–0152 | **Account menu** | Avatar, name and email, View profile, Account settings, **Theme: Light / Dark / System** segmented, Keyboard shortcuts (?), Sign out. |
| f_0153–0162 | **Light theme** Home | The whole product in light: warm off-white sidebar (#F4F3F0-ish), white canvas, hairline borders, a white active pill with a soft shadow in the sidebar, accent indigo for the primary button and the Inbox badge. |

### Persistent chrome (every screen of B)
- **Sidebar**, about 240px, collapsible (toggle top right of the sidebar):
  1. Workspace switcher: logo, name, chevron.
  2. Primary: Home, Inbox (accent count badge), My Tasks (count), Favorites, Search (`/` hint), Notifications (count).
  3. **WORKSPACE** (small caps label): Overview, Projects, Tasks, Calendar, Timeline, Members, Activity.
  4. **PROJECTS**: each project has a coloured icon, star, unread dot, and ⋯ and › on hover. It expands into Board / List / Timeline / Files. Archive sits at the end.
  5. **TEAMS**: Design, Engineering, Marketing, Product.
  6. Footer: Help & resources, Settings, and the user (avatar, name, presence dot, chevron).
- **Top bar**, about 44px: workspace icon › breadcrumb, then on the right "Search or jump to… ⌘K", a bell with a dot, "+ New ▾", and the avatar.
- Page header: title (24–28px, semibold) plus a muted one-line subtitle, with actions right-aligned on the same baseline.

## Clips A and C: the light "work OS" family (and still 3)
- **Canvas**: the app sits as a rounded (about 16px) white sheet inset in a warm light-grey frame. The sidebar is part of the frame colour. The content area is the white sheet.
- **Sidebar** groups: Essentials (Home, Tasks, Calendar, Teams, Docs, Automations, Reporting), Projects (coloured square icons), Management, Support (Settings, Releases), Apps (Trello, Figma). Group headers collapse with a chevron and have + and drag handles on hover. The active item is a **white pill with a hairline border**.
- **Home (C)**: a big light-weight title "Home" (about 40px, regular). Two buttons: **New Project (solid black)** and New Task (ghost). **Six KPI tiles**, each a bordered card with a tiny label, number, one-line context, and a footer line with an icon and trend ("+8% this week", "+23% efficiency", "Needs attention", "Spike after sprint planning"). "Ongoing Works" cards have a priority chip (High red / Low pink / Medium amber) plus tag chips, title, two-line description, a **vertical-bar mini chart** in the priority colour, and a checklist of milestones with small meta lines (Completion 75%, ETA July 10).
- **Calendar (A)**: title "Calendar" plus bell, Today, ‹ ›, and a black + button. A left **Today** panel with To-do list / Events tabs and collapsible buckets (This week / This month / Unschedule / Personal) of checkbox items. The week grid has a UTC+2 pill, day headers with large numerals, the active day underlined, an All-day row, and hour rows. **Events are soft grey cards with an emoji icon, title, time, avatar stack and an optional coloured CTA bar** (blue "Go to Zoom link", orange "Open Meet").
- **Settings › Team members (still)**: a tab row, four KPI cards with a ⋯ menu and trend footer, and a "Current Members (12)" list of rows with illustrated avatars, completed-task count, role, joined date and last active.

## Interaction patterns to carry over
1. **⌘K everywhere**: one palette for search, jump and commands, with type filters and recent/suggested items.
2. **"+ New ▾"** global creation, plus contextual "New task" buttons.
3. **New task modal** (still 2):
   - A title field auto-focused with an accent ring, and an optional description.
   - A **row of property chips** that open pickers: Project, Status, Assignee, Priority, Due date, Start date, Labels, Repeat.
   - Inline subtasks, a dashed drop zone for attachments, a "Create more" toggle, and a ⌘↵ hint.
4. **Views as tabs** on a project (Overview/Board/List/Table/Calendar/Timeline/Files/Activity). Views as a segmented switch on global lists (List/Board/Table, Grid/List/Table).
5. **Toolbar grammar**: Search, Filter, Sort: X, Group: Y, and a view switch, always in that order.
6. **Status system**: icon (hollow ring → half → check) plus colour, used identically in lists, boards, timeline and analytics.
7. **Empty and denied states** are designed: an icon, one sentence and one clear action.
8. **Theme and density** are user preferences (Light/Dark/System; Comfortable/Compact).
