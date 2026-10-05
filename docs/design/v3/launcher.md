# Apps and tools, and Notes as a tool: v3 spec (revision 2)

Stream: LAUNCHER · worktree `worktrees/app/design-suite-redesign-v3` · 25 September 2026
Status: final spec, delegated decision inside the founder-approved v3 redesign sprint. One item needs a founder decision (section 12).
Supersedes: revision 1 of this file (24 September 2026), which shipped as the uncommitted first pass now in the worktree.
Before evidence: `.playwright-mcp/v3/core/launcher-before-*.png` at the workspace root (1440 light and dark, 390; popover, search, tools page, tool placeholder, Notes populated, open, review, restricted, first use, voice, error). The capture run logged no console errors. The "1 Issue" dev badge on the Notes error fixture is the intentional demo throw.

---

## 0. Which direction and why

This is revision 2 of a working build, not a greenfield design. Two concepts were written against the first pass.

- **A, clarity first.** "Everything has a place, and Notes starts with a blank page." Fix naming drift, the Messages tile jump, mobile keyboard pop, the two-row Notes filter chrome, the thin reader and the unexplained glyphs.
- **B, power first.** "One keystroke from anything." A launcher that works like a command surface with a preview pane, a Notes list you can act on without opening, a pinned capture bar, a live review count in the launcher, recents, and swipe gestures on phones.

| North star | A: clarity | B: power |
|---|---|---|
| 1. Experience | Calm and predictable. One name, one catalogue, one visible verb per pane (write, read, decide). Every decision is a named button. | Faster for regulars. Rows act in place, capture is always visible, and the launcher preview answers "what is this?" without leaving. |
| 2. Design | Fixes real defects in the shots (cut chips at 390, tile reflow, uppercase labels, cramped key legend). Visually conservative. | Stronger launcher craft: compact app cards, no redundant "Coming soon" chips, a real `<kbd>` legend, a mobile sheet with a drag handle. The 680px two-column popover is heavy for a navigation menu. |
| 3. First-time utility | Strong. A newcomer can say where things are and what to do with a thought. | Weaker in places. Hover-only actions, swipe gestures and a preview pane are power features first. |
| Honesty and safety | No new server reads. Drive reads a build flag only. | Adds a `listNotes()` read to navigation just to count, and a localStorage recents list. Both are defensible, neither is needed for the bar. |
| Cost and risk | Low. Evolves existing files, calls `use-notebook.ts` without changing it. | Higher. Swipe, the preview pane, click-to-caret editing and a new server action. |

**Verdict: A is the spine.** It wins on first-time utility and honesty, and it is the cheaper path to a finished surface. It is weaker than B on speed and delight, so we graft the B ideas that add pace without adding a new concept:

1. **A capture bar pinned at the top of the list** ("Write a note…", mic, photo, `N`). There is still one composer and one canvas. The bar is a door to the canvas, so capture is one step away even while a note is open (B).
2. **Row actions in place.** A focus-and-hover cluster on each row (Keep, Turn into task, More) as real, labelled buttons, plus `E`, `T` and `Delete` on the selected row while the list has focus. `T` only opens the send sheet, and Keep and Delete both have undo, so a stray key never sends or loses a private note (B, made safe).
3. **"In Tasks" instead of "Sent"** for the third view, matching `countLabel` (B).
4. **A save pill and a footer meta line in the reader** (words, captured, edited) (B).
5. **Compact 64px app cards, no per-card "Coming soon" chip under a "Coming soon" heading**, and a dashed eighth "Missing something?" card (B, and A for the eighth card).
6. **A highlighted-entry line in the launcher footer**, a light version of B's preview pane: the focused entry's one-line description, so a keyboard user learns what a Coming soon tool is without opening it.
7. **A mobile bottom sheet** with a grab handle, a Done button, scrim tap and drag to dismiss (B's interaction, A's no-autofocus rule).
8. **Prev and next on the tool placeholder**, with `[` and `]` (B).
9. **`G` then `A` opens the launcher**, and **`F` opens the Notes filter menu** (B). No existing shell sequence uses `G`.

**Rejected from B, with reasons.**
- The two-column 680px popover with a preview pane: it turns a menu into a page and duplicates `/app/tools/[slug]`. The footer description line (graft 6) covers the need.
- A live "8 to review" count in the launcher: it loads the whole notebook on navigation to produce one number. Follow-up for the Notes backlog once a count-only read exists.
- "Jump back in" recents in localStorage: seven apps do not need a recents row, and the sidebar already holds the everyday places.
- Swipe to keep or delete on phones: hidden gestures, and they fight the iOS back swipe. The reader's bottom bar covers the same actions.
- `?compose=1` on the New menu: with the canvas as the default right pane, `/app/notes` already lands on a blank page, so the pinned New menu link and its contract test stay as they are.
- A notes title rendered over the textarea with caret mapping (`caretPositionFromPoint`): see section 4.4 for the simpler display/edit swap we use instead.

**Rejected from A.** The mobile Filter "sheet" that carries the legend: the legend becomes a line inside the filter menu on all sizes instead, one place to learn it.

---

## 1. Goals

1. **One name, one catalogue.** "Apps and tools" is the only name for the launcher (trigger, sidebar row, crumb, page title, dialog label). The popover, the mobile sheet and `/app/tools` render the same catalogue from `launcher-catalog.ts`.
2. **Honest states only.** Three states exist: Open (a real app), Set up (Drive, only when the build flag is on) and Coming soon. Nothing ever says "Connected". Nothing fakes a working tool.
3. **Notes is a tool, not a place.** It leaves the sidebar, lives in Apps and tools and the New menu, and keeps every existing behaviour (type, voice, photo, extraction, review, send to Tasks, recovery, conflict handling, demo fixtures).
4. **Notes answers one question per pane.** Write (the canvas), read (the reader), decide (the decision bar and review session). Every decision is visible and named in words.
5. **First-time clarity, regular speed.** Every action has a visible button. The keyboard makes the same actions one keystroke for people who want it.
6. **No layout shift, no keyboard pop.** Tiles never reflow after paint. Touch screens never open the on-screen keyboard unasked.
7. **Both themes, AA everywhere.** Tokens only (`var(--v3-*)`). Text 4.5:1, non-text UI 3:1, measured in both themes.

