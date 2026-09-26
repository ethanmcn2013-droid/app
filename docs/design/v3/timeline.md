# Timeline and All projects: v3 spec (round 2)

Stream: TIMELINE · worktree `worktrees/app/design-suite-redesign-v3` · 25 September 2026
Status: final spec, delegated decision under the founder-approved v3 redesign sprint. Items that need the coordinator are marked **[coordinator]**.
Supersedes: the round 1 spec of 24 September (the same file). Round 1 was built, and this round judges that build.

Before evidence (workspace root, `.playwright-mcp/v3/core/`):
- All projects: `timeline-before-A-all-1440-{light,dark}.png`, `-all-390-light.png`, `-all-today-light.png`, `-all-hover-light.png`.
- One plan: `timeline-before-A-plan-1440-{light,dark}.png`, `-plan-390-light.png`, `-plan-panel-light.png`, `-plan-share-light.png`, `-plan-bottom-light.png`.
- Shared pages: `timeline-before-audience-1440-light.png`.

Review mode runs on the pinned review clock, so "today" in every example below is **Thu 16 Jul 2026**.

---

## 0. Verdict: which direction, and why

Two concepts judged the round 1 build:
- **A, "Read it like a calendar".** Clarity first: answer first, one time language, one obvious action.
- **B, "The instrument".** Power first: one canvas at two altitudes, a keyboard grammar, an action menu, an inline ledger and inspector.

Both are right about the data layer. It is sound and stays. Both diagnose the same five presentation failures, and I confirmed each one on the before screenshots:
1. All projects stacks four bands (sample notice, counts, colour strip, "Needs a look") above the chart. The axis starts at y≈400, so only 5 rows fit at 900px.
2. The server paints Dec 2025 to May 2026, then the client jumps to today (scrollLeft 885). A first look, a slow device or a screenshot sees no Today line and bars cut off. On mobile, rows show empty grid.
3. The switch "All projects | Mara & Finn" puts a plan name where a Project name belongs. "Mara & Finn" is a plan inside "The Orchard, events".
4. The hover card covers the rows the reader is comparing.
5. The plan strip spends about 60% of its width on a finished past and packs 7 of 10 diamonds into the last quarter. The share sheet is a wall of policy text, and "Switch every link off" looks as safe as "Make a new link".

Scored against the north star, in its order:

| | A: calendar | B: instrument |
|---|---|---|
| 1. Experience | One sentence answers the page ("Kavanagh wedding needs a look"), with one next step. Calm enough for a couple or a teacher. The context column shows **what guests will see** as a live phone preview, which is the emotional centre of the product. | Fast and precise for a daily operator. Direct manipulation, the action menu and a consistent keyboard grammar feel like Linear. On first contact it is a canvas, a ledger, an inspector, a health bar, density and resize controls all at once. |
| 2. Design | Strong hierarchy and restraint. Status filter chips replace three bands. Two ideas are weaker in craft: the bars have no ring, which risks 3:1 in dark mode, and the mobile Gantt is optional. | The stronger craft: one shared canvas primitive, a ring on bars, edge chevrons with dates, a past wash, two-tier ticks, a danger zone in the share sheet, and a v3 restyle of the Shared pages. |
| 3. First-time utility | Strongest. A legend drawn with the real marks, filter chips with words, "Show it", tabs that lead with the Project, and plain share states. | Weaker. The health bar is colour-first, many single-letter keys do the work, and rows carry six columns. |
| Honesty and risk | Low risk. It keeps `use-milestone-edits.ts` untouched and fixes first paint at the root. **Wrong on one fact:** it offers "[Create a link]" from Private, but the first publish goes through choosing what to share (`manageHref`), and a link only exists in the reply of the action that made it. | Also reuses every write path. Correctly treats bars as read-only. **Right on the same fact:** a link is shown once, so the primary action for a live page is "Make a new link". |

**Decision: A is the spine.** It answers the founder's framing: "how each of them are looking at a glance", calm enough for a wedding or a school term, understood unaided. B loses on first-time utility, which the north star ranks above power. Its best ideas cost nothing in clarity, so these are grafted:

1. **One shared canvas primitive** (`timeline-canvas.tsx`) under both altitudes: axis, ticks, today line, past wash, weekend shading and a scroll-to-date API. A's "one time language" is built on B's single renderer.
2. **Bar craft:** a 1px ring for 3:1, a start cap, edge chevrons that carry a date ("from 2 Mar", "to Mar 2027"), and a dotted open end.
3. **Past wash:** a faint sunken wash before today, so "past" reads without a legend.
4. **Two-tier ticks:** the year on the first tick and on each January, and faint week ticks at the Weeks zoom.
5. **A danger zone in the share sheet** with inline two-step confirmation, and "Make a new link" as the primary action for a live page, which matches the show-once truth.
6. **An action menu per row** (a visible ⋯ button, also "." and right-click) listing every row action with its shortcut. It is the discoverable home for the keyboard grammar.
7. **Inline rename** (E, or double-click) in the milestone list.
8. **A quick-add date phrase:** typing "Florist 12 Nov" shows a date chip before saving, and the chip can be removed. Parsing is local and deterministic.
9. **Shared pages** (`/app/timeline/audience/**`) restyled into the v3 page column with the Choose, Review, Publish progress line.
10. **Find a project**, a text filter that appears only above 12 rows.

Rejected from B, with reasons:
- **The health bar.** It is colour-first. A's chips say the same thing in words.
- **Density toggle and resizable name column.** They are controls nobody asked for; restraint is the final edit.
- **Six-column ledger.** Hover and focus reveal controls instead. The eye-off mark stays visible.
- **Collapsed groups kept in the URL.** Complete is folded by default and the rest is session state. Only zoom, group, sort and status go in the URL.
- **Mobile monogram rail plus canvas as the default.** Cards on a shared window read better on a phone.
- **The "Portfolio unavailable → redirect" state.** A read failure now shows a real message. A redirect hides the failure.
- **1/2/3 zoom keys.** W, M and Q are mnemonic, and [ and ] already exist.
- **G and A single keys.** Too many letters for a first-time user.

Rejected from A:
- **"Create a link" from Private.** It is untrue to the publish model.
- **"We only show this once" without a way back.** B's "Make a new link" is the recovery.
- **Restyling the public artifact.** See section 11.

---

## 1. Goals

1. **Answer first.** Within three seconds of first paint, a first-time reader of All projects knows how many projects there are, which one needs a look, and where today is on the line.
2. **One time language.** The bar, diamond, flag, Today line, words and keys are the same on All projects and on the plan. Moving from one to the other feels like zooming in.
3. **Readable at first paint.** No jump: the Today line and the current bars are visible in the HTML that the server sends.
4. **One obvious action per surface:** "Open" on All projects, "Share" on the plan. Everything else is quieter.
5. **Say plainly what guests see.** The plan shows what guests see as a phone preview and states whether the page is live.
6. **Keep every behaviour and guarantee:**
   - milestone create, rename, date (inherit, set or undated), hide, audience override, reorder, drift, undo and sync;
   - publish, make a new link, switch links off, unpublish and expiry;
   - freshness, preview, archived read-only, and catalog-only authorization;
   - the review mode rule: no database access;
   - noindex, URLs and the published-surface contracts on `/s/[token]`.

Non-goals:
- program or planning-period groupings (founder: "no need for program views");
- editing a project's target date or status from All projects (section 12);
- restyling the public artifact;
- any change to schema, migrations, lockfile, `vercel.json` or the deploy workflow, and any new dependency.

