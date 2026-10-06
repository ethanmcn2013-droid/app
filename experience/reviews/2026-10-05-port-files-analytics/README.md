# Files and Analytics, ported from the approved designs

Branch `design/app-v3-files-analytics` (PR #210), cut from `4ae930c1`, the commit live in production on 5 October 2026. An unshipped candidate. No deployment, promotion, database write, schema change or production change was made, and no dependency was added.

The design source stays in `src/components/concepts/` in another worktree (uncommitted, read only): `files/c5/` for Files and `final/analytics/` for Analytics. Nothing in product code imports from it; both pages were written again under `src/components/app/files/`, `src/components/app/analytics/` and `src/lib/projects/`.

Three founder instructions arrived on 5 October while this was being built and are followed here:

1. **Files**: keep the search bar; remove the "Ask about what's inside" block, its sample questions and answer card, and the "Pinned searches" and "Keys" panels. The page is the header, the search bar, then the files and the preview.
2. **One create button per screen**: neither page adds a "New task" or other create button of its own. Files keeps one secondary link, "Open Tasks", because files are added from a task.
3. **Analytics**: build the demo's Ask tab (the founder's preferred design): the scope picker, the count line, the tabs, the large ask box, and question cards in four groups, with honest matching in the box and only questions real data can answer.

## What is where

