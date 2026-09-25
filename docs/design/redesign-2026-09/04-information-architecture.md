# 04 · Information architecture: one persistent shell

## Sidebar (every signed-in page, desktop and tablet; a drawer on mobile)

```
[Signal Studio logo] Signal Studio ⌄          [⇤ collapse]
  Search or jump to…                       ⌘K   (opens palette; "/" also focuses)

  Home
  Inbox                                    (●4)   attention + mentions + digest
  My Tasks                                    7
  Favorites

WORKSPACE
  Overview            analytics / portfolio health
  Projects
  Tasks               all tasks: List / Board / Table / Calendar / Timeline
  Notes
  Messages            project rooms + task discussions (internal chat)
  Files               every native + Drive file across projects (NEW page)
  Calendar            (can live as a Tasks view first)

PROJECTS                                        +
  ■ Production canary 23 Sep   ☆  •
      Board · List · Timeline · Messages · Files
  ■ Sept 1st Launch
  ■ …
  Archive

──────────────
  Help & resources
  Settings
  (avatar) Ethan McNamara   ⌄   → profile, account settings, Theme L/D/System, shortcuts, sign out
```

**Top bar (44–48px):** breadcrumb (Signal Studio › Section › Object), then on the right "Search or jump to… ⌘K", the notifications bell, "+ New ▾" (Task, Project, Note, Message, Upload file) and the avatar.

## How today's routes map

| New place | Today's route(s) | Notes |
|---|---|---|
| Home | `/app/home`, `/app/home/briefing` ("Today's signal") | Merge into one Home: greeting, KPIs, My tasks, Upcoming deadlines, Project progress, Signal briefing card, Recent activity. |
| Inbox | `/app/inbox` | Project attention, stuck work, daily digest, direct alerts, as one feed in the Notifications style (`key-frames/17`). |
| My Tasks | `/app/my-tasks`, `/app/your-work` | Two routes today; merge into one. |
| Overview (analytics) | `/app/signal` (redirects today), `/app/home/briefing`, analytics snapshots (`src/modules/signal`) | Portfolio table, tasks by status, workload, trends (`key-frames/18`). |
| Projects | `/app/project`, project chooser, `/app/archived` | Grid/List/Table (`key-frames/21`). Project page with tabs (`key-frames/20`). |
| Tasks | `/app/tasks`, `/app/tasks/list`, `/app/tasks/calendar`, `/app/tasks/timeline` | One Tasks page with a view switch. **Keep the Kanban board**, restyled only. |
| Task detail | `/app/task/[id]` (panel) | Side panel or full page: properties as chips, description, subtasks, Resources (files), Conversation. |
| Notes | `/app/notes` | Capture, notebook, review, In Tasks. |
| Messages (chat) | `/app/messages?projectId=…` | Project rooms plus Task discussions. Two panes: rooms list, then thread. |
| Files | *(none yet)* | Aggregates task Resources (native attachments + Google Drive files) per project, with filters by project, type and uploader. Needs one read query; upload and download already exist. |
| Timeline | `/app/timeline`, `/app/timeline/[project]`, `/app/timeline/audience` | The Gantt-style plan plus share manager. Second wave. |
| Settings | `/app/settings` (+ notifications sub-routes) | Second-level nav (`key-frames/28–32`): Workspace, Appearance, Members, Connections (Google Drive), Notifications, Profile, Privacy and data export, Security. |
| Import | `/app/import` | Under Settings › Workspace or "+ New". |

**Remove as navigation:** per-product headers ("home•", "tasks•", "notes•", "timeline•", "projects•"), the desktop bottom tab bar (Home · Projects · Tasks · Timeline · More), and "Choose a project" as the main switcher. The Project context lives in the sidebar and the breadcrumb.

## Mobile (≤ 768px)
- The sidebar becomes a left drawer from a hamburger in the top bar.
- A compact bottom bar with **four** items (Home, Tasks, Inbox, Search) plus "+" is acceptable on phones only.
- Lists keep the same row anatomy with secondary columns dropped; boards scroll horizontally, one column per viewport.