---

## 2. Information architecture

```
Timeline (sidebar item)
├── All projects     /app/timeline                                   one bar per Project you can open
│     row → /app/timeline?workspaceId=<id>&open=project               resolves + authorizes → that Project's plan
└── One project      /app/timeline/[projectSlug]                     a plan inside a Project
      ├── Preview    /app/timeline/[projectSlug]/preview             what guests see (artifact unchanged)
      └── Shared pages /app/timeline/audience[/publicationId]         choose, review, publish
Public (guests)      /s/[token]                                      UNCHANGED
```

Query state is kept in the URL, so a view can be linked and survives a reload:

| Page | Params |
|---|---|
| All projects | `?zoom=weeks\|months\|quarters` (default months), `?group=status\|none` (default status), `?sort=target\|start\|name\|progress` (default target), `?status=at-risk,on-track,...` (new, default all) |

Default values are removed from the URL. Every parse follows the async `searchParams` Promise pattern in `src/app/app/timeline/page.tsx`.

Routing for `/app/timeline` is unchanged from round 1:

| Request | Result |
|---|---|
| Bare, or `?workspaceId=<id>` only | All projects. When `workspaceId` names a catalog row, that row carries "Open now". |
| `?workspaceId=<id>&open=project`, `?project=`, `?projectSlug=`, `?mode=edit` | Today's resolver and redirect into the plan. |
| v3 flag off | Today's redirect. |

**Two meanings of "project".** A suite **Project** ("The Orchard, events") binds one Timeline, which can hold several **plans** ("Mara & Finn"). The UI always leads with the Project: in the tab, the header line and the menu. The plan name is the H1 under it, and never stands in for the Project.

**The view switch** is two real tabs (`role="tablist"`, two links with `aria-current="page"`), shown on every Timeline page:

```
[ All projects ]  [ TO The Orchard, events  ▾ ]
```
- **Tab 2** carries the Project tile and name. On All projects it names the last Project opened (`lastPlan`, already computed on the server); with none, it reads "One project".
- **The chevron** is a separate 44px button that opens `ProjectSwitcher`. It lists authorized options only (`toAuthorizedProjectOptions`), in two sections:
  - "Timelines in The Orchard, events": the plans, with the current one ticked;
  - "Other projects": catalog rows, each opening through `open=project`.
- **Zoom** carries across tabs where it means the same thing. The plan runway has no zoom, so switching back restores `?zoom=` from the last All projects URL.

---

## 3. Layout per breakpoint

Page column: max-width 1180px, padding 28px 32px 56px on desktop and 20px 16px on mobile. Header content aligns to the 1180 column. The All projects canvas and the plan runway may run full-bleed to the content edge, 32px from it. The page never scrolls sideways. Only the canvas and the runway scroll, each in its own container with `overscroll-behavior-x: contain`.

Breakpoints:

| Width | Layout |
|---|---|
| 1180 and up | Full layout |
| 768–1179 | Desktop grid with a 220px name column. The plan context column moves below the list, and the milestone panel becomes a 420px right sheet over `--v3-scrim`. |
| Below 768 (`PHONE_QUERY`) | Mobile layout |

### 3.1 All projects, desktop (1440 × 900, sidebar 248)

```
 Timeline                                            [ All projects ][ TO The Orchard, events ▾ ]
 6 projects. Kavanagh wedding is at risk, with 2 late tasks.   [Show it]
 (●) 2 on track  (●) 1 at risk  (●) 1 paused  (●) 1 complete  (○) 1 no status        5 sample rows · review only ⓘ
 ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Group [Status ▾]  Sort [Target date ▾]  [Find a project]*      (?) How to read this   [Weeks|Months|Quarters] [Today]
 ┌────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────┐
 │ Project                    │ Jun 2026      Jul    ┃Today 16 Jul  Aug           Sep           Oct         Nov   │ sticky 44
 ├────────────────────────────┼░░░░░░░░░░░░░░░░░░░░░┃──────────────────────────────────────────────────────────────┤
 │ ▾ At risk · 1              │░░░░░░░░░░░░░░░░░░░░░┃                                                              │ group 36
 │ KW Kavanagh wedding Sample │‹ from 2 Mar ▐███████┃▒▒▒▒◆▒▒▒▒◇▒▒◇(+3)▒▒▒▒▒▒▒▒▒▒▒▒▒▒▌ 12 Nov · 40%                │ row 52
 │    At risk · 2 late        │░░░░░░░░░░░░░░░░░░░░░┃                                                              │
 │ ▾ On track · 2             │░░░░░░░░░░░░░░░░░░░░░┃                                                              │
 │ TO The Orchard, events  ◂Open now ▐█████████████┃██▒▒◆▒◇▒▒◇◇▒▒▒▒▒▒▒⚑▌ 3 Oct · 38%                           │
 │    On track · 1 late       │░░░░░░░░░░░░░░░░░░░░░┃                                                              │
 │ Y9 Year 9 history   Sample │     ▐███████████◆███┃████◇▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒◇▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▌ 18 Dec · 55%          │
 │ ▾ No status · 1            │░░░░░░░░░░░░░░░░░░░░░┃                                                              │
 │ KR Kitchen renovation      │         ▐██▒▒▒◆▒▒▒▒▒┃▒▒▒▒▒▒┈┈┈┈┈  No target date · Set one →                     │
 │ ▾ Paused · 1               │░░░░░░░░░░░░░░░░░░░░░┃                                                              │
 │ HS Harvest supper club     │   ▐//////////////////┃///▌ Paused                                                │
 │ ▸ Complete · 1             │                                                                                   │ folded by default
 └────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────┘
 ▸ 2 archived projects
 * Find a project appears only above 12 rows.
```

- **Header height budget.** The axis starts at or above y=340 at 1440 × 900, so at least 9 rows (projects plus group headers) are visible. That compares with 5 today.
- **Title row.** H1 "Timeline" is 28/650. The tabs sit right-aligned on the same baseline.
- **Answer row.** The sentence is 17/500 `--v3-text` with the project name in 600. "Show it" is a quiet link-button.
- **Chip row.** Status filter chips, 36px visual and 44px hit area. The review-only note is right-aligned in 13/400 `--v3-text-3`, and its ⓘ opens a popover: "Five of these projects are made up to show how this works. They are not saved anywhere and open nothing."
- **Toolbar.** Group and Sort are v3 menu buttons. "How to read this" toggles the legend row (3.1a). The zoom is a segmented control, and Today is a quiet button.
- **Name column.** 280px, sticky left, `--v3-surface`, with a 1px `--v3-border` right edge. Each row has:
  - an identity tile, 28px, `--v3-project-N` with `--v3-project-ink` for the monogram;
  - the name in 15/600, truncated to one line;
  - a "Sample" chip: 12/500 `--v3-text-2` on `--v3-fill`, radius-sm;
  - the meta line in 13/400 `--v3-text-2`, from `rowMetaLine`.
- **Rows** are 52px, with a 1px `--v3-border` bottom rule. Hover uses `--v3-hover` across the whole row, name and canvas together.
- **Group header** is 36px, sentence case "At risk · 1", on `--v3-sunken`, with a caret. It folds with `aria-expanded`.
- **Canvas.**
  - Month ticks are 1px `--v3-border`. At Weeks zoom, week ticks are `--v3-border` at 50%.
  - The past wash is `--v3-sunken` from the range start to today.
  - Weekend shading shows at Weeks zoom only.
  - The Today line is 1px `--v3-accent`, full height. Its pill "Today 16 Jul" sits in the axis in `--v3-accent` with `--v3-on-accent` text.