## 2. Information architecture

```
Sidebar
  Home · Inbox · My tasks                       (primary, unchanged)
  Studio: Tasks · Timeline · Files · Analytics · Projects · Messages*
          Apps and tools   → /app/tools          (last Studio row, icon "apps")
  Projects: …                                    (unchanged)
Top bar
  crumbs … [Search or jump to ⌘K] [Inbox] [Apps and tools ▦] [+ New] [avatar]
  New menu: Task · Note (/app/notes) · Project · Message

Apps and tools catalogue (one data source, three renderings: popover, sheet, page)
  Your apps     Tasks · Timeline · Notes · Files · Analytics · Messages* · Projects
  Works with    Google Drive (Coming soon | Set up in Settings) · Google Sheets (Coming soon)
  Coming soon   Wedding planner · Student hub · Teacher toolkit · Process map ·
                Whiteboard · Docs · Forms          → /app/tools/[slug]
  Missing something?  → mailto hello@signalstudio.ie

Crumb for tool destinations: Signal Studio / Apps and tools / Notes
* Messages only when canShowMessagesForTools() is true (fails closed).
```

`TOOL_DESTINATIONS` in `shell-nav.ts` owns `/app/notes` and `/app/tools/*`, so active state and crumbs still resolve. `LAUNCHER_NAME = "Apps and tools"` is exported from `launcher-catalog.ts` and imported by `shell-nav.ts`, so the name cannot drift.

## 3. Layout per breakpoint

### 3.1 Trigger

A 36px icon button in the top bar between Inbox and New, with a 44px hit area (padding or `::before` extension). Icon `apps` (3x3 dots). `aria-label="Apps and tools"`, `aria-haspopup="dialog"`, `aria-expanded`. Open state: `--v3-selected` fill and `--v3-control-border` ring. Tooltip on fine pointers: "Apps and tools  G A". Visible at every width, including 390.

### 3.2 Popover (600px and wider)

Right-aligned under the trigger, 8px gap, 432px wide, `max-height: calc(100dvh - 72px)`. Header and search are pinned; the body scrolls with a 12px fade mask top and bottom when overflowing. Non-modal, no scrim. `--v3-surface`, 1px `--v3-border`, `--v3-radius-lg`, `--v3-shadow-pop`.

```
┌────────────────────────────────────────────┐
│ Apps and tools                   See all → │ 15/600 title · link 13/500
│ ┌────────────────────────────────────────┐ │
│ │ ⌕  Find an app or tool                 │ │ 40px, --v3-sunken, 3:1 ring on focus
│ └────────────────────────────────────────┘ │
│ Your apps                                  │ 12/600 --v3-text-3, sentence case
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐            │ 4-col grid, 92px cells,
│  │ ✓  │  │ ≡  │  │ ▤  │  │ ▢  │            │ 40px glyph tiles (--v3-fill),
│  Tasks  Timeline  Notes   Files            │ label 13/500, 2 lines max
│  ┌────┐  ┌────┐  ┌────┐                    │
│  │ ▥  │  │ ◌  │  │ ▣  │                    │ Messages slot: fixed size,
│ Analytics Messages Projects                │ skeleton until the gate answers
│ ────────────────────────────────────────── │
│ Works with                                 │
│ [△] Google Drive                Coming soon│ 52px rows: tile 32, name 14/500,
│     Keep Project files in your Drive       │ one line 13/400 --v3-text-2
│ [▦] Google Sheets               Coming soon│ pill: --v3-fill / --v3-text-2
│     Share task lists as a sheet            │
│ ────────────────────────────────────────── │
│ Coming soon                                │ 2-col rows, 48px, tinted tiles
│ [◎] Wedding planner  [🎓] Student hub       │ (--v3-project-n, glyph --v3-project-ink)
│ [📖] Teacher toolkit  [⇶] Process map        │ no status chip inside this section
│ [▭] Whiteboard       [▤] Docs              │
│ [☰] Forms                                  │
│ ────────────────────────────────────────── │
│ A shared canvas for rough ideas.           │ footer line: focused entry's description
│ Missing something? Tell us   ↵ open  esc   │ legend: real <kbd>, fine pointers only
└────────────────────────────────────────────┘
```

With a query: the three sections collapse into one ranked list (`rankLauncher`) of 48px rows with a live "3 results" count under the field. Each row shows icon, name, description and its state pill ("Open" is implicit, so apps carry no pill; tools and Works with rows carry "Coming soon" or "Set up"), because section context is gone. The first row is active. No results:

```
│  Nothing called "gantt" yet.               │
│  [Suggest it]   (mailto, subject carries the query, max 60 chars)
```

### 3.3 Mobile sheet (below 600px, or `pointer: coarse` at any width)

Modal bottom sheet. Scrim `--v3-scrim`. `max-height: 88dvh`, top radius `--v3-radius-xl`, footer padded with `env(safe-area-inset-bottom)`. The sheet sits above the dev toast in z-order.

