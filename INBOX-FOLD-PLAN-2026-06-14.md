# Inbox-fold — implementation plan (2026-06-14)

Supersedes the audit in `INBOX-FOLD-BLOCKED-2026-06-09.md`. Operator approved the
shape (2026-06-14): **nudges + weekly recap → My Week as low-density rails;
notifications → a header bell + popover; mentions → per-row chips.** This file is
the implementation-ready plan. It was deliberately *not* rushed in the same session
as the approval — the fold touches the front door (My Week) and is architectural,
not a tidy-up. Per CLAUDE.md: don't break working surfaces to land a change.

## Why it's a cycle, not a one-file edit (verified in code)

- `MyWeekApp()` takes **no props** — it's a client component reading from
  `tasks-context`. (`src/components/app/my-week/my-week-app.tsx:26`)
- The inbox rails are fed by **server** computation in `src/app/app/inbox/page.tsx`:
  `compileDailyDigest`, `generateNudges(tasks, me)`, `buildWeeklySnapshotFor`,
  plus a notifications query — all `await`ed server-side and passed as props to
  `InboxApp`.
- My Week has **no standalone route loader** (it renders as a client view inside
  the `/app` shell), so it currently has no server seam to receive that data.
- The rail components (`NudgesSection`, `WeeklyRecapSection`, `Mentions`,
  `NotificationRow`) are **module-local** in `inbox-app.tsx` (not exported).

So the work is: build a data path to the My Week surface, make the rails reusable,
add the header bell, and add per-row chips. Four sub-pieces, sequenced below.

## Sequenced plan (each step independently shippable + typecheck-green)

1. **Extract reusable rails.** Move `NudgesSection`, `WeeklyRecapSection`,
   `Mentions`, `NotificationRow` (+ `NudgeCard`, `NudgeIcon`, `SectionHead`,
   `renderNotificationSentence`, the weekly-cache helpers) out of `inbox-app.tsx`
   into `src/components/app/shared/rails/`. Export them. `InboxApp` imports them —
   no behaviour change. Commit. (Pure refactor; lowest risk.)

2. **Data seam to My Week.** My Week needs `nudges` + `weeklySnapshot` (the two
   rails that earn a place on the front door). Cheapest correct path: add a thin
   server route `src/app/app/(views)/my-week/page.tsx` (or wire the `/app` shell
   loader) that runs the same parallel fetch as `inbox/page.tsx` for *just* nudges
   + weekly snapshot, and passes them to `MyWeekApp` as optional props. Keep
   `MyWeekApp` working with the props absent (so the client/context path still
   renders if the server data isn't there).

3. **Render rails as low-density on My Week.** Below the existing 5 sections
   (Today / Needs attention / Waiting / This week / Done this week), add:
   - **Weekly recap** — collapsed by default, one-line summary with a "read"
     affordance. It is the narrated read of the week; it belongs here.
   - **Nudges ("What's stuck")** — max 2–3, low-density, dismissible (reuse the
     existing localStorage dismissal). Suppress entirely on a quiet week.
   Hold the calm register: rails are quieter than the core sections, never above
   "Today", no severity-red unless genuinely urgent.

4. **Notifications → header bell.** Collapse the inbox notifications rail into a
   single quiet bell in the page header with an unread count and a popover
   (reuse `NotificationRow` + `renderNotificationSentence`). The bell is suite
   chrome, available from any view — not a My Week section.

5. **Mentions → per-row chips.** Surface "mentioned you" as a small chip on the
   affected task row (board + My Week) rather than a standalone section. Reuse the
   `Mentions` data; drop the section.

6. **Retire the inbox route — last, and only after 1–5 ship.** Add a 308 from
   `/app/inbox` → `/app/my-week` in `next.config.ts`, drop the sidebar entry, fix
   `email.ts` links and `page-header.tsx` inbox-title logic. Do NOT do this before
   the rails have a confirmed home, or you strand the four load-bearing surfaces.

## Refusals to hold during the fold
- Don't double My Week's surface area. If a rail can't be low-density, it doesn't
  go on the front door (recap collapses; nudges cap at 2–3).
- No new config/settings. No "AI" framing on the recap (it's a "weekly read").
- Notifications stay anti-notification: only @mentions + direct blocks, per
  `notification_prefs`. The bell is a quiet count, not a stream.

## Verify
`node_modules/.bin/tsc --noEmit` green after each step. Manual: complete a task,
open My Week, confirm recap + nudges read calm and the bell counts mentions.