#### 3.1a Legend row (toggle, open on first visit)

```
 ▐██▒▒▒▌ start to target date   ██ done so far   ◆ milestone   ◇ milestone done   ⚑ key date   ┃ today   ▐///▌ paused   ▐▒▒│╲╲╲ past target
```
It is drawn with the real components at 70% scale, not icons. Dismissal is kept in `localStorage` under `signal.timeline.legend`. Reads and writes are wrapped in try/catch, and the default is open.

### 3.2 One plan, desktop (`/app/timeline/mara-finn`)

```
 [ All projects ][ TO The Orchard, events ▾ ]
 TO The Orchard, events ›                                                           [Preview  P]  [Share]
 Mara & Finn                                                                            (H1 32/650)
 ⚑ Wedding day · Sat 3 Oct · 79 days to go
 ● Shared page live · 1 link · 2 changes not on it yet · Updated from Tasks 2 min ago          (status line, a button)
 ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │ Earlier ⋯ │ Jul       ┃Today           Aug                     Sep                        Oct           │ 144px runway
 │ ◇ ◇ 2 done│           ┃   Menu tasting 1 Aug     Final dress fitting 22 Aug    Venue walk-through       │ labels lane above
 │ ──────────│───────────┃───◆──────◇────────────◇──────◇──────◇────────◇─────────────◇────────⚑           │
 │           │           ┃          Invitations 8 Aug       Evening music 29 Aug    Guest numbers  Wedding  │ labels lane below
 │ ▰▰▱▱▱▱▱▱▱ 2 of 9 done                                         Next: Menu tasting · 1 Aug · in 16 days     │
 └──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 ┌─ Milestones · 10 ─────────────────────────── [+ Add milestone  N] ┐  ┌─ Up next ────────────────────────┐
 │ Now · 1                                                           │  │ Menu tasting at The Orchard      │
 │  ◆ Menu tasting at The Orchard                  1 Aug · in 16 days│  │ Sat 1 Aug · in 16 days           │
 │ Coming up · 3                                                     │  │ From Tasks · Open task →         │
 │  ◇ Send the invitations                          8 Aug · in 23 days│  ├─ What guests see ────────────────┤
 │  ◇ Final dress fitting  Added here          [👁][⋯] 22 Aug        │  │ ┌──────────────┐                 │
 │  ◇ Choose the evening music ⊘                   29 Aug · in 44 days│  │ │ phone preview│ 240 × 420       │
 │    Tasks moved this to 5 Sep.  [Use 5 Sep]  [Keep 29 Aug]         │  │ │  (read-only) │                 │
 │ Later · 3                                                         │  │ └──────────────┘                 │
 │  ◇ Final guest numbers                            5 Sep           │  │ ● Live since 15 Jul · 1 link     │
 │  ◇ Venue walk-through                            19 Sep           │  │ 2 changes not on it yet  Review →│
 │  ⚑ Wedding day                                    3 Oct           │  │ [Share]  [Open preview]          │
 │  + Add a milestone                                                │  └──────────────────────────────────┘
 │ ▸ Done · 2      ▸ Not going ahead · 1                             │
 └───────────────────────────────────────────────────────────────────┘
 ⊘ hidden from the shared page   ⚑ key date   ✎ date set here
```

- **Header.** The project line has a 20px tile and the name, 14/500 `--v3-text-2`, linking to the Project overview. The H1 is the plan name. The key-date line comes from `anchorMilestone`: flag, weekday date, and `relativeDayPhrase` in `--v3-accent-text`. Actions: Preview (quiet, with a P hint) and Share (primary, `--v3-accent`).
- **Status line.** One sentence of up to three clauses, 14/400 `--v3-text-2`, with a status dot. The whole line is one button that opens the share sheet. The freshness clause has its own "Refresh" link when stale; the two never merge into one control.
- **Runway**, 144px, `--v3-surface`, radius-lg, `--v3-shadow-1`. It is built on `timeline-canvas.tsx` with the plan's own scale:
  - **Earlier segment.** Everything before the last done milestone folds into an 88px segment with a break glyph "⋯", the done diamonds and "2 done". Clicking it expands the true past; a second click folds it again.
  - **Scale.** From the fold to the key date plus 14 days, fitted to the width (`fitPxPerDay`). Today is always included.
  - **Labels** sit on two lanes, above and below. Labels that do not fit, found with `clusterMarks`, become "(+3)" bubbles. The next milestone and the key date are always labelled.
  - **Progress** shows under the runway: a 4px bar and "2 of 9 done", with "Next: …" on the right.
- **Milestone list.** 700px, radius-lg, `--v3-surface`.
  - Groups come from `planGroupKey` and `PLAN_GROUP_LABELS`: Now, Coming up, Later, No date yet, then Done and Not going ahead folded.
  - Each group ends with a "+ Add a milestone" ghost row.
  - Rows are 48px with a diamond, title 15/500 and marks (⊘ hidden, ⚑ key date, ✎ date set here). The date is 14/500 tabular, followed by a relative phrase for Now and Coming up.
  - On hover or focus a row shows the eye toggle [👁] and the ⋯ menu.
  - Manual rows show "Added here" in 12/500 `--v3-text-3`. Rows from Tasks show nothing, because that is the default.
- **Context column.** 380px, 40px gap, sticky at the top offset.
  - The **Up next** card.
  - The **What guests see** card: `TimelinePhonePreview` scaled to 240px wide, read-only and `inert`, wrapped so owner styles cannot reach it. Under it: the share state, divergence, and [Share] [Open preview].
  - Selecting a row replaces the column with the **Milestone panel**: the same width, a 12px slide with a fade, and Esc to return.

### 3.3 All projects, mobile (390 × 844)

```
 Timeline
 [ All projects ][ TO The Orchard ▾ ]
 6 projects. Kavanagh wedding needs a look.  Show it
 (●)2 on track (●)1 at risk (●)1 paused (●)1… →      edge fade, horizontal scroller
 Showing [Next 3 months ▾]              [Arrange]      Arrange = Group and Sort in a bottom sheet
 ┌────────────────────────────────────────────┐
 │ KW Kavanagh wedding  Sample      ● At risk │
 │ Target 12 Nov · in 119 days                │
 │ ▰▰▰▰▱▱▱▱▱▱ 4 of 10 done · 2 late            │
 │ 1 Jul ┃  Aug   ◆  Sep  ◇ (+3)  Oct         │ 36px mini strip, shared window
 │  Today┃                                    │
 └────────────────────────────────────────────┘
 ┌────────────────────────────────────────────┐
 │ TO The Orchard, events  ◂Open now  ● On track │
 │ Target 3 Oct · in 79 days                  │ ...
 ▸ Complete · 1        ▸ 2 archived projects
 5 sample rows · review only ⓘ
```
- **Window.** Every card's strip shares one window, from today minus 14 days out to 3, 6 or 12 months. That keeps bars comparable down the list. The window control maps to `?zoom=weeks|months|quarters`, so desktop and mobile share state.
- **Nothing in the window.** The card says so in words, such as "Starts 4 Jan, after this window" or "Ended 30 Jun, before this window", and never shows an empty strip.
- **Past target** reads "9 days past target" in `--v3-danger-text`.
- **Tap targets.** The whole card is one link to `href`, 112px or more. A 44px ⓘ button in the top-right opens the facts sheet: the same content as the desktop card, as a bottom sheet with scrim, focus trap, Esc and a Close button. Sample cards open the sheet only.
- **Group headers** stay, with Complete folded.