| Piece | File |
|---|---|
| Files: search, grouping, the summary line and chips, as a pure model | `src/lib/projects/project-files.ts` |
| Files: the bounded server read | `src/server/projects/project-files.ts` |
| Files: page, search and list, preview, small parts | `src/components/app/files/files-view.tsx`, `files-explorer.tsx`, `files-preview.tsx`, `files-parts.tsx`, `files.module.css` |
| Files: loading and error boundaries (new) | `src/app/app/files/loading.tsx`, `error.tsx` |
| Analytics: the calculation (extended with the late list, the last 14 days, the next 7 days and moved dates) | `src/lib/projects/project-analytics.ts` |
| Analytics: the library of questions, the word matcher and every answer sentence | `src/lib/projects/project-analytics-questions.ts` |
| Analytics: the All projects cards | `src/lib/projects/project-analytics-wall.ts` |
| Analytics: reads for one project, for every project, date changes, status and target date | `src/server/projects/project-analytics.ts` |
| Analytics: the All projects read (a thin use of the Projects page's own read) | `src/server/projects/project-analytics-wall.ts` |
| Analytics: page, ask box, scope menu | `src/components/app/analytics/analytics-view.tsx`, `ask-box.tsx`, `scope-picker.tsx`, `analytics-charts.tsx`, `analytics.module.css` |
| Busy and sparse fixtures, and the browser check | `src/lib/projects/project-files-analytics.fixture.ts`, `experience/files-analytics/` |

## Files: each element and its source

| Element of the design | Source | Kept or dropped |
|---|---|---|
| Title, scope pill | The open project's name, from the route boundary (`resolveProjectForRoute`) | Kept. The demo's scope is every project; the product's Files read is per project, so the pill names the open one |
| Summary line ("47 files across 6 projects") | Count of rows read and of distinct tasks; files added in the last 7 days | Kept, as "42 files across 14 tasks · 13 added in the last 7 days" |
| The search box | Words matched against file name, kind, the task's title and who added it | Kept. It matches words. It does not read inside files |
| "Try" chips | Counts from the same rows: added this week, each kind present, and up to three people when more than one person has added files | Kept as "Narrow", as toggles |
| "Ask about what's inside", answer card, quoted passage, "Open at the passage", "Ask Mara to approve v4" | No data: the product does not read file contents, and has no approvals on files | Dropped (founder instruction 1) |
| Sample questions under the answer | None | Dropped (founder instruction 1) |
| Pinned searches, with live counts | No storage for a saved search | Dropped (founder instruction 1) |
| Keys panel | None needed | Dropped (founder instruction 1). The keys still work and are listed under "Capabilities" below |
| "Jump back in: files you opened this week" | No record of who opened what | Dropped. The list opens on "Added in the last 7 days", which is recorded |
| Results list: glyph, name with the matched words lit, meta, task link | Kind from the provider, MIME type or file extension; size; storage; uploader; added date; task title | Kept |
| Result groups ("Best match", "Also mentions", "Older versions") | Where the words were found | Kept as "Named …", "On a task matching …", "Added by …", and a mixed group. Versions are not recorded, so there is no "Older versions" |
| Version, "Approved by", "Waiting for", "Draft", "Signed" | No data | Dropped |
| Snippet from inside the file, page number | No data | Dropped |
| Locked file in someone's Drive, "Ask for access" | The read has only "pending" for an upload not finished | Dropped; a pending upload says "Not ready to open yet" |
| Preview: header, kind, size, who added it and when, task | The same row | Kept |
| Preview: the document's text with the passage lit | No data | Dropped. An uploaded PNG, JPEG, GIF or WebP is shown through `/api/attachments/[id]`; any other kind shows its facts and opens where it lives |
| Preview: Open, Copy link | The row's `href` | Kept |
| "Also read text in images" | No data | Dropped |

The freed space is used by docking the preview beside the list from 1280px (it always shows the chosen file, or the first), and by the list running the full column below that.

## Analytics: each element and its source

| Element of the design | Source | Kept or dropped |
|---|---|---|
| Scope picker ("All projects · 15 active", or one project) | The membership catalog (`loadProjectCatalogAction`): active projects the reader can open | Kept. With one project it is a label, not a menu. With no scope in the address the page covers every project when there are two or more |
| Count line | All projects: the Projects console's own summary (active, need a look, open, late) plus tasks done in the last 7 days. One project: open, late, done in the last 7 days | Kept. "Off track" is not a status the product has; the line uses the console's "need a look" (marked at risk, or past its target date) |
| Tabs: Ask, All projects, Replay | | Ask and All projects kept. Replay dropped (below) |
| The ask box, "/" hint, helper line | A fixed library of questions; typing matches their keywords, with light stemming and a few synonyms, in the browser | Kept. See "The ask box" below |
| Four groups of question cards with small glyphs | The library | Kept: eight cards in four groups of two |
| "Most asked" tag | No record of what is asked | Dropped |
| "Your answers" (pinned answers) | No storage | Dropped |
| "Pin", "Copy as sentence" on an answer | No storage for pins | Dropped. The sentence is plain text and can be selected |
| Answer: question, sentence with its figures underlined, actions, chart, caption | `computeProjectAnalytics` over real tasks | Kept |
| "Ask a follow-up" | The library is all there is | Dropped; "All questions" goes back to the cards |
| "All projects" wall of cards, sorted by "Needs a look" | `loadProjectHub`, the Projects page's read | Kept (below) |

### Each question

| Card in the design | What ships | Source | Notes |
|---|---|---|---|
| Which projects are in the worst shape? ("Your pace against the date") | Same question; hint "Late work against the dates set". For one project it reads "Are we on track?" | All projects: each project's status and target date (set by its owner), done of total and late count, from the hub. One project: late, open, due in 7 days, finished and added in 7 days, target date and status | No pace and no "likely done" date: that is a forecast. The answer states what is late and dated |
| What changed this week? | Same | Tasks finished per day for 14 days, finished and added in the last 7 | Kept |
| Who has too much on? | Same question; the answer says who holds the most | Open tasks per current member, late and due this week | The page counts work; it does not judge how much is too much, and the caption says so |
| What should we do first next week? | Same; hint "The next 7 days, in order" | Open tasks due today or in the 6 days after, by date then priority | "Next week" is the next 7 days, the rolling week every other figure uses |
| What keeps slipping? ("How often dates move, by group") | Same question; hint "Dates changed more than once" | The activity record: one row each time a task's due date is set or changed (`activities`, kind `update`, field `due`) | Ships where that record can be read. It counts changes, not how far a date moved or why, and the caption says it includes the first time a date was set. Only tasks changed more than once are listed. Review mode has no such record, so the card is absent there |
| What is late and why? ("Each late task, by reason") | "What is late, and who has it?"; hint "Each late task, oldest first" | Open tasks past their date, with who holds each | No reason is recorded anywhere, so none is given, and the caption says so |
| Where does our time go? ("Waiting against doing") | Dropped | Needs how long tasks spent in each status. The activity record notes moves between the four built-in lanes only, not custom columns, and is written best-effort beside each edit, so durations summed from it would be wrong | Replaced in the Patterns group by "Where is the work sitting?" (tasks by column and priority), which the earlier page already showed |
| How long do things usually take us? ("Usual days, by group") | Same; hint "Days from added to finished" | Created to finished, per task, with the median and the on-time share | Not by group: tasks have no group |

When the date-change record cannot be read, "What keeps slipping?" is left out and the late question moves into "Where we stand", giving three groups (3, 2, 2) so no group holds a single card.

### The ask box

It is not a language model and nothing on the page says or implies it is. `matchQuestions` scores what was typed against each question's keywords; anything under the threshold is no match. The matching questions show under the box as you type, Enter opens the best one, and when nothing matches it says "No ready answer for that yet. These are the questions I can answer." and the cards stay on screen. Enter then opens nothing.

The placeholder is the founder's ("What do you want to know across your projects?"). The helper line's last clause is changed from "or type your own" to "or type to find one", because "type your own" promises an answer to any question. This is a delegated decision, the founder's to reverse.

### All projects

Fed only by `loadProjectHub`, the Projects page's read: the catalog decides the list, and counts are read only for ids from it. The cards are the Projects console's own rows (`buildConsole`), so the two pages cannot disagree: how it is doing, next big date or target date, the last 14 days of finished tasks, done of total, open, late, done in the last 7 days, the oldest late task, and the lead. Sorted by "Needs a look" by default, or by most late, next date or name. Dropped from the demo's wall: the weeks switch and "Same scale", the table view, pinning a week, the "Likely done" line and the written note on each card (a forecast and prose with no source), and "Finished on time" per project (not read across projects).

### Replay

Not included, and the tab is omitted. A replay of the board needs every status change of every task. The activity record has moves between the four built-in lanes but not between custom columns, has no entry for tasks created by a template or an import, and is written best-effort (a failed write is dropped by design, `src/server/db/activity.ts`). A board replayed from it would show states that never existed. Finish and creation times are reliable and already drive the weekly and daily charts.

## Capabilities kept

Everything the earlier pages did is still possible.

**Files**

| Before | Now |
|---|---|
| Search files or tasks | The search box; it also matches who added a file and the kind |
| Filter by type (All, Documents, Images, Sheets, Links) | The Narrow chips; "Show all files" clears them |
| List and grid layouts | The switch at the top right of the list |
| Open or download a file | The icon at the end of each row, and "Open file" in the preview. Uploads still go through `/api/attachments/[id]`; Drive and link addresses are still checked by the server read (`https` or `http`, no credentials; Drive hosts only) and open in a new tab with `noopener noreferrer` |
| Open the task a file is on | The task link on each row and in the preview |
| The four figures (all files, uploaded with size stored, Google Drive, links) | The summary line, and one line under the list |
| "Open Tasks" | Top right |

New: `?archived=1` includes files on archived tasks (a link at the foot of the page turns it on and off). Keys: `/` moves to the search box, Down enters the list, Up and Down, Home and End walk it, Enter chooses a file, Escape clears the box or closes the sheet.

**Analytics**

| Before | Now |
|---|---|
| Five figures (open, finished, late, time to finish, on time) | Open, late and finished in the count line; time to finish and on time under "How long do things usually take us?" |
| Range switch (4 weeks, 12 weeks, 6 months) | On the answers whose chart it changes: who, slipping and how long |
| Finished each week (bars, added line, average) | "Are we on track?" for one project |
| What changed this week | Under "Which projects are in the worst shape?" / "Are we on track?" and "What changed this week?" |
| Where tasks are; open tasks by priority | "Where is the work sitting?"; priority also under the late and next questions |
| Due in the next 14 days | Under the shape, late and next questions |
| Who has what | "Who has too much on?" |
| Time to finish | "How long do things usually take us?" |
| How these numbers are counted | Still at the foot of Ask, with three lines added |

## What an empty and a sparse account see

Judged on the fixture (`?state=sparse`, `?state=empty`), since review mode has one sample project.

- **Sparse** (the founder's own account: one project, nine test tasks, nobody assigned). Files with two files: the summary, three chips, both rows and the preview; no people chips. Analytics: the scope is a plain label with the project's name; the count line is "7 open · 1 late · 2 done in the last 7 days"; all eight cards are there and each answers plainly from what exists ("No one is assigned to any of the 7 open tasks.", "No task had its date changed more than once in the last 12 weeks.", "Half of tasks are finished within 2.5 days…, from 2 tasks"). All projects shows one card.
- **Empty**. Files: the header, "No files yet", one sentence and "Open Tasks". Analytics with no tasks ever: "Nothing to measure yet" and "Open Tasks"; All projects with none active: "No active projects".
- **No project open** (either page): "No project open" and "See projects".
- **Loading**: a tracing of each page (header, box, chips or cards, rows, the docked preview). **Error**: "The files didn't load" / "The numbers didn't load", with Try again and Open Tasks.
- **A read that failed**: a cut-short Files read says older files are not listed; All projects without task counts or finished days drops those figures from the cards; a list that could not be read says so and leads back to Ask.

## New server reads, and how each is scoped

All are read-only selects. None is a Server Function or takes an id from a request.

| Read | Scope |
|---|---|
| `readProjectFilesWith` (rewritten) | The project the route boundary already proved. Resources where both the row and its task belong to that project; attachments through their task; names from that project's `workspace_members` only. Each source newest first, at most 1,000 rows; archived tasks excluded unless asked |
| `loadProjectStanding` | Two `meta` keys of the proved project (status, target date), the keys the overview writes |
| `readDueChangesWith` | `activities` filtered to the given project ids, kind `update`, in the period; at most 5,000 rows; only changes to the due date are kept |
| `loadAnalyticsProjects` | `loadProjectCatalogAction`: active, selectable rows; at most 200 |
| `readPortfolioInputWith`, `loadPortfolioAnalytics` | Ids from `loadProjectCatalogAction` and nowhere else. Tasks, column settings, members and date changes all filtered to those ids; the same 5,000-row bound as the single-project read. A person is named only on tasks of a project they are a member of; anyone else assigned is an unnamed former member |
| `loadAnalyticsWall` | No select of its own: `loadProjectHub` |

The first, fifth and third are proved against the real schema in a disposable in-memory database (`project-files.test.ts`, `project-analytics-portfolio.test.ts`), including that another project's rows and an outsider's name never come back.

## The two pre-release findings

- `project-files.ts` named anyone who had ever added a file, read without a limit, and included files on archived tasks. Fixed as above: current members only ("A former member" otherwise, never a name), bounded with a notice when cut short, archived excluded unless asked.
- `project-portfolio.ts` took "today", each project's first day and each big date from UTC. They now come from the reader's saved time zone (UTC when unset), the same day Analytics and the Projects console use. Review still uses its pinned clock.

## Capture record

Screenshots are not kept in this repository (the release operator's diff buffer). They are in the design lab repository under `work/2026-10-01-landing-v3-2026-10/shots/app-reviews/2026-10-05-port-files-analytics/`, uncommitted there.

`review-mode/`: the real routes from a production build served by `next start` on port 4388 (`VERCEL_ENV=preview`, `NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review`, `SIGNAL_ACTIVE_PROJECT_V3_ENABLED=true`), never `next dev`. Files, Ask, seven answers and All projects at 1920x1080, 1440x900, 768x1024 and 390x844, dark and light, plus the preview, a search and the ask box mid-typing: 104 PNGs and `audit.json`. On all 80 audited pages: status 200, the theme resolved, no sideways scroll, no framework overlay, no console or page errors. Axe reports five moderate landmark findings on every page, all of the shell (two banners, no main landmark, no skip link, and so content outside a landmark); nothing serious or critical and nothing in colour contrast.

`fixture/`: the busy, sparse and empty accounts, from the repo's own check:

```
pnpm test:files-analytics:browser                               # checks only
node experience/files-analytics/run.mjs --capture <directory>   # checks, then screenshots
```

Expected result: `PASS files and analytics: 1782 checks across wide, desk, tablet and phone, light and dark`. It bundles the real pages with their real styles and the v3 tokens, stubs only `next/link` and `next/navigation` (a link changes the address in place) and the loading boundary's arrival effect, and adds no route. Names are `<surface>-<state>-<size>-<theme>.png`; `-full` is the whole page.

## Where this falls short of the approved designs

- Files has no answer from inside a file, no versions, approvals or snippets, and no pinned searches. The product records none of them.
- Files is per project; the demo searched every project at once.
- The Files preview shows pictures only. A PDF or a document shows its facts and opens in place.
- Analytics has no Replay, no "Where does our time go?", no pace or "likely done" date, no pinned answers and no "Most asked" tag.
- "What keeps slipping?" and "What is late" answer narrower questions than their demo cards (how often a date was changed; who holds each late task), and say so.
- The charts under the answers are the product's existing charts and plain lists, not the demo's bespoke ones (the course line, the slope, the waffle).
- The All projects wall has one fixed 14-day chart per card, not a 6 or 12 week one on a shared scale, and no table view.
- Review mode has one project and no activity record, so every project at once, the scope menu and the slipping question were judged on the fixture, not on real data. Nothing here was seen on the founder's account.
- In review mode the sample project's other assignees are not members, so "Who has too much on?" shows them as "Former member". That is the rule working on thin sample data.

## Registry refresh and receipts

Four registered sources changed and two are new (Files had no loading or error boundary). Schema `signal-materiality-review/2`, written by `pnpm experience:review` against the attestation `experience/evidence-runs/tasks-playwright-80b2f4d0f1c10e2ab2461d63-2ad6b9cf2f029e0c.json`: 132 of 132 on a demo-mode production build of `ee2ccc1b` (`next build`, then `next start` on port 4391 with the environment `experience/playwright.config.ts` sets; the config's own four-minute server start timed out twice on this shared machine, so the server was started first and reused).

| Entry | Why | Receipt in `receipts/` |
|---|---|---|
| `tasks.page.app-analytics` | Scope, part, question, range and sort from the address; the new view | new hash `b3dc20fe2d960e0f` |
| `tasks.state.app-analytics-loading` | The skeleton traces the new page | new hash `9a83f9e97a750b1b` |
| `tasks.state.app-analytics-error` | New header markup only | new hash `16a0888ed7b367ab` |
| `tasks.page.app-files` | The bounded read, `?archived=1`, the new view | new hash `7a85240486792b54` |
| `tasks.state.app-files-loading` | New surface | first hash `9beac142f8f04cb2` |
| `tasks.state.app-files-error` | New surface | first hash `83d088f7615c6a6b` |

One commit follows the attested run: the question matcher moved to its own module and the Files skeleton to its own file (both to keep client code out of a second bundle), the bundle ceiling, and this record. The unit tests, the 1,782-check browser run and the review-mode capture were repeated on them; the 132-case run was not, and CI runs it on the pushed head. No mapped critical fixture changed, so `experience:fixtures:write` was not needed. The linked case in each receipt is suite regression context; no critical case opens `/app/files` or `/app/analytics`, which is why the rendered evidence for these pages is the two capture sets above.

## The bundle ceiling

`total_client_js` measured 1062.9 KB gzip on the first build against a ceiling of 1042. Moving the matcher and the skeleton out brought it to 1050.2. What remains is the pages' own client code: the Files search, list and preview (about 7.4 KB gzip) and the Analytics ask box and scope menu (about 4.0 KB). The ceiling is raised from 1042 to 1053 in `contracts/venue-surface-performance-budgets.v1.json`, with the basis written there. This is a delegated decision under the redesign sprint's clause ("raise the budget explicitly if a better shell needs it") and is the founder's to confirm or reverse. The 936 target is unchanged. If another branch raises the same line, the two need adding together when they meet.

## Checks

Run on this worktree, Windows. Every browser row ran against a production build (`next build`, then `next start`) or the bundled fixture, never `next dev`.

| Check | Result |
|---|---|
| `pnpm typecheck` | Passed |
| ESLint on every changed file | Passed, no errors or warnings |
| Unit and contract tests touched: `project-files-analytics.test.ts`, `project-files.test.ts`, `project-analytics-portfolio.test.ts`, `project-analytics.test.ts`, `project-portfolio.test.ts` (both), `project-console.test.ts`, `project-console-facts.test.ts`, `project-hub-console-demo.test.ts` | 80 of 80 |
| Module boundaries; first-contact language | Passed; clean |
| `pnpm build` in review mode, with the token check | Passed: 67 tokens defined, none undefined |
| `pnpm test:files-analytics:browser` | Passed, 1,782 checks |
| `pnpm test:project-console:browser` | Passed, 225 checks |
| Review-mode capture of the real routes | 80 pages: all 200, no sideways scroll, no overlay, no console errors; axe moderate landmark findings from the shell only |
| `experience:self-test`, `experience:fixtures` | Passed; 37 of 37 mapped |
| `experience:test` critical capture | 132 of 132 on `ee2ccc1b` |
| `experience:validate` | Six expected failures before the receipts; clean after them. `attest --verify-receipts` passed |
| `perf:budgets`, `perf:budgets:self-test` | Passed at 1050.2 KB gzip against the raised ceiling of 1053 |
| Full `pnpm test` | Not run locally in full; CI runs it |
| The rest of `registry-and-drift` (`test:recipient-context:browser` beyond the two checks above, `test:notes-recovery:browser`, `test:event-export:browser`, `test:project-recovery:browser`, `test:settings-hydration`, `experience:test:timeline-switcher`, the council steps) | Not run locally. None opens Files or Analytics. Timeline's "All projects" reads `project-portfolio.ts`, whose days now follow the reader's time zone; its review rows and pinned clock are unchanged, and its own unit tests pass. CI is the judge |