```
┌──────────────── ▬ ────────────────┐ grab handle 36x4, 44px hit area
│ Apps and tools              Done │ title focused on open (tabIndex -1)
│ [⌕ Find an app or tool         ] │ NOT autofocused
│ Your apps                        │
│  ✓      ≡      ▤      ▢          │ 4 across, 72px cells, 44px+ targets
│ Tasks Timeline Notes  Files      │
│  ▥      ◌      ▣                 │
│ Analytics Messages Projects      │
│ Works with                       │ 1-col 56px rows
│ Coming soon                      │ 1-col 56px rows (2-col from 480px)
│ …                                │
│ See all apps and tools →         │ sticky footer, then
│ Missing something? Tell us       │ safe-area padding
└──────────────────────────────────┘
```

### 3.4 `/app/tools` (the page)

Page column: max-width 1180px, padding 28px 32px 56px (20px 16px 40px under 600px).

```
Apps and tools                                     [⌕ Find an app or tool   /]
Everything in Signal Studio, and what we are building next.   (15/400 --v3-text-2)

Your apps                                    compact 64px cards, 4 per row (3 at 900, 2 at 390)
[✓ Tasks · Plan and track the work] [≡ Timeline · …] [▤ Notes · …] [▢ Files · …]
[▥ Analytics · …] [◌ Messages · …] [▣ Projects · …]

Works with                                   2-col rows (1-col under 900)
[△ Google Drive · Keep Project files in your Drive   Coming soon]
[▦ Google Sheets · Share task lists as a sheet       Coming soon]

Coming soon                                  4-col cards, 168px, no status chip
┌──────────┐┌──────────┐┌──────────┐┌──────────┐
│◎ tinted  ││🎓        ││📖        ││⇶         │  tile 44, name 15/600,
│Wedding   ││Student   ││Teacher   ││Process   │  one line 13/400 --v3-text-2,
│planner   ││hub       ││toolkit   ││map       │  "See the plan →" 13/500 --v3-accent-text
└──────────┘└──────────┘└──────────┘└──────────┘  (always visible, not hover-only)
┌──────────┐┌──────────┐┌──────────┐┌ ─ ─ ─ ─ ─┐
│▭ White-  ││▤ Docs    ││☰ Forms   │ + Missing  │  dashed --v3-control-border,
│board     ││          ││          │ something? │  mailto, "Tell us what you need"
└──────────┘└──────────┘└──────────┘└ ─ ─ ─ ─ ─┘
```

At 390 the Coming soon cards become full-width 64px rows (tile, name, one line). The request card stays last and full width.

### 3.5 `/app/tools/[slug]` (one template for all seven)

A 720px reading column, centred, same page padding.

```
← All apps and tools                        ‹ Teacher toolkit   Docs ›   ([ and ])
[64px tinted tile]  Whiteboard   (Coming soon)          22/600 name · pill
                    A shared canvas for rough ideas.    15/400 --v3-text-2
────────────────────────────────────────────────────────
What it will do      • three bullets from the catalogue (15/1.6)
Until then           [Open Notes →] [Open Messages →]   (Messages swaps to Tasks when hidden)
[Tell us what you need]   primary, mailto subject "Whiteboard ideas"
Other tools on the way    chips linking to the other six
```

At 390: single column; the pager becomes one "Next: Docs →" link at the bottom; "Until then" buttons and the mailto are full width at 44px; the mailto button sits in normal flow (not sticky, so it never covers the bullets).

### 3.6 Notes, desktop (1100px and wider)

Full bleed inside the shell canvas. List pane 360px on `--v3-sunken` with a 1px `--v3-border` right edge. Main pane on `--v3-canvas`, reading measure 680px, centred, top padding 28px.

```
┌ list 360 ─────────────────────────────┬ main ─────────────────────────────────────────┐
│ Notes                          [⋯]    │ (nothing selected: the canvas)                 │
│ ┌──────────────────────────────────┐  │  New note                     22/600           │
│ │ ✎ Write a note…      [🎙][🖼]  N  │  │ ┌────────────────────────────────────────────┐ │
│ └──────────────────────────────────┘  │ │ Write the thought before it disappears…   │ │
│ [⌕ Search notes                   / ] │ │                                            │ │ 17/1.6, min 220px
│ [All 14 | To review 8 | In Tasks 6] F │ │                                            │ │
│ ┌ 8 notes waiting ─────────────────┐  │ │ [Type | Voice | Photo]     [Save note ⌃↵]  │ │
│ │ Keep, turn into a task, or delete│  │ └────────────────────────────────────────────┘ │
│ │                    [Start review]│  │  🔒 Only you can see your notes.               │
│ └──────────────────────────────────┘  │  More ways to capture ▸                        │
│ Today                              3  │                                                │
│▌Saturday wedding, Mara & Finn.   35m  │  Recently turned into tasks                    │
│ Ceremony 2pm in the orchard…  ✓       │  ✓ Confirm marquee sides   Open task →         │
│ Ask the venue whether the ba… 🎙 3h ● │  ✓ Book the string trio    Open task →         │
│      focus/hover → [✓ Keep][→ Task][⋯]│                                                │
│ Yesterday                          4  │                                                │
│ …                                     │                                                │
│ ───────────────────────────────────── │                                                │
│ ● Waiting  ✓ In Tasks   🔒 Private  ? │                                                │
└───────────────────────────────────────┴────────────────────────────────────────────────┘
```

- `F` next to the segmented control is the Filter button (icon plus label "Filter" at 1100+, icon only below). Active source filter: the button reads "Filter · Spoken" and a removable chip appears under the row.
- The list header `⋯` menu holds: Sort (Newest, Oldest), Deleted notes (only when `archivedNotes` exist), Keyboard shortcuts.
- Rows: 64px minimum, title 14/600 one line, snippet 13/400 `--v3-text-2` one line, right column time 12/500 tabular plus state glyph. Selected row: `--v3-row-selected` and a 2px `--v3-accent` left bar.