### 3.4 One plan, mobile

```
 [ All projects ][ TO The Orchard ▾ ]
 TO The Orchard, events ›
 Mara & Finn                                  [⋯]   (Share, Preview, Shared pages)
 ⚑ Wedding day · 3 Oct · 79 days
 ● Live · 1 link · Updated 2 min ago          ›     (opens the share sheet)
 ┌ runway 112px, scrolls sideways, today pinned 24px from the left, labels below only ┐
 Up next card (compact)
 Now / Coming up / Later list, rows 56px, eye-off mark visible, no hover controls
 What guests see (phone preview at 100% width, collapsed behind "Show what guests see")
 ┌ sticky bottom bar, safe-area padded:  [ Preview ]   [ + Add milestone ] ┐
```
- **Milestone panel** is a full-height sheet: a Close button at the top left, the title, fields and save state. It also gains "Move up" and "Move down", because there is no drag on touch.
- **Diamonds** have a hit area of at least 44 × 44 (invisible padding). Tapping one selects the row and opens the sheet. Dragging a diamond is desktop pointer only.
- **Share** stays reachable in the status line and the header ⋯ menu.

### 3.5 Tablet (768–1179)

- **All projects:** the name column is 220px, the meta line stays, and the chip row wraps.
- **Plan:** the context column moves below the list at full width, with the phone preview on the left and the facts on the right. The panel becomes a right sheet of 420px.

### 3.6 Shared pages (`/app/timeline/audience`, `/audience/[publicationId]`)

These move into the v3 page column:
- **Header:** the project line, H1 "Shared pages", and the same tabs.
- **Progress line:** "Choose · Review · Publish", three steps, with the current one in `--v3-accent-text`.
- **Fields** use v3 controls. Native `<select>` is kept for accessibility and mobile, but styled with the v3 control ring and chevron.
- **The artifact studio embed is unchanged.**
- Copy fixes are in section 10.

---

## 4. Components

All CSS is in CSS modules with pure selectors and `var(--v3-*)` tokens only. `color-mix()` between tokens is allowed. Sizes use px in CSS; tap targets use 44px or `min-h-[44px]`, never `min-h-11`.

### 4.1 Shared (`src/components/app/portfolio/`)

| File | Status | Role |
|---|---|---|
| `timeline-canvas.tsx` | **new** | A scroll container with a sticky axis slot, a Today line, past wash, weekend spans and ticks from `ticks(range, zoom)`. It takes absolutely positioned layers as children. Imperative API through a ref: `scrollToDay(iso, {align: 0.3, smooth})`, `centreDay()`. It owns the first-paint scroll (section 5.6). Used by the All projects grid and the plan runway. |
| `portfolio-axis.tsx` | rework | Two-tier ticks. The year shows on the first tick and on each January. A Today pill docks to the left or right edge with an arrow when today is scrolled out of view, and becomes a button. |
| `timeline-tabs.tsx` | **new**, replaces the pill pair in `timeline-ui.tsx` | The view switch in section 2. |
| `row-menu.tsx` | **new** | The ⋯ action menu (`role="menu"`, roving focus, typeahead, focus return, shortcut hints). Opened by the button, ".", Shift+F10 or right-click. |
| `timeline-ui.tsx` | keep | `Sheet`, `ShortcutSheet`, `isShortcutBlocked`, `useMediaQuery`. It gains `useTimelineKeys(map)`. |

### 4.2 All projects

| File | Status | Role |
|---|---|---|
| `portfolio-view.tsx` | rework | Composes the title and tabs, `PortfolioAnswer`, `StatusFilterChips`, the sample note, the toolbar, the grid or mobile list, empty states and the archived disclosure. |
| `portfolio-summary.tsx` | rework into `PortfolioAnswer` + `StatusFilterChips` | The answer sentence from `needsALook()`, and the chips from `summaryCounts()`. The colour strip and the "Needs a look" band are deleted. |
| `portfolio-legend.tsx` | rework | The toggle row in 3.1a. |
| `portfolio-gantt.tsx` | rework | Keeps `role="grid"`, rows, row headers, grid cells, roving focus, drag-to-pan and the keyboard map. Adds: canvas on `timeline-canvas`, folding group rows, milestone stepping with ←/→, the pinned card, and a find filter. |
| `portfolio-row.tsx` | rework | Tile, name, Sample chip, meta, "Open now", and the lock state for rows that cannot be opened. The accessible name comes from `rowAccessibleLabel`. |
| `portfolio-bar.tsx` | rework | One visual per `barGeometry` kind (5.2), with edge chevrons, end label and milestone marks. |
| `portfolio-hover-card.tsx` | rework | Collision-aware placement, hover intent and pinning (5.1). |
| `portfolio-mobile-list.tsx` | rework | The cards in 3.3, with an SVG mini strip on the shared window. |
| `portfolio-empty.tsx` | rework | The empty, unavailable, all-undated and filter-empty states (section 6). |
| `portfolio.module.css`, `portfolio-mobile.module.css` | rewrite | One pass. No old grid selectors survive. |

### 4.3 One plan (`src/modules/timeline/app/plan/[projectSlug]/_components/v3/`)

| File | Status | Role |
|---|---|---|
| `use-milestone-edits.ts` | **untouched** | Every write, rollback, retry, sync, drift, undo and local-only review path. |
| `plan-surface.tsx` | rework | Layout, selection, the keyboard layer, toasts and focus return. |
| `plan-header.tsx` | rework | Project line, H1, key-date line, Preview and Share. |
| `plan-status-line.tsx` | **new**, merges `visibility-line.tsx` and `freshness-line.tsx` | The one-sentence status (3.2). |
| `plan-strip.tsx` → `plan-runway.tsx` | rework and rename | The runway in 3.2 on `timeline-canvas`: the Earlier fold, two label lanes, diamond drag with a ghost chip, the key-date flag, and the progress footer. |
| `milestone-list.tsx`, `milestone-row.tsx` | rework | Groups, hover controls, the eye toggle, the ⋯ menu, inline rename, the drift strip, and the ghost "+ Add a milestone" row per group. |
| `add-milestone-row.tsx` | rework | Inline composer with the quick-add date phrase (5.3). |
| `milestone-panel.tsx` | rework | Fields in 5.3. It is a column on desktop and a sheet on narrow screens. |
| `context-column.tsx` | **new**, absorbs `up-next-card.tsx` and `sharing-card.tsx` | Up next, and What guests see with the phone preview. |
| `share-sheet.tsx` | rework | The sheet in 5.4. Same actions, `useActionState` wiring and `router.refresh` rule. |
| `plan.module.css` | rewrite | |

### 4.4 Routes

- `src/app/app/timeline/loading.tsx`, `error.tsx` and `[projectSlug]/loading.tsx` get skeletons that match the final geometry (section 6).
- `src/app/app/timeline/[projectSlug]/preview/page.tsx`: the v3 top bar only. It has "← Back to timeline", "This is what guests see", a state pill and a [Desktop | Phone] toggle. The artifact body is unchanged.
- `src/modules/timeline/app/audience/**`: restyled (3.6). Actions are unchanged.

---

## 5. Interactions and keyboard map

### 5.1 All projects

