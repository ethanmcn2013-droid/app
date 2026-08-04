# World-Class Product Pass — implementation ledger

Two-phase pass, 2026-08-03. Lead: Claude Code (Fable).

## Phase 2 (this branch, `product-pass-2`, based on origin/main)

The first phase ran against the local `app/` tree, which turned out to be
25 commits behind origin/main — polishing a base that production had
already superseded (the T·119–T·127 board-truth and design-review work).
Deploying that tree would have regressed production. This branch restarts
from origin/main, merges PR #84 in full, ports every still-relevant fix
from phase 1, and adds the founder-directed Tasks changes.

### Adopted wholesale

- **PR #84 (T·127)** — the Timeline design-review implementation: the
  shared artifact "opens on the countdown" for couples, both metric faces
  carry the settled receipt, /s gets its own loading / not-found / OG
  image, print styles, template anchor dates. Merged cleanly; the
  `templates.generated.ts` pair regenerated and verified with
  `sync:templates:check`. The owner header row (project switcher ·
  countdown chip · view toggle · Preview and share) is the one the
  founder asked to keep — PR #84's own version of it.

### Founder-directed Tasks changes (2026-08-03)

1. Sidebar: upstream had already removed the duplicate "SIGNAL STUDIO /
   Tasks" identity block and the Assigned to me / Archived / Saved views
   rows. The remaining seam: both vertical hairlines inside the black
   bar (mark cell and identity cell borders) removed — the bar reads as
   one unbroken surface. Chrome contract still green.
2. View bar: Fields, Density and the duplicate Add task removed (the
   space is reserved); the room tools (Filter / Sort / Save view / Share)
   remain — they shipped upstream after the founder's review, flagged in
   the report for a keep/remove call.
3. Columns: upstream T·121/T·122 already ships add-column-after (the
   header +), click-to-rename, colour swatches, per-column description,
   soft limit, counts-as-done, reorder, delete. One real defect fixed:
   the full-width description crushed the column NAME to ~2px in a
   no-wrap header row — the header is now two aligned rows (uniform
   58px min-height) with the name never competing against the
   description (`option-a.module.css` laneHeader block).
4. Planning rail: reskinned from 10px grey boxes to the editorial
   register — paper ground, mono eyebrows, a clean position track with
   indigo today-dot, "Day 11 of 97" in readable prose, stat columns,
   hairline-separated unscheduled rows (`option-c.module.css`, rail
   section; behaviour untouched).

### Story coherence (carried from phase 1, re-grounded on this base)

- Canonical story on this base: **The Orchard, events** · Orla · Mara &
  Finn · wedding 2026-10-03 (the phase-1 tree's "Glenmara House" was the
  stale name). `tasks-demo.ts` literals aligned.
- The retired **2026-09-12** reappeared here as the planning-period end —
  a season closing three weeks before the wedding it plans. Frame end is
  now 2026-10-10 (wedding + 7), the sidebar derives its label from the
  frame, `calendar-frame.test.ts` pins the new value with the reasoning.
- `mock-source.ts` restates `tasks-demo.ts` facts exactly (it invented a
  due date the board disproved one click away). Signal now reads:
  "Two things calling, and one quieter signal below." — tonic 2 days
  past (true), run-sheet due today (true), menu tasting quiet fifteen
  days (true, `editedHoursAgo: 15 * 24`), and the 8 read · 4 flagged ·
  3 shown · 4 cleared accounting closes.
- Fake due-strings ("Thu", "Fri", "Mon", "next week") removed from the
  seed; real dates or honest absence.

### Phase-1 fixes ported (still needed on this base)

- Notes: Ctrl/⌘+Enter saves (Enter = newline), one privacy promise,
  "Sent to Tasks" history, subordinate search, single focus ring, serif
  reserved for user words (+ spec updates).
- Nudges: on-voice copy banks, per-task dedupe, calendar-day overdue
  maths (upstream's column-config parameter preserved).
- Inbox demo: "Due today" filters on the pinned calendar day; nudges run
  on the pinned instant; greeting hour pinned in demo (visitor-local in
  production).
- Board/list: "N days overdue" phrasing (test updated), "7 unscheduled"
  in the progress line, milestone dates as "1 Aug" (formatDate), quiet
  dashes for absent estimate/progress in the list.
- Detail panel: raw "P1 ·" codes dropped from the priority chip and
  options (labels only).
- Share artifact: real workspace name from the DB (persona-pack title was
  shown for every workspace, production included), derived `overdue` flag
  on `PublicTask` (allowlist extended deliberately, with tests; the flag,
  never the timestamp), rebuilt read-only board on the operator's own
  column config — no fake add buttons, no signup-wall cursor, no raw
  P-codes, no unverifiable "Free to start." claim; owner-only "Return to
  workspace" banner backed by a real membership check
  (`viewerIsWorkspaceMember`, anonymous-safe); "Shared from … · A Signal
  Studio product" footer.
- Signal error boundary (module + route) so failures never speak Tasks.
- Homepage sparkline aria-label no longer says "burndown".

### Verification on this branch

- `pnpm typecheck` · `pnpm lint` · full `pnpm test` — green (exit 0).
- Targeted signal suites re-run green after the coherence fixes.
- Zero console errors on all captured routes (board, list, calendar,
  inbox, my-work, notes, signal, timeline owner, share) at 1440×900.
- 7-seat independent panel (UI, UX, typography, engineering,
  accessibility, brand voice, measured evidence) with adversarial
  verification — results and remediation recorded in the session report.

### Known deliberate calls

- Filter / Sort / Save view / Share stay in the view bar (shipped
  upstream, functional); founder may still clear them.
- "2 of 9 settled" on the Timeline artifact is PR #84's deliberate
  receipt copy — kept with the adopted design.
- Phase-1's `app/` tree still holds Wave-2 VEF work uncommitted; nothing
  from it was committed or altered by this branch. Its own ledger copy
  documents the mixed-authorship files.