Reader (a note selected):

```
│  🎙 Spoken · 3 hours ago · 🔒 Private             Saved ·  [⋯]          │ meta 13/500 --v3-text-2
│                                                                        │
│  Ask the venue whether the ballroom can hold 140      22/600, up to 3 lines
│  for the reception, and whether the band can load in  17/1.6 body
│  before 4pm.                                                           │
│  ───────────────────────────────────────────                           │
│  Waiting for a decision                               13/600 --v3-text-2
│  [✓ Keep  E]   [→ Turn into task  T]   [🗑 Delete]     44px buttons, primary = Turn into task
│                                                                        │
│  (a note in Tasks shows instead:)                                      │
│  ✓ In Tasks · "Ask the venue whether…"          [Open task →]          │ receipt card
│  ──────────────────────────────────────────────────────────────────── │
│  38 words · captured 3 hours ago · edited 2 hours ago                  │ footer 12/500 --v3-text-3
```

Review session: the existing layout (progress "Review · 1 of 8" with bar, the card, Keep, Turn into task, Delete, Decide later, Done). It gains the end state in section 6.2.

### 3.7 Notes, 600 to 1099px

List 320px. Reader drops the footer meta. Below 900px, one pane at a time using the existing `onBack` and `data-notes-back`.

### 3.8 Notes, mobile 390x844

```
┌ ≡  Apps and tools / Notes   [⌕][🔔][▦][+][DO] ┐
│ Notes                                   [✎]   │ 44px new-note button (opens canvas)
│ [⌕ Search notes                            ]  │
│ [ All 14 | To review 8 | In Tasks 6 ] [⚲]     │ 3-segment fills the row, 44px Filter button
│ ┌ 8 notes waiting        [Start review] ┐    │
│ Today ─────────────────────────────── 3       │ sticky day header
│ Saturday wedding, Mara & Finn.        35m     │ 64px rows
│ Ceremony 2pm in the orchard…          ✓       │
│ Ask the venue whether the ball…  🎙 3h ●      │
│ …                                             │
│ ┌───────────────────────────────────────────┐ │ sticky bottom capture bar (exists):
│ │ Write a note…                  [🎙] [🖼]   │ │ 44px each, safe-area padding;
│ └───────────────────────────────────────────┘ │ root sets --notes-bottom-inset for the dev toast
└───────────────────────────────────────────────┘
```

- No legend or "Private to you" footer at this size; the legend lives in the Filter menu and privacy in the capture helper line.
- Reader: full screen; a "‹ Notes" back row (history back); meta line restored; title; body; sticky bottom bar `[Turn into task]` (primary, flexible) `[Keep]` `[⋯]`. Delete lives in `⋯`, away from the thumb.
- Review: card on top, actions pinned to the bottom (Turn into task full width, then Keep and Delete as halves), with bottom padding of `calc(72px + env(safe-area-inset-bottom))` so the dev "In development" pill cannot cover Keep and Delete.
- Body text 15px or larger, meta 13px or larger, every control 44px or larger (CSS module px values or `min-h-[44px]`, never `min-h-11`).
- `scrollWidth === clientWidth` at 320 and 390.

## 4. Components and files

### 4.1 Launcher, `src/components/shell/launcher/**` (evolve, no new deps)

- **`launcher-catalog.ts`**. Keep data, ranking and mailto helpers. Add `export const LAUNCHER_NAME = "Apps and tools"` and `export const COMING_SOON_LABEL = "Coming soon"`, used by every rendering (drop "Soon"). `driveRowState` label becomes "Set up in Settings" (the arrow is visual). Keep: no `https://` in the catalogue, one mailto host, `shortLine` 26 characters or fewer.
- **`apps-launcher.tsx`**. Trigger plus open state. Changes:
  - Prefetch `launcherMessagesEnabled()` once per session on `requestIdleCallback` after mount (fallback `setTimeout(…, 1500)`), and on trigger `pointerenter` / `focus` if not yet resolved. Cache the promise in a module variable. Failure resolves to false.
  - Presentation chosen at open time with `matchMedia("(max-width: 599px), (pointer: coarse)")` (an event handler, so no hydration mismatch): `popover` or `sheet`.
  - `G` then `A` (400ms window) opens it. Ignored in inputs, textareas, `[contenteditable]`, and while any `[role=dialog][aria-modal=true]` or the command palette is open.
  - Focus: popover focuses search; sheet focuses the title (`tabIndex={-1}`).
- **`launcher-panel.tsx`**. One component, `variant: "popover" | "sheet" | "page"`. Split into local subcomponents in the same file or siblings: `LauncherSearch` (input, clear button, live count), `LauncherSections`, `LauncherResults`, `LauncherFooter` (description line plus `<kbd>` legend, fine pointers only, not on `page`). Messages slot: while unknown, a fixed-size `aria-hidden` skeleton tile; when resolved false, the slot is removed (before first open in almost every case thanks to the prefetch). Page variant renders the eighth "Missing something?" card.
- **`launcher-sheet.tsx`** (new, only if the panel file grows past ~650 lines). Sheet chrome: scrim, handle, drag to dismiss, focus trap, `inert` on the app root siblings, body scroll lock. Follow the shell mobile drawer pattern in `app-shell.tsx`; no dependency.
- **`tool-placeholder.tsx`**. Shared `COMING_SOON_LABEL`; prev/next pager in `TOOL_ENTRIES` order with `[` and `]`; mailto button uses `--v3-accent` / `--v3-on-accent` (measure dark: the current lavender with white label looked under 4.5:1). Export `ToolRequestCard` for reuse on `/app/tools`.
- **`launcher-icons.tsx`** keeps its nine glyphs. **`shell-icons.tsx`**: add `filter` if Notes needs it from the shell set; otherwise Notes uses its own `icons.tsx`.
- **`launcher.module.css`**. Pure selectors, tokens only. Remove the `.keyLegend` chip style ("↑↓←→"), add `.kbd`, `.footerLine`, `.skeletonTile`, `.sheet*`, `.requestCard`.