**Hover card**
- **Opening.** Pointer hover on a bar or row opens it after 250ms. Once a card is open, moving to another row swaps it at once, which lets the reader scan. Keyboard focus on a row opens it at once.
- **Content, unchanged:**
  - tile, name and status pill;
  - "Target 3 Oct · in 79 days" or "9 days past target";
  - "5 of 13 tasks done" with a mini bar, and "2 tasks are late";
  - "Next milestone: Menu tasting · 1 Aug";
  - "Started 12 Mar" (or "Started when the project was made");
  - "Timeline: Mara & Finn", and the purpose line.
  - Footer: [Open timeline] (primary) and [Project overview].
  - Sample rows instead say: "Made up to show how this works. Opens nothing."
  - Rows that cannot be opened show the reason in plain words, for example "This project can't be opened from here."
- **Placement.** Below the bar when the space below fits the card, otherwise above. It is never placed over the hovered row. It flips at the viewport edges and is anchored to the pointer's x, clamped to the canvas.
- **Pinning.** Clicking the bar or pressing Space pins the card. Esc, clicking outside, or Space again unpins it.
- **Semantics.** The card is `role="dialog"` when pinned and `aria-describedby` from the focused row when not. It never steals focus.

**Opening a project**
- Clicking the row name, or pressing Enter, follows `href` (`portfolioRowHref`).
- Sample rows show the toast "Sample project, nothing to open."
- Rows that cannot be opened are not links.

**Filter chips**
- Chips toggle and combine. They write `?status=` with `router.replace` (no scroll) and use `aria-pressed`.
- When rows are hidden, a line under the grid reads "3 projects hidden by filters. [Show all]".

**Find a project** (only above 12 rows) filters by name on the client. "/" focuses it.

**Zoom**
- Weeks, Months and Quarters, or W, M and Q. [ and ] also step the zoom out and in.
- Ctrl or ⌘ plus wheel zooms around the date under the pointer, snapping to the three zooms.
- The centre date stays fixed (`pendingCentre`).

**Today:** the Today button, T, or the docked Today pill. The scroll is smooth, with today landing 30% from the left. Under reduced motion it jumps.

**Pan**
- Drag empty canvas (grab cursor). Shift plus wheel. Native trackpad sideways swipes.
- Clicking an edge chevron scrolls to that end of the bar.

**Grid keys**
- ↑/↓ or K/J move between rows, including group headers.
- ←/→ step through the focused row's milestones, and each is announced ("Florist confirmed, 18 Sep, next").
- Home and End jump to the first and last row.
- Enter or Space on a group header folds it.
- "." opens the row menu, with Open timeline, Project overview and Copy link to this view.

**"Show it"** scrolls that row into view, focuses it and pins its card.

**Archived disclosure** lists names that link to the read-only overview (`overviewHref`).

### 5.2 Bar vocabulary

Bars are 18px tall, radius-sm, centred in the 52px row. Every bar has a 1px inset ring. The ring is `--v3-control-border` for neutral cases and the tone's stroke for coloured ones, so the extent reaches 3:1 against both canvas and sunken.

| Case (`barGeometry` / status) | Rendering | End label |
|---|---|---|
| On track, span | remainder `--v3-success-soft`, done share `--v3-success` | "12 Nov · 40%" |
| At risk | remainder `--v3-warning-soft`, done `--v3-warning`, ring `--v3-warning-stroke` | "12 Nov · 40%" |
| Paused | 45° hatch of `--v3-fill` and `--v3-sunken`, ring `--v3-border-strong` | "Paused" |
| Complete | solid `--v3-accent`, with a check at the end | "Done 30 Jun" |
| No status | remainder `--v3-fill`, done `--v3-text-3` | "18 Dec · 10%" |
| Open-ended (no target) | the track runs to today + 28 days (`OPEN_ENDED_DAYS`) and ends in a dotted tail, not a fade | "No target date". Owners also get "Set one →", linking to the overview. |
| Target only | ⚑ at the target and a hairline from today | "Target 12 Nov" |
| None | no bar | "No dates yet", in the row |
| Past target | the bar stops at the target. A hatched `--v3-danger-soft` segment runs from the target to today, ring `--v3-danger` | "9 days past target", in `--v3-danger-text` |
| Clipped before or after | a ‹ or › chevron with a date inside the edge | "from 2 Mar", "to Mar 2027" |
| No tasks | ring only, no fill | "No tasks yet" |
| Stats unavailable | a neutral ring-only track | status word only |

**Milestones** are 10px diamonds centred on the bar. Tones come from `milestoneTone`:
- done: filled `--v3-text-3`;
- next: filled `--v3-accent`;
- upcoming: `--v3-surface` fill with a `--v3-control-border` ring;
- overdue: `--v3-danger` ring.

`clusterMarks(…, 14)` merges close diamonds into a "(+3)" bubble, and the card lists the titles. Past `MILESTONES_PER_ROW`, the card says "+N more". The label goes outside the bar end when it fits in the canvas, otherwise inside, in `--v3-on-accent` or `--v3-text`, whichever passes AA on that fill.

### 5.3 One plan

- **Select** a milestone by click, Enter, or J/K then Enter. The row fills with `--v3-row-selected` and a 2px `--v3-accent` inset rule, the runway diamond rings, and the panel opens. Esc closes it and returns focus to the row.
- **Hover link.** Hovering a row highlights its diamond, and hovering a diamond highlights its row.
- **Row controls** appear on hover or focus:
  - The eye toggle calls `setHidden`. Toast: "Hidden from the shared page. Undo".
  - The ⋯ menu has Rename (E), Change date, Show or hide on the shared page (H), Move up and Move down (Alt+↑/↓), Open in Tasks (rows from Tasks) and Remove (manual rows only, as today).
- **Inline rename.** E or double-click turns the title into an input. Enter saves through `saveTitle`, Esc cancels. The panel keeps "Use the name from Tasks".
- **Dates**
  - ←/→ move the selected milestone by a day, and Shift+←/→ by a week. Changes are debounced into one write with an Undo toast.
  - The date chip in the panel opens the shared calendar popover. Import `src/components/app/detail-panel/due-calendar.tsx`; do not edit it, because it belongs to the Tasks stream. If its API does not fit, keep the native date input styled in v3.
- **Runway drag** (desktop pointer only). Dragging a diamond shows a ghost chip "8 Aug → 15 Aug (+7 days)" and snaps to days. Dropping calls `setDate` and shows an Undo toast. Esc, or dropping outside the runway, cancels.
- **Drift.** When `driftDetected`, an inline strip under the row reads "Tasks moved this to 5 Sep." with [Use 5 Sep] (inherit) and [Keep 29 Aug] (date). The panel carries the same choice. It enters with a 160ms height reveal.
- **Add a milestone:** N, "+ Add milestone", or a group's ghost row. The inline composer takes a name. A trailing date phrase is parsed locally:
  - day and month ("12 Nov", "12 November"), "tomorrow", "next Friday", or a weekday;
  - it is shown as a removable chip before saving, and is not guessed silently;
  - Enter calls `addMilestone`, Esc cancels.
- **Milestone panel fields.** Each saves on change or blur, with inline "Saving", "Saved" or "Couldn't save · Try again" from `fieldStatus`:
  - Name.
  - Date: a segmented control with "From Tasks (1 Aug)", "Set a date" and "No date" (inherit, date, undated). "✎" marks a date set here.
  - Show on the shared page: a switch.
  - Where guests see it: "Automatic (Coming up)" plus a menu of Done, Now, Coming up, Later and Not going ahead (`AUDIENCE_STATE_CHOICES`).
  - Source: "From Tasks · Open task →" or "Added here".
  - Order: Move up and Move down, with the polite "Position 2 of 4". Help text: "Order only matters for milestones on the same day or without a date."
