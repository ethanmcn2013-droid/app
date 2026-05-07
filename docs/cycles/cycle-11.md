# Cycle 11 · Command palette + search

**Status:** in_progress · 2026-05-05

## Problem

Three productivity gaps. (a) The sidebar's "Search" link goes
nowhere. (b) The header has a Search button that does nothing.
(c) Once you have ~50+ tasks, scrolling the board to find one is
awful. Every modern workspace has a ⌘K command palette as the
primary navigation surface — it's the missing primitive that ties
everything together.

## Solution shape

**Frontend** — a `CommandPalette` primitive (`⌘K` / `Cmd+K` /
`Ctrl+K` / clicking sidebar Search). Centered modal with a search
input at the top and a results list below. Two result categories:
**tasks** (matched by title or description) and **navigation**
(jump to Board / List / Timeline / Calendar / My tasks /
Inbox). Keyboard-first: arrow keys navigate, Enter opens, Esc
closes. Click result → fires the right action: tasks open the
detail panel, navigation pushes the route.

**Backend** — `searchTasks(query: string, limit?: number)` query.
Case-insensitive LIKE on title + description. Returns matches
ordered by simple ranking (title-match outranks description-match;
recently-updated outranks older). A `searchTasksAction` server
action wraps it for the client. Debounced fetch in the palette
component (~120ms) so typing doesn't hammer the DB.

## Backend deliverable

- New `searchTasks(query, limit = 8)` query in
  `src/server/db/queries.ts`. Case-insensitive LIKE via
  `LOWER(...) LIKE LOWER(?)`. Returns `Task[]` with the same
  shape the rest of the app uses (so the palette can pass results
  straight into the panel via taskId).
- Ranking: title hits first (sorted desc by `updatedAt`),
  then description hits. `UNION ALL` with a synthetic priority
  column, OR two queries merged client-side in the action — the
  simpler, more readable path is two queries merged.
- New `searchTasksAction(query: string)` server action in
  `src/server/actions/search.ts`.

## Frontend deliverable

- New `src/components/primitives/command-palette.tsx` —
  `<CommandPalette>` primitive built on top of the existing
  `<Dialog>`. Owns input state + result list + keyboard
  navigation. Receives result items via render prop or typed
  groups.
- New `src/components/app/command/app-command-palette.tsx` —
  app-specific composer: wires `searchTasksAction` for tasks +
  static navigation entries. Consumes `useTaskPanel` to open
  task results, `useRouter` for nav.
- New `src/components/app/command/command-context.tsx` —
  `<CommandRoot>` provider mirroring the AddTaskRoot pattern.
  Owns open state. Binds `⌘K` / `Ctrl+K` shortcut globally.
- Sidebar "Search" link and header "Search" button wire to
  `openCommand()`.
- Mount `<CommandRoot>` in `/app/layout.tsx` alongside
  `<AddTaskRoot>`.

## Success criteria

- Press `⌘K` (or `Ctrl+K`) anywhere in `/app/*` → palette opens
  centered with focused input
- Type "demo" → results filter to tasks matching (e.g. "Launch
  demo video — final cut", "Sales demo sync")
- Arrow keys move highlight; Enter opens highlighted task in
  the detail panel; palette closes
- Type "calendar" → "Go to Calendar" nav result; Enter → router
  pushes `/app/calendar`
- Esc closes; backdrop click closes
- Empty query shows the navigation entries by default (palette
  is also a fast-nav surface)
- 0 TS errors, 0 console errors
- Cinematic demo on `/` is unaffected
- prefers-reduced-motion honored

## Out of scope

- Recent / pinned tasks at top
- Search across comments / activity content
- Fuzzy matching (LIKE substring is fine for this scale)
- Search-as-filter on /app/list (a future cycle could pipe
  search query into list view filter)
- Shortcuts inside the palette (e.g. `>>` for nav-only mode)

## Architect notes

(populated after Plan agent)

## Design notes

(populated after design agent)