### 4.2 Routes, `src/app/app/tools/**`

`page.tsx` (metadata "Apps and tools · Signal Studio"), `[slug]/page.tsx` (unknown slug calls `notFound()`), `loading.tsx` (grid skeleton matching 3.4), `messages-gate.ts`, `launcher-actions.ts`: all stay. Both pages keep `requireAppAccessTasks`. The Messages gate keeps failing closed. No new server action.

### 4.3 Shell (data and CSS only)

- **`shell-nav.ts`**: `{ id: "tools", label: LAUNCHER_NAME, href: "/app/tools", icon: "apps", owns: ["/app/tools"] }`; crumb `{ label: LAUNCHER_NAME, href: "/app/tools" }` (rename `MORE_TOOLS` to `APPS_AND_TOOLS`). Notes stays in `TOOL_DESTINATIONS`. If the contract test must read a literal, keep the literal `label: "Apps and tools"` in `shell-nav.ts` and assert parity with `LAUNCHER_NAME` in `launcher-catalog.test.ts`.
- **`shell.module.css`**: remove `text-transform: uppercase` and the letter-spacing from the sidebar section label (around line 155) and `.menuLabel` (around line 376). Sentence case, 12px/600, `--v3-text-3`. `app-sidebar.tsx` is not touched (Messages stream owns it). The labels in JSX must already be sentence case; if one is written in capitals in source, flag it to the Messages stream rather than editing the file.
- **`app-shell.tsx`**: New menu keeps `<Link href="/app/notes" role="menuitem">` unchanged. No other change.

### 4.4 Notes, `src/modules/notes/app/workspace/**` plus `src/modules/notes/lib/notes-copy.ts` and `notes-view-model.ts`

`use-notebook.ts`, server actions, extraction, recovery, `EarlyCaptureBootstrap.tsx` and demo fixtures are **called, never changed**.

- **`NotesWorkspace.tsx`**: orchestration and all `use-notebook` wiring stay here. It keeps the `/` handler with `event.key === "/"`, `aria-keyshortcuts="/"`, `className={styles.searchKey}` and the `taskFocusPath` import (all pinned by `suite-navigation-contract.test.mjs`). Changes: view segmented control ("All", "To review", "In Tasks"), Filter button, list header `⋯` menu, review banner copy, list footer legend, capture bar, row action cluster and list keys (`E`, `T`, `Delete`, `F`, `N`). Capture-by-email leaves the list chrome (line ~1281 `captureUpsellHint`).
- **`NotesList.tsx`** (new): rows and day groups (`groupByDay`), `content-visibility: auto` with `contain-intrinsic-size: auto 64px` on each group. Receives handlers; owns no state beyond hover.
- **`NoteRow.tsx`** (new, or inside `NotesList.tsx`): title, snippet with `<mark>` highlights (`searchSnippet`), source glyph, `compactDate`, state glyph (● waiting, ✓ In Tasks, spinner pending, ! failed from `mutationStates`), and the action cluster: `[✓ Keep]` `[→ Turn into task]` `[⋯]`. Cluster is visible on hover, on row focus-within and on the selected row; on touch it is not rendered (the reader carries the actions).
- **`CaptureBar.tsx`** (new): the collapsed pinned bar. Click or `N` clears the selection (`notesHref(view, null)`) and focuses the canvas composer; mic and photo buttons do the same and switch the composer into Voice or Photo (existing consent flow first). On mobile this is the existing sticky bottom bar, restyled.
- **`NotesFilterMenu.tsx`** (new): single-select source (All sources, then Written, Spoken, Photos, Email, each listed only when its count from `sourceCounts` is above zero, with the count), then the legend line ("● Waiting for a decision · ✓ In Tasks"). Menu-button pattern, Escape returns focus.
- **`NoteReader.tsx`**: meta line; title plus body in **display mode** (an `h2` from `readerTitle(body)` and the rest as paragraphs, inside a focusable region with `role="button"`, "Edit note" label); **edit mode** on click or Enter swaps in the existing textarea with the full body, caret at the end, 17/1.6, same measure. Blur or Escape returns to display. Autosave through `notebook.saveDetail` (debounced as today, version checked). Save pill bound to `detailStatus`: "Saving…", "Saved" (fades after 1.2s), "Not saved. Retry" (a button, persistent). Conflict banner, `queuedEdit` and receipt card unchanged. Decision bar for waiting notes: Keep (`notebook.markReviewed`, undo toast), Turn into task (existing send flow and sheet, title from `deriveTaskTitle`), Delete (archive with undo, `restoreArchivedNoteForHybrid`). Sent notes: "In Tasks" receipt and "Open task" via `taskFocusPath(promotedTaskId)`. Footer meta (`wordCount`, captured, edited). Read-only or demo mutations: buttons disabled with the reason as visible helper text.
- **`Composer.tsx`**: behaviour unchanged. Visual: segmented Type / Voice / Photo, Save button, `⌃↵` hint only for fine pointers. Voice unavailable: the Voice segment is disabled and the reason is visible helper text under the control.
- **`ReviewSession.tsx`**: keep. Add session counters (kept, turned into tasks, deleted) in component state and the end state copy. Bottom padding fix at mobile.
- **`NotesDialogs.tsx`**: send sheet, delete confirm and shortcuts sheet unchanged in behaviour; the shortcuts sheet lists the new keys.
- **`notes-workspace.module.css`**: rewritten against `var(--v3-*)` only, pure selectors.
- **`src/modules/notes/app/loading.tsx` + `loading.module.css`**: skeleton matching the new frame (capture bar, search, segmented control, banner, 6 rows, canvas block).
- **`src/modules/notes/app/error.tsx`**: copy kept.
- **`CaptureEmailRow.tsx`**: moved, not renamed. Rendered inside the canvas's "More ways to capture" disclosure. `CAPTURE_EMAIL_PLAN` stays verbatim (section 12).
- **`notes-view-model.ts`** (pure, tested): add `readerTitle(body)` (from `derivePresentation`, never empty: falls back to "Untitled note"), `readerRest(body)`, `wordCount(body)`, `activeSources(counts)` (sources with count above zero, in fixed order).
- **`notes-copy.ts`**: all new strings from section 10. "Sent" as a visible label is removed everywhere; the internal view id stays `sent`.

