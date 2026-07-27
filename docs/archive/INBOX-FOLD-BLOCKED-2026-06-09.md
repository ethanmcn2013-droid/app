# Inbox-fold blocked — 2026-06-09

Deferred follow-on to T·84. Audit ran; fold not executed; routes preserved.

## What was audited

`/app/inbox` (page + `inbox-app.tsx`) renders **six** distinct rails:

| # | Rail | In My Week? | Load-bearing? |
|---|---|---|---|
| 1 | Nudges feed ("What's stuck") — rules-based + LLM-narrated, per-user dismissal via localStorage, severity tones (urgent/warn/info), 6 distinct nudge kinds | **No** | Yes — this is the proactive surface; My Week is reactive (it shows what's bucketed, not what's stuck) |
| 2 | Weekly recap — LLM-streamed Sunday digest with localStorage cache, regenerate affordance, quiet-week empty-guard | **No** | Yes — the only narrated read of the week; no equivalent in My Week |
| 3 | Daily digest greeting + subhead | Yes (My Week's date header + greeting cover it) | No |
| 4 | "Closed yesterday" + "Due today" cards | Yes (My Week's "Today" and "Done this week" sections cover both) | No |
| 5 | Mentions in last 24h | **No** | Yes — cross-product social surface; nowhere else in the app |
| 6 | Direct alerts (notifications: mentions/blocked/dueToday) | **No** | Yes — the only inbound notification surface |
| 7 | Action affordances: ShareThisWeek, CopySlackSummary, RollForwardButton | **No** | Yes — Share/Copy are tied to weekly snapshot; Roll-forward is the only way to bulk-move overdues |

## Why the fold is non-trivial

Four load-bearing rails (nudges, weekly recap, mentions, notifications) plus three header actions need a home in My Week. My Week today is a calm 5-section list (Today / Needs attention / Waiting / This week / Done this week). Folding four more sections + a 3-button header doubles its surface area and breaks the "calm editorial briefing" register T·82 deliberately struck.

The right shape is not "shovel everything into my-week-app.tsx." It's a design pass — does the briefing earn nudges above the fold, or below? Does the weekly recap belong on My Week at all or at `/app/this-week`? Do notifications collapse into a single quiet count in the header with a popover? Mentions could become a chip on affected task rows rather than a separate section.

That's a design decision worth surfacing to the operator before code lands, not a tidy-up the agent should make unilaterally.

## What was NOT done

- `/app/inbox` route preserved (still reachable, no banner added).
- `MyWeekApp` unchanged.
- `next.config.ts` unchanged (no 308 redirect added).
- Sidebar `/app/inbox` nav entry preserved.
- `page-header.tsx` inbox-title logic preserved.
- `email.ts` inbox link preserved.
- No commits, no pushes — `git status` is clean of fold-related changes.

## Recommendation

Treat the inbox-fold as a design exercise, not a code cleanup. Open it as a brief: "My Week is the front door. Where do nudges, the weekly recap, mentions, and notifications live in that briefing without breaking its calm register?" Likely answer involves moving nudges + weekly recap into My Week as low-density rails, collapsing notifications into a header bell with a popover, and surfacing mentions as per-row chips. That's a cycle, not an in-line fold.

## Constraint cited

CLAUDE.md task brief, section "Constraint": *"If you discover the inbox audit reveals that My Week is actually missing a critical rail and the fold is non-trivial, STOP before deleting the inbox route... return without pushing destructive changes. Pragmatism over completionism — don't break working surfaces to land a tidiness move."*

This is that case. Four critical rails, non-trivial fold. Stopping.