- **Refresh from Tasks**, in the status line when stale or failed, calls `runAutoSync`. It is hidden in review and when archived, as today.

### 5.4 Share sheet

The sheet opens from Share, S, or the status line. On desktop it is a 480px right sheet; on mobile it is a bottom sheet at 90vh. Each state has a distinct hero:

| State (`ShareStateKind`) | Hero | Primary | Secondary |
|---|---|---|---|
| Never published (`publication === null`) | "Only people in this project can see this plan." / "Pick which milestones guests see, then publish to make a link." | [Choose what to share] → `manageHref` | Preview |
| Draft | "Ready to share, not live yet." | [Publish and make the link] | Choose what to share |
| Live | "Live since 15 Jul · 1 link" / "Anyone with the link can view it. No sign-in." | [Make a new link] with the helper "The old link stops working." | Copy is available only straight after minting |
| Just minted (`minted`) | Receipt: the URL in a read-only field, [Copy link], and "Copy it now. For your privacy we don't keep it, so this page can't show it again." | Copy link. Toast: "Link copied. Anyone with it can view this plan." | |
| Links off | "Links are off. The page is still ready." | [Make a new link] | |
| Unpublished | "Taken down on 3 Aug." | [Choose what to share] | |

The sheet also has:
- **Changes since you shared** (`divergedTitles`): "2 changes are not on the shared page yet", then the titles, then [Review and publish].
- **"Stop the link working after…"**: an optional date button next to the publish or new-link action. It opens the calendar popover and posts `expiresOn` exactly as today. The timezone sentence shows only when the publication's zone differs from the viewer's.
- **Stop sharing**, a separated section at the foot, in `--v3-danger-text`:
  - "Turn off all links", with "The page stays ready, and nobody can open it." It calls `revokeAudienceShareAction`.
  - "Take the page down", with "Unpublishes the page and turns off every link." It calls `unpublishAudiencePublicationAction`.
  - Both use an inline two-step confirm: first click arms, and the button reads "Turn off all links now" for 6 seconds. Esc disarms.
- **Footer:** "Choose what guests see" (manage) · "Preview".
- **Gating** is unchanged:
  - `canManage` false: facts only, with "Only a project owner can change sharing."
  - `canPublish` false (archived): no minting. "Turn off all links" stays (ADR 0001 §5).

### 5.5 Keyboard map

Shortcuts go through `isShortcutBlocked`, so none fire in inputs, selects, contenteditable or open dialogs, including the suite launcher. None fire with Ctrl, ⌘ or Meta held unless listed. Each shortcut has a visible control and appears in the ? sheet (two columns) and in the ⋯ menu hints.

| Key | All projects | One plan |
|---|---|---|
| ↑ ↓ / K J | move row focus | move row focus |
| ← → | step milestones on the row | date −/+ 1 day (selected) |
| Shift+← → | — | date −/+ 1 week |
| Home / End | first / last row | first / last row |
| Enter | open timeline | open panel |
| Space | pin or unpin card | — |
| Esc | unpin card, close menu | close panel, sheet or menu, cancel drag |
| . | row menu | row menu |
| / | find a project | — |
| W / M / Q | weeks / months / quarters | — |
| [ / ] | zoom out / in | — |
| T | today | scroll runway to today |
| N | — | add milestone |
| E | — | rename selected |
| H | — | hide or show selected |
| Alt+↑ ↓ | — | move selected up / down |
| P | — | preview |
| S | — | share |
| ? | shortcuts | shortcuts |

### 5.6 First paint (the no-jump rule)

1. The server renders the full range from `timeRange(...)`, unchanged.
2. `timeline-canvas.tsx` renders a tiny inline script right after the scroller. The CSP allows `'unsafe-inline'`; see `next.config.ts`. Before first paint, the script sets `scrollLeft = dayToX(today) - 0.3 * clientWidth`. It reads its numbers from `data-` attributes computed on the server, not from any request input.
3. A `useLayoutEffect` repeats the same assignment after hydration. It is idempotent and covers client navigations.
4. Fallback if the inline script is ever removed: the canvas layer (not the name column) renders at `opacity: 0` until the layout effect adds `data-ready`.
5. **Acceptance:** a screenshot taken 300ms after `domcontentloaded` at 1440 and at 390 shows the Today line and the Kavanagh bar.

The plan runway has no horizontal scroll on desktop because it fits the width. On mobile it applies the same rule with today 24px from the left.

---

## 6. States

### All projects

| State | Behaviour |
|---|---|
| Loading | Header text bars (the H1, then a 60% sentence bar), 5 chip placeholders, the toolbar, a real month axis, and 6 rows with name skeletons and bars at plausible offsets on `--v3-fill`. A 1.2s opacity shimmer, static under reduced motion. `role="status"` "Loading your projects". No layout shift on arrival. |
| Unavailable (catalog read failed) | Header and tabs stay. Card: "We couldn't load your projects just now. Your work is safe." [Try again] (`router.refresh`) · [Open Projects]. |
| No projects | Three ghost bars with a Today line drawn in `--v3-border-strong`. "Your projects will line up here." / "Each project becomes one bar, from when work starts to its target date." [Create a project]. |
| One project (production) | The bar renders, plus an inline guide card: "Add another project to see them side by side." [Create a project]. No fake rows. |
| Nothing dated | Rows list with "No dates yet". Sentence: "None of your projects has a target date yet." Owners get "Set a target date" per row, linking to the overview; members see plain text. |
| Filter hides all | "No projects match these filters." [Show all]. With find text: "No projects called 'kav'." [Clear]. |
| Stats unavailable | One line: "Progress and dates couldn't be loaded, so bars show as plain tracks." [Try again]. Neutral tracks, meta shows status only, chips hidden. |
| Milestones unavailable | Toolbar note in `--v3-text-3`: "Milestones couldn't be loaded." Bars without diamonds. |
| Truncated (200) | Footer: "Showing the first 200 projects." [Open Projects]. |
| Range over 36 months | Clamped, with edge chevrons and dates (`clippedBefore`, `clippedAfter`). |
| Long names | Ellipsis on one line. The full name is in the card, `title` and the accessible label. |
| Row that cannot be opened | Dimmed name (`--v3-text-3`, still AA), a lock on the tile, not a link. The reason shows in the card. |
| Member | Same chart, without "Set one" or "Set a target date". |
| Archived | Only in the "N archived projects" disclosure, read-only. |
| Review | The sample note in the chip row, a Sample chip per sample row, a sample footnote in the card, no navigation. The real review project comes first in its group. `reviewPortfolioRows()` is empty outside demo mode (existing test). |
| Flag off | Today's redirect. |
| Error boundary | "Timeline didn't load." [Try again] (reset) · [Open Projects]. |

### One plan