## 5. Interactions and keyboard map

### 5.1 Launcher

| Input | Result |
|---|---|
| Click, Enter, Space on trigger | Open. Popover focuses search; sheet focuses title. |
| `G` then `A` (outside fields and dialogs) | Open. |
| Typing | Sections collapse into a ranked list; count announced politely; first result active. |
| `↑` `↓` `←` `→` (no query) | 2D across the app grid (4 columns in popover and sheet), then linear through rows. Coming soon's two columns move 2D too. |
| `↑` `↓` (query) | Move through results. |
| `Home` / `End` | First / last entry. |
| `Enter` | Open the active entry. |
| `Tab` | Search, then list, then footer links, then out (closes the popover). |
| `Escape` | Clear the query if there is one; otherwise close and return focus to the trigger. |
| Outside pointer, route change, focus leaving | Close without moving focus. |
| Sheet: scrim tap, Done, drag handle down past 30% or 0.5px/ms | Close, focus returns to trigger. |

Pattern: combobox. The search input has `role="combobox"`, `aria-controls` the list, `aria-activedescendant` the active option, so focus stays in the field while arrows move. Without a query, entries are a `role="listbox"` grouped with `role="group"` and `aria-labelledby` the section heading. The current app carries `aria-current="page"` and a 2px `--v3-accent` underline. Focused entry description goes to the footer line (visual; the option already has `aria-describedby` its description).

### 5.2 `/app/tools` and placeholders

`/` focuses the page search. Cards are links in normal tab order (no roving tabindex; a page is not a widget). On `/app/tools/[slug]`, `[` and `]` go to previous and next tool, ignored in fields.

### 5.3 Notes (ignored while typing in a field, and while any dialog or menu is open; `?` shows them all)

| Key | Where | Result |
|---|---|---|
| `N` | page | Clear the selection and focus the canvas composer (draft kept). |
| `⌃/⌘ Enter` | composer | Save. New row grows in at the top of Today, 600ms `--v3-accent-soft` wash; composer clears and keeps focus; live region "Note saved". |
| `/` | page | Focus search (contract pinned). `↓` from search moves into results. |
| `F` | page | Open the Filter menu. |
| `J` / `K`, `↓` / `↑` | list | Move the selection (existing). |
| `Enter` / `O` | list | Open in reader and move focus there. |
| `E` | list, selected row | Keep. Dot morphs to nothing (reviewed), undo toast 6s. |
| `T` | list or reader | Open the send sheet for that note. Never sends without the sheet. |
| `Delete` / `Backspace` | list, selected row | Delete with undo toast 6s. |
| `Escape` | reader | Leave edit mode; second press returns focus to the list row. |
| `R` | page | Start review (only when waiting notes exist). |
| `K` `T` `L` `Backspace` | review session | Keep, Turn into task, Decide later, Delete (existing, scoped). |
| `?` | page | Shortcuts sheet. |

`K` stays navigation in the list; Keep is `E` there, so no collision with the review deck's scoped `K`. `⌘K` stays with the suite palette (contract pinned).

Views change the URL (`?view=`, `notesHref`) and clear the selection; back and forward restore them (existing popstate). Row click opens `?note=id`.

## 6. States

### 6.1 Launcher

- **Default**: 7 apps (6 when Messages is off), 2 Works with rows, 7 Coming soon tools, footer.
- **Messages unknown**: fixed-size skeleton slot, no reflow. **False or failed**: slot removed (fail closed).
- **Drive**: flag off "Coming soon" (a static row, not a link). Flag on "Set up in Settings", links to `/app/settings`. Never "Connected".
- **Sheets**: always "Coming soon", static row, not a link.
- **Search, no results**: "Nothing called "x" yet." plus "Suggest it" (mailto carries only the query, 60 characters max).
- **Overflow**: body scrolls with fade masks; names never truncate (catalogue guarantees `shortLine` ≤ 26).
- **Permission-limited**: no Tasks access never reaches `/app/tools` (`requireAppAccessTasks`). Apps the viewer cannot use are not listed. Placeholder "Until then" swaps Messages for Tasks when hidden.
- **Loading** (`/app/tools`): grid skeleton. **Unknown slug**: standard 404.
- **Dark**: tokens only; tiles `--v3-project-n` with `--v3-project-ink` glyph; pills `--v3-fill` with `--v3-text-2`.

### 6.2 Notes (each maps to an existing demo fixture)

- **First use / empty (0 notes)**: list pane shows only the capture bar and "Your notes will appear here." No views, filter, banner or legend. Canvas holds the composer, the privacy line and three quiet tips: "Type it and press Ctrl Enter", "Say it out loud", "Photograph a page". The first save hides the tips.
- **Few notes (under 5)**: tips collapse to one line under the canvas.
- **Populated, nothing selected**: canvas plus "Recently turned into tasks" (last 3 sent notes, each "Open task →"); section omitted when none.
- **Waiting notes**: banner in All ("8 notes waiting"), ● on rows, decision bar in reader.
- **To review, empty**: "Nothing waiting. New notes land here until you decide what they are." plus "Write a note".
- **In Tasks, empty**: "Notes you turn into tasks show up here, with a link to the task."
- **Search, no match**: "No notes match "x"." plus "Clear search". **Filter, no match**: "No spoken notes yet." plus "Show all".
- **Saving / saved / failed**: pill as in 4.4, `aria-live="polite"`.
- **Offline**: "You're offline. This note is saved on this device and will sync." (existing early capture and recovery path).
- **Capture failed**: composer keeps the text, inline "Didn't save. Try again". Idempotent create means no duplicates.
- **Voice unsupported or denied**: Voice segment disabled with visible reason ("Your browser doesn't allow the microphone here").
- **Photo unavailable**: Photo segment disabled with visible reason.
- **Send pending / failed**: row spinner, then the existing recovery prompt.
- **Delete**: undo toast; undo restores the note in place.
- **Conflict**: existing banner, "This note changed somewhere else", keep mine or use theirs.
- **Capture not allowed** (Project unavailable or archived): capture bar and composer disabled with the existing message; reading, search and review still work.
- **Read-only or demo mutation block**: action buttons disabled with visible reason.
- **Tasks catalogue unavailable**: Turn into task opens the send sheet's existing unavailable state.
- **Restricted (no email capture)**: the "More ways to capture" disclosure shows the email row as unavailable with the plan link. **capture-email fixture**: address with Copy.
- **Partial failure**: existing status aside as an inline warning banner above the list (`--v3-warning-soft`, `--v3-warning-text`); capture still works.
- **Review finished**: "All caught up. 5 kept, 2 turned into tasks, 1 deleted." (zero parts omitted) plus "Back to notes".
- **Loading**: frame skeleton, no shift on arrival. **Error**: existing boundary, "Notes did not load. Your notes are safe." plus reference and "Try again".
- **Long content**: list title 1 line, reader title up to 3 lines then the rest flows into the body; `overflow-wrap: anywhere`.
- **Dense (500+)**: `content-visibility: auto` on day groups; sticky day headers with counts.

## 7. Motion

All transform and opacity, `var(--v3-ease)`. Under `prefers-reduced-motion: reduce`, everything becomes a 100ms opacity fade or nothing.

| Element | Motion |
|---|---|
| Popover open | Scale 0.98 → 1 and opacity from the trigger's top-right corner, 160ms. Close 120ms. |
| Launcher tiles | Stagger 12ms, capped at 8, opacity plus 4px rise. First open per page load only. |
| Coming soon icon hover | 1.5° wiggle, 240ms, once (motion-safe). |
| Sheet | Slide up 240ms; drag follows the pointer; release closes or springs back 200ms. |
| Search collapse | Sections cross-fade into results, 120ms. No height animation. |
| New note row | Height 0 → 64px 180ms, then 600ms `--v3-accent-soft` wash. |
| Keep (row) | ● fades and scales to 0, 200ms. |
| Reader display ↔ edit | 120ms cross-fade. |
| Save pill | Fade in, "Saved" fades out after 1.2s. |
| Review deck | Card moves 24px towards the decision and fades 180ms; next card rises from 8px peek 200ms. |
| Row action cluster | Opacity 0 → 1, 120ms. |

## 8. Accessibility

- Launcher: combobox plus listbox pattern (5.1); popover is non-modal `role="dialog"` with `aria-label="Apps and tools"`; sheet is `aria-modal="true"` with focus trap and `inert` background. Focus always returns to the trigger on close by keyboard.
- Live regions: search result count, save pill, "Note saved", undo toasts (existing toast region). All polite.
- Every icon-only button has an `aria-label`; every keyboard shortcut is also reachable by a visible control and listed in `aria-keyshortcuts` where it applies.
- Row actions are buttons inside the row, not the row itself; the row is a link or button with the note title as name, and state glyphs have text alternatives ("Waiting for a decision", "In Tasks").
- Contrast measured with a script (not by eye) in both themes: text 4.5:1 (pills, footer line, meta, tinted tile names), non-text 3:1 (search ring, segmented control edge, request card dashed border, tile edges).
- Targets 44px on touch; focus ring is the global `:focus-visible` rule (unlayered, wins over utilities).
- No uppercase tracked labels, no monospace micro-labels. Never "Workspace" or "workspace" in JSX text or aria-labels (`vocabulary.test.ts`); `CaptureEmailRow.tsx` stays the only allow-listed file.

## 9. Data needs and honesty rules

- Catalogue: static, in `launcher-catalog.ts`. No network for the catalogue.
- Messages gate: existing `launcherMessagesEnabled()` (boolean only, fail closed, demo short circuit). Prefetched, cached per session.
- Drive: build flag only (`driveRowState`). No per-Project status read in navigation.
- Sheets: static "Coming soon". Never linked to anything that implies it works.
- Notes: existing `use-notebook.ts` state and server actions only. No new server read, no schema change, no new dependency.
- Mailto: only `hello@signalstudio.ie`; the subject carries only the tool name or the typed query (max 60 characters). Nothing about the viewer.
- Review and demo mode never touch the database (`src/lib/access-mode.ts`); nothing in this spec adds a path that could.

## 10. Copy