| State | Behaviour |
|---|---|
| Loading | Header, runway with axis and 5 ghost diamonds, 6 list rows, a context column skeleton. `role="status"`. |
| No milestones | Runway shows only today and the key date, if any. List: "Start with the day that matters." [Set the key date] opens the composer with the flag preselected. "Or mark tasks as milestones in Tasks and they'll appear here." [Open Tasks]. |
| Only a key date | Runway from today to the flag, with "Add the steps in between". |
| No dates | All rows in "No date yet". Runway: "Give a milestone a date to place it on the line." |
| All hidden | "Every milestone is hidden, so guests see an empty page." [Show all]. |
| Sync fresh | "Updated from Tasks 2 min ago". |
| Sync stale | "Last updated from Tasks 3 days ago · Refresh". |
| Sync failed | Warning tone: "Couldn't update from Tasks at 10:42 · Try again". |
| Settled refusal | Stated once, `role="status"`, no retry (existing semantics). |
| Truncated import | "Showing the first 200 milestones from Tasks." |
| Save failure | Inline "Couldn't save · Try again". The optimistic value rolls back. |
| Drift | Inline strip per row. The header counter "2 milestones changed in Tasks" jumps to the first. |
| Share states | See 5.4. |
| Archived | Banner: "This project is archived. You can read this plan but not change it." Editing controls are hidden, not disabled: no add, drag or write keys. The ? sheet lists reading keys only. Sharing keeps only "Turn off all links". |
| Member (`canManage` false) | List read-only. Rows open a read-only panel. Share is replaced by "Only owners can share". |
| Review | Status line ends "Sample plan. Changes stay on this screen." (`localOnly`). |
| Dense runway | Clusters "(+n)". Only next, selected and key date are labelled. |
| No context, no plans, unknown slug | Existing branches as v3 empty cards, and `notFound()`. |
| Error boundary | "This plan didn't load." [Try again] · [Back to all projects]. |

---

## 7. Motion

All motion uses `var(--v3-ease)`. Under `prefers-reduced-motion: reduce` every change is instant and shimmers are static.

| Moment | Motion | Verdict |
|---|---|---|
| First paint | none, positioned before paint | restrained, on purpose |
| Today line | fades in over 200ms once | animate |
| Today button or T | smooth scroll, 240ms | animate |
| Zoom | bars and ticks tween `left` and `width` over 180ms around the fixed centre date | animate |
| Hover card | fade and 4px rise, 140ms in and 100ms out | animate |
| Group fold | `grid-template-rows` 0fr → 1fr, 160ms | animate |
| Filter or sort change | none, to avoid a moving target | restrained |
| Row select | 120ms fill | animate |
| Panel | 12px slide and fade, 160ms. Mobile sheet rises in 200ms. | animate |
| Diamond hover | scale 1.2, 120ms | animate |
| Drag ghost | follows the pointer, no easing | none |
| Drop and reorder land | 150ms settle flash (`settledId`) | animate |
| Saved | check fades in over 120ms, out after 1.6s | animate |
| Drift strip | 160ms height reveal | animate |
| Share state change | the pill cross-fades its word and dot, 160ms | animate |
| Link minted | the receipt field highlights once with `--v3-accent-soft`, 600ms | the one delight moment |

---

## 8. Accessibility

- **Grid.** All projects is `role="grid"` with a roving tabindex. Tab enters and leaves once. Each project is one `role="row"` whose name is `rowAccessibleLabel`, for example "Kavanagh wedding, sample, at risk, 40% done, target 12 November, 2 tasks late, next milestone Final fitting on 4 October". Group headers are rows with `aria-expanded`. Diamonds are `aria-hidden` in the row, and ←/→ stepping announces them through a polite live region.
- **Card.** It is `aria-describedby` on the focused row; when pinned it becomes `role="dialog"` with focus return.
- **Tabs.** `role="tablist"` with link tabs. The chevron is a separate button with `aria-haspopup="menu"` and the name "Switch project".
- **Chips.** Buttons with `aria-pressed`. The visible count is in the name.
- **Runway diamonds** are buttons, for example "Menu tasting, 1 August, now". Clusters are named "3 milestones between 8 and 12 August". The list is the complete path; the runway is a shortcut.
- **Drag** always has a keyboard and a form equivalent.
- **Menus and sheets:** proper `menu` and `dialog` ARIA, focus trap in modal sheets, and focus return to the opener.
- **Colour is never alone.** Every bar has a worded end label, status has words in the meta line, past target is hatched and worded, hidden has ⊘ plus text, and share state has a word.
- **Contrast.** Text is AA in both themes on canvas, surface and sunken. Bar rings, diamonds, the Today line and the control rings are at least 3:1. Re-measure `--v3-warning-soft` with its stroke in dark mode, the paused hatch in dark mode, the Sample chip on `--v3-fill`, and the dimmed row names.
- **Live regions** are polite for save, sync, reorder ("Position 2 of 4"), milestone stepping and toasts. Only a failed publish is assertive.
- **Targets** are 44px on touch. Desktop rows are 48 to 52px.
- **Reflow.** At 200% zoom and 320px width there is no horizontal page scroll.
- **Focus** uses the global `:focus-visible` ring, never overridden.

---

## 9. Copy

Voice: plain, active, sentence case, no exclamation marks, no uppercase tracked labels, and no monospace micro-labels. Never use "workspace", even though props are named `workspaceSlug`. Never put "portfolio", "Gantt", "roadmap", "drift", "blocked" or "null" in UI text. The words are: project, timeline, plan, milestone, start, target date, on track, at risk, paused, done, shared page, link, guests.

| Where | Copy |
|---|---|
| Answer | "6 projects. Kavanagh wedding is at risk, with 2 late tasks." · "6 projects, all on track or paused." · "None of your projects has a target date yet." |
| Chips | "2 on track" · "1 at risk" · "1 paused" · "1 complete" · "1 no status" |
| Sample note | "5 sample rows · review only" / popover: "Five of these projects are made up to show how this works. They are not saved anywhere and open nothing." |
| Toolbar | "Group" · "Sort" · "Find a project" · "How to read this" · "Weeks" "Months" "Quarters" · "Today" |
| Legend | "Start to target date" · "Done so far" · "Milestone" · "Milestone done" · "Key date" · "Today" · "Paused" · "Past target" |
| Bar labels | "12 Nov · 40%" · "No target date" · "Set one" · "No dates yet" · "No tasks yet" · "9 days past target" · "from 2 Mar" · "to Mar 2027" |
| Card footer | "Open timeline" · "Project overview" |
| Tabs | "All projects" · Project name, or "One project" |
| Plan key date | "Wedding day · Sat 3 Oct · 79 days to go" |
| Status line | "Shared page live · 1 link · 2 changes not on it yet · Updated from Tasks 2 min ago" |
| Groups | "Now" · "Coming up" · "Later" · "No date yet" · "Done" · "Not going ahead" |
| Drift | "Tasks moved this to 5 Sep." [Use 5 Sep] [Keep 29 Aug] |
| Toasts | "Hidden from the shared page. Undo" · "Moved to 15 Aug. Undo" · "Link copied. Anyone with it can view this plan." · "Sample project, nothing to open." |
| Shared pages fixes | "LINK-ONLY SHARING" → "Shared by link" · "PRIVATE PREVIEW" → "Private preview" · any "workspace" → "Project" |

Every string runs through `vocabulary.test.ts` and `pnpm first-contact:language`.

---

## 10. Data needs

No new server read is required. Everything above uses fields that already exist:
- `PortfolioRow`, `ProjectPortfolio`
- `EffectiveNode`, including `driftDetected`, `hidden`, `dateOverrideMode` and `audienceStateOverride`
- `SharePublicationSummary`, including `divergedTitles`, `activeShareCount`, `timezone` and `state`
- `TimelineFreshnessView`, `lastPlan`, `anchorMilestone`

| Addition | Where | Notes |
|---|---|---|
| `parseStatusFilter(value): Set<StatusGroupKey>` and `filterRows(rows, statuses, text)` | `src/lib/projects/project-portfolio.ts` | pure, with unit tests |
| `lateMilestones(row, todayIso)` | same | used for the card and the overdue tone; unit tests |
| `timeline-canvas` initial-offset helper `initialScrollLeft(range, ppd, todayIso, width, align)` | `src/lib/projects/project-portfolio-scale.ts` | pure, with unit tests |
| `parseQuickDate(text, todayIso)` → `{title, date \| null}` | `src/modules/timeline/lib/` (pure) | deterministic, en-IE day-month, unit tests |
| Status param | `src/app/app/timeline/page.tsx` | async `searchParams`, extends `TimelineIndexSearchParams` |
| Review samples | `src/server/projects/project-portfolio-review.ts` | Keep. Ensure the samples cover on track, at risk, paused, complete, no status, no target, past target, overdue milestone and a clipped range. |

**Optional, not needed for acceptance:** a fifth batched read for each Project's key date (`anchorMilestone` date and title), keyed only by catalog ids, drawn as ⚑ on the bar. Without it, the target date stands in.

Security:
- No new Server Function, and no ids accepted from the client.
- Every read filters to catalog ids.
- Mutations are the existing self-authorizing actions.
- Review mode performs no database access.
- The inline first-paint script embeds only server-computed numbers.

---

## 11. What gets deleted

All projects:
- the full-width sample banner;
- the summary card with the colour strip;
- the separate "Needs a look" band;
- the pill-pair view switch;
- the fading "No target date" gradient;
- the post-hydration scroll jump.

One plan:
- `up-next-card.tsx` and `sharing-card.tsx`, absorbed into `context-column.tsx`;
- `visibility-line.tsx` and `freshness-line.tsx` as separate lines, absorbed into `plan-status-line.tsx`;
- the uniform-scale strip;
- the policy paragraphs in the share sheet;
- the side-by-side "Switch every link off" and "Unpublish" buttons.

Old `portfolio.module.css` and `plan.module.css` selectors that the rewrite does not use.

The **public artifact** (`src/modules/timeline/components/artifact/**`, `/s/[token]`) is **not edited**. The owner page embeds `TimelinePhonePreview` read-only; it does not restyle it. Its contract and layout tests, noindex, URLs, qualified-view tracking and rate limits stay untouched and green.

Tests:
- **Rewrite** only UI-markup assertions, so they guard the new intent: `timeline-owner-accessibility-contract.test.mjs` and any portfolio markup tests. They keep named Move up and Move down, `buildOwnerKeyboardReorder`, the polite position announcement, visible retryable sync failure, settled refusal without retry, copy-link recovery, and loading `role="status"`. They add: tabs lead with the Project name, the grid has a row per project with an accessible label, and the share sheet's destructive actions need a second step.
- **Untouched:**
  - `route-authz-contract`, `active-project-contract` and `archived-project-readonly`;
  - `owner-reorder`, freshness, `owner-artifact`, and the artifact contract and layout tests;
  - public URL and shared metadata;
  - the catalog-only row rule and the review no-DB and no-samples-outside-review tests.

---

## 12. Open items

- **[coordinator]** `project-portfolio.ts` duplicates `readProjectCardStats` from `project-hub.ts`, which is outside this stream. Export it later and delete the copy.
- **[coordinator]** Projects hub and Project overview "Timeline" links should add `open=project` (round 1, still open).
- **[coordinator]** Launcher commands: "Go to all projects", "Add milestone", "Share timeline", "Preview shared page".
- **Next sprint:** drag a bar end on All projects to change the target date, and change status inline. That comes once the viewer-role checks on `setProjectTargetDateAction` and `setProjectStatusAction` are verified and undo is designed. Until then the card links to "Project overview".
- **Later:** an optional sideways Gantt view on mobile for power users.
- **Later:** presence (AvatarStack) on plan rows. It belongs to the Messages stream.

---

## 13. Acceptance checklist

Routing and data
- [ ] With v3 on, `/app/timeline` and `?workspaceId=` render All projects. With v3 off, they redirect as today. `open=project`, `project`, `projectSlug` and `mode=edit` redirect as today.
- [ ] `?zoom`, `?group`, `?sort` and `?status` round-trip, and defaults are omitted.
- [ ] Rows come only from the catalog. Samples appear only in review, never navigate, and trigger no database access.
- [ ] Unit tests pass for `parseStatusFilter`, `filterRows`, `lateMilestones`, `initialScrollLeft` and `parseQuickDate`.

All projects
- [ ] At 1440 × 900 the axis starts at y ≤ 340 and at least 9 rows are visible.
- [ ] A screenshot 300ms after `domcontentloaded` shows the Today line and the Kavanagh bar at 1440 and 390, with no later jump.
- [ ] Every bar case in 5.2 is visible in review, light and dark.
- [ ] Chips filter and write the URL. "N hidden by filters" and [Show all] work.
- [ ] The card never covers the hovered row, flips at the edges, pins with Space or click, and closes with Esc. Both exits work.
- [ ] W, M, Q, [ and ] keep the centre date. T and the docked Today pill scroll today to 30%.
- [ ] Grid keys work: ↑ ↓ J K, ← → milestone stepping announced, Home, End, Enter, Space, ".", Esc and ?.
- [ ] Forced branches verified: empty, one project, nothing dated, filter empty, unavailable, stats unavailable, milestones unavailable and truncated.
- [ ] At 390 there is no horizontal page scroll, cards share one window, the facts sheet traps focus, and sample cards open the sheet only.

One plan
- [ ] Tabs lead with the Project name. The H1 is the plan. The status line opens the share sheet.
- [ ] The runway folds Earlier, uses two label lanes and clusters. Today-to-key-date takes at least 70% of the width in the Mara & Finn review plan.
- [ ] Every edit saves through the untouched `use-milestone-edits.ts`, with rollback, retry and Undo: rename (inline and panel), date (inherit, set, none, arrows, drag), hide, audience override, add (with a quick date chip), reorder (drag, Alt+↑↓, buttons) and drift.
- [ ] Share: every state in 5.4. The minted receipt copies. Both destructive actions need a second step. Archived keeps only "Turn off all links". Member sees facts only.
- [ ] The context column shows the phone preview read-only (`inert`). Selecting a row swaps in the panel, and Esc restores it with focus return.
- [ ] Mobile: the sheet panel, the sticky Preview and Add bar clear of the safe area, 44px diamond hit areas, and Share always reachable.
- [ ] The Preview bar has a working Phone toggle, and the artifact is unchanged.
- [ ] Shared pages are in the v3 column, with no uppercase tracked labels and no "workspace".

Gates
- [ ] `pnpm typecheck` is clean for this stream's files. `pnpm test` is green, including the rewritten contracts. `pnpm build` passes.
- [ ] `vocabulary.test.ts`, `node scripts/check-first-contact-language.mjs` and the tap-target gate pass.
- [ ] A rendered check at 1440 × 900 and 390 × 844, light and dark, shows no framework overlay and no unexplained console errors.
- [ ] After-screenshots `timeline-v3r2-*.png` are saved under `.playwright-mcp/v3/core/`: all projects, hover card pinned, legend open, filter active, empty, plan, panel, drift, share sheet (live, minted, confirm armed), mobile both pages, preview phone and shared pages.
- [ ] AA text and 3:1 non-text contrast are measured for every status tone, hatch, chip and ring in both themes.