Launcher and tools
- Name: "Apps and tools". Search placeholder: "Find an app or tool". Header link: "See all". Sheet footer: "See all apps and tools".
- Sections: "Your apps", "Works with", "Coming soon".
- States: "Coming soon", "Set up in Settings". Results: "1 result", "3 results". No results: "Nothing called "x" yet." · "Suggest it".
- Footer: "Missing something? Tell us". Legend: `↵` "open", `esc` "close".
- Page intro: "Everything in Signal Studio, and what we are building next." Request card: "Missing something?" / "Tell us what you need".
- Placeholder: "What it will do", "Until then", "Tell us what you need", "Other tools on the way", "All apps and tools".

Notes
- Views: "All", "To review", "In Tasks". Filter: "Filter", "All sources", "Written", "Spoken", "Photos", "Email". Sort: "Newest first", "Oldest first".
- Capture bar: "Write a note…". Canvas title: "New note". Placeholder: "Write the thought before it disappears…". Save: "Save note". Privacy: "Only you can see your notes." Disclosure: "More ways to capture".
- Banner: "8 notes waiting" / "1 note waiting", "Keep, turn into a task, or delete.", "Start review".
- Legend: "Waiting for a decision", "In Tasks", "Private to you".
- Reader: "Waiting for a decision", "Keep", "Turn into task", "Delete", "In Tasks", "Open task", "Saving…", "Saved", "Not saved. Retry", "Edit note", "38 words · captured 3 hours ago · edited 2 hours ago".
- Recent section: "Recently turned into tasks".
- Empty and state lines: as written in 6.2.
- Row action labels: "Keep", "Turn into task", "More actions for this note".

All copy passes `node scripts/check-first-contact-language.mjs`.

## 11. What gets deleted

- The label "More tools" everywhere (sidebar row, crumb, contract regex, comments).
- The "Soon" short status label.
- The "↑↓←→" key legend chip and its CSS.
- The second Notes filter row (source chips and inline sort control).
- "Sent" as a visible Notes label.
- The capture-by-email row and "Workspace plan" badge from the Notes list footer (moved, not removed).
- Uppercase and letter-spacing on shell section labels and `.menuLabel`.
- Search autofocus on touch.
- Any CSS in `notes-workspace.module.css` and `launcher.module.css` left unused after the rebuild.

## 12. Decision for the founder

**"Workspace plan" as a visible plan name in Notes.** `CAPTURE_EMAIL_PLAN = "Workspace plan"` names a billing plan and clashes in spirit with the rule that the noun is "Project". Renaming a plan is pricing and positioning, so it is a founder gate. This spec moves the row out of the always-visible list chrome into "More ways to capture" and leaves the string verbatim. Decision-ready request: keep "Workspace plan", or rename the plan (for example "Team plan") across pricing, billing and this row.

## 13. Acceptance checklist

Naming and navigation
- [ ] "Apps and tools" is the trigger aria-label, sidebar row, crumb, page h1, dialog label and page metadata; "More tools" appears nowhere in `src/`.
- [ ] Sidebar has no Notes row; `TOOL_DESTINATIONS` owns `/app/notes`; crumb on `/app/notes` reads "Signal Studio / Apps and tools / Notes".
- [ ] New menu still has `<Link href="/app/notes" role="menuitem">`.
- [ ] Sidebar section labels render in sentence case with no letter-spacing.

Launcher
- [ ] Popover opens from click, Enter, Space and `G` `A`; Escape clears then closes; focus returns to the trigger.
- [ ] No tile reflow after first paint (Messages slot fixed); measured at 390 and 1440.
- [ ] Touch and under 600px: bottom sheet, search not focused, focus trapped, scrim and Done close it.
- [ ] Typing `tim` Enter opens Timeline; `miro` Enter opens the Whiteboard placeholder; `zzzq` shows "Suggest it".
- [ ] Drive never says "Connected"; Sheets is not a link.
- [ ] One status label ("Coming soon") across popover, sheet, page and placeholder; no chip inside the Coming soon section.
- [ ] `/app/tools` shows the eighth request card; `/app/tools/nope` is a 404; `[` `]` page through tools.
- [ ] Placeholder mailto button measures 4.5:1 in both themes.

Notes
- [ ] One filter row at every width; no horizontal scroll at 320 and 390.
- [ ] Capture bar visible with a note open; `N` lands in the canvas with the draft kept.
- [ ] Reader shows meta, title, body, save pill, decision bar with Keep, Turn into task, Delete named in words; mobile reader keeps the meta line.
- [ ] `E`, `T`, `Delete` on the selected row work, with undo for Keep and Delete, and `T` only opens the sheet.
- [ ] Review end state counts decisions; mobile review buttons are not covered by the dev pill.
- [ ] Every fixture renders: populated, empty, loading, error, restricted, capture-email, first capture, voice.
- [ ] Legend explains ● and ✓; capture-by-email lives in "More ways to capture".

Quality gates
- [ ] `pnpm typecheck` clean for launcher and Notes files; `pnpm lint` clean for them (no setState in effect bodies).
- [ ] `node --test src/server/suite-navigation-contract.test.mjs` passes with the updated "Notes lives in Apps and tools" test; all Notes privacy and send assertions unchanged.
- [ ] Vitest: `launcher-catalog.test.ts`, `notes-view-model.test.ts`, `notes-copy.test.ts`, notes hybrid and recovery tests, `vocabulary.test.ts`.
- [ ] `node scripts/check-first-contact-language.mjs` and the tap-target gate pass.
- [ ] After screenshots at 1440 light and dark and 390 light for every surface and state above, saved under `.playwright-mcp/v3/core/launcher-after-*.png`; no framework overlay; no console errors except the documented demo error throw.
- [ ] No edits to `drizzle/**`, `scripts/db/**`, `pnpm-lock.yaml`, `vercel.json`, `.github/workflows/deploy.yml`, `app-sidebar.tsx`, or other streams' files; no new dependency.
