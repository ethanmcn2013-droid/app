# Tasks · Posts Week 1 (Mon 2026-05-11 → Sun 2026-05-17)

Verbatim copy-paste deck. Bodies pulled from `gtm-week-1.md`. Tick the box once posted.

Voice rules — dry, observational, em-dashes welcome, no emojis, no hype. Every URL stays as `tasks-nu-hazel.vercel.app` until the custom domain is swapped.

---

## Monday 2026-05-11 — Profiles live + pinned posts

### Mon 05-11, 9:00am ET — X (pinned post, single)
- [ ] Post

> We published a list of eight features we'll never ship. /principles — the other roadmap.
>
> tasks-nu-hazel.vercel.app/principles

After posting: click *more* → *pin to your profile*.

### Mon 05-11, 9:15am ET — X (thread, 5 posts) — refusal list
- [ ] Post 1/5
- [ ] Post 2/5
- [ ] Post 3/5
- [ ] Post 4/5
- [ ] Post 5/5

**Post 1/5:**

> Most product roadmaps are a list of yeses. We published the other list. Eight features Tasks will never ship. Here's why.

**Post 2/5:**

> No per-seat pricing. Inviting a collaborator should not be a budget decision. Add the whole study group, both moms, the DJ. Same price.

**Post 3/5:**

> No Gantt charts. Timeline view is the friendly cousin — a sequence you can read at a glance. Gantt charts are the language of consultants, not collaborators.

**Post 4/5:**

> No AI agent that runs your tasks for you. The dopamine of crossing it off is not outsourceable. Tasks AI surfaces what's stuck. It never closes the loop on your behalf.

**Post 5/5:**

> No real-time push notifications. The daily digest is the only scheduled outbound channel. If a tool's strategy is winning more of your attention, the tool isn't on your side.
>
> Full list: tasks-nu-hazel.vercel.app/principles

### Mon 05-11, 11:00am ET — Bluesky (pinned post, single)
- [ ] Post

> Most roadmaps are a list of yeses. We published the other list — eight features we'll never ship.
>
> tasks-nu-hazel.vercel.app/principles

After posting: profile → ⋯ → *pin post*.

### Mon 05-11, 11:30am ET — Bluesky (single, founder intro)
- [ ] Post

> I built a productivity tool for the 80% of people who don't work in tech. Wedding planners. College students. Freelancers. Trades. Families running events from spreadsheets.
>
> No sprints. No epics. No vocabulary tax. tasks-nu-hazel.vercel.app

---

## Tuesday 2026-05-12

### Tue 05-12, 9:00am ET — X (single)
- [ ] Post

> No AI summary. No inbox. No streaks. No daily mood reflection. No focus timer. Tasks does the boring thing — it tracks what you have to do — without trying to also be a journal, a meditation app, or your therapist.
>
> tasks-nu-hazel.vercel.app

### Tue 05-12, 10:00am ET — Bluesky (single, strikethrough manifesto excerpt)
- [ ] Post

> Sprint planning. Epic refinement. Ticket triage. Issue grooming. Story points. Burndown reviews. Stand-up rituals. Backlog dependencies. Gantt cascades. OKR alignment.
>
> None of that is true.
>
> tasks-nu-hazel.vercel.app/about

---

## Wednesday 2026-05-13

### Wed 05-13, 9:00am ET — X (thread, 4 posts) — domain packs
- [ ] Post 1/4
- [ ] Post 2/4
- [ ] Post 3/4
- [ ] Post 4/4

**Post 1/4:**

> Tasks ships with four "domain packs" — workspace skins keyed to who you are. Wedding. Freelance. Student. Marketing. The same product, different defaults. Here's what changes.

**Post 2/4:**

> Wedding pack: serif typography, blush florals, calendar view default. Lane labels read *To plan / In progress / Reviewed / Done* — not *To do / Doing / Review / Done*.

**Post 3/4:**

> Freelance pack: code-on-paper mono. Lane labels read *Backlog / Active / Awaiting client / Invoiced*. Calendar view shows tax dates as red dots, default.

**Post 4/4:**

> Student pack: marker-on-corkboard sticky notes. Lane labels read *Reading / Drafting / Edits / Submitted*. Cycle 23 walks through how each pack got built.
>
> tasks-nu-hazel.vercel.app/changelog

### Wed 05-13, 1:30pm ET — Bluesky (single, cycle 22 narrative)
- [ ] Post

> Cycle 22 — five features in one cycle, parallel-agent dispatch. iOS share-sheet, cross-workspace search, share-card PNG, remix, contacts. 27 sub-agent dispatches across the sprint. 0 broken builds.
>
> The whole writeup is at /changelog.

---

## Thursday 2026-05-14

### Thu 05-14, 9:00am ET — X (thread, 4 posts) — auto-running showcase
- [ ] Post 1/4
- [ ] Post 2/4
- [ ] Post 3/4
- [ ] Post 4/4

**Post 1/4:**

> The hero on tasks-nu-hazel.vercel.app is a fully-autonomous demo. It scripts a 30-second loop of three users moving cards, leaving comments, switching views, all over real cursors with real motion physics. No video. Live React.

**Post 2/4:**

> The trick is `LayoutGroup` + `layoutId` — when a task moves between board / list / timeline, it FLIPs in place rather than fading out and back in. Same DOM node, four geometries.

**Post 3/4:**

> Cursors carry weight. When David picks up a card, the cursor's spring-physics target lags the card by 80ms. You can see him *holding* it. Sounds small, reads like life.

**Post 4/4:**

> The whole demo runs on the same task data the app uses. Marketing isn't a different app — it's the app, on autopilot, in a loop.
>
> Source: src/components/showcase/cinematic-demo.tsx

### Thu 05-14, 9:20am ET — Bluesky (single, wedding template)
- [ ] Post

> Wedding planner, three months out. RSVPs, seating, vows, the small fires before the big day. The free template is at tasks-nu-hazel.vercel.app/templates/wedding-3-month-countdown.

### Thu 05-14, 3:00pm ET — Designer News submission
- [ ] Submit

URL: `tasks-nu-hazel.vercel.app/principles`
Title: *Eight features we'll never ship — a productivity app's public refusal list.*

### Thu 05-14, 4:00pm ET — Sidebar.io submission
- [ ] Submit

URL: `tasks-nu-hazel.vercel.app/about`
Title: *Project management shouldn't be behind a paywall — a designer's manifesto.*

---

## Friday 2026-05-15 — First HN cross-post

### Fri 05-15, 9:00am ET — Hacker News (Show / Ask HN cross-post)
- [ ] Post

**Title (under 80 chars):**

> How we shipped 5 features in one cycle with parallel sub-agents

**Body:**

> We've been shipping a small productivity tool [tasks-nu-hazel.vercel.app] in weekly cycles. This week's was the first time we ran 5 sub-agents in parallel on non-overlapping file scopes — and it held. 27 dispatches across the sprint, 0 broken builds.
>
> Here's what made the difference:
>
> 1. **File-scope discipline.** Each agent owned exactly one or two files. The agent dispatching the iOS share-sheet feature couldn't touch the schema; the schema-touching agent couldn't touch any other agent's UI. The five features this cycle — PWA share-target, a cross-workspace overdue command, a share-card PNG, template remix, and an external-contact field on tasks — each lived in its own file island. No collisions in any of the 27 dispatches.
>
> 2. **A "trap" file in every domain.** When an agent stepped into a surface where we'd already learned a hard lesson — Turbopack on Next.js 16 won't pipe `next/og`'s streaming Response under a Route Handler, only under the OG image file convention — we documented the trap in-file as a comment. The next agent inherits the lesson. The share-card feature this cycle hit exactly that trap; the architect moved the file from `/api/share-card/[id]/route.tsx` to `/share-card/[id]/opengraph-image.tsx` (default export), and we wrote the lesson into the file's preamble so it doesn't recur.
>
> 3. **Parallel-but-staggered for rate limits.** Five at once worked. Eight at once tripped the rate limit in an earlier cycle. Sweet spot has been 4-then-4 batches with vertical-landing work in between — small architect-level integrations that don't need a parallel dispatch but bridge the agents' outputs.
>
> Total dispatch time for all five agents to come back: ~10 minutes wall-clock. The architect-level integration fix on the share-card cost about 15 minutes after the fact. Net throughput on the cycle was a multiple of any single-agent week we've run.
>
> The whole codebase is open: tasks-nu-hazel.vercel.app/changelog reads itself, so every cycle's full narrative — including the operating-loop notes — is at /changelog.
>
> Curious what others are doing with parallel sub-agents — what's your file-scope pattern? Anyone running >5 agents reliably?

After posting: note the timestamp and item id. Open the post in a second browser tab to monitor. Reply pattern: 5–10 min between replies for the first hour. Don't argue with "looks like Notion / Linear / Asana." Acknowledge it's a crowded space; point to /principles.

### Fri 05-15, 10:00am ET — X (single, hook + HN link)
- [ ] Post

> 22 cycles, 27 sub-agent dispatches, 0 broken builds. What we learned shipping 5 features in one cycle with parallel agents.
>
> news.ycombinator.com/item?id=[insert-id]

### Fri 05-15, 12:00pm ET — Bluesky (single, refusal list pull-quote)
- [ ] Post

> "If a tool's strategy is winning more of your attention, the tool isn't on your side."
>
> — from /principles, refusal #5
>
> tasks-nu-hazel.vercel.app/principles

---

## Saturday 2026-05-16 — REST

No posts. No replies. No KPI checks.

---

## Sunday 2026-05-17 — LIGHT

### Sun 05-17, 11:00am ET — X (single, calendar-view screenshot)
- [ ] Post

Take a screenshot of `tasks-nu-hazel.vercel.app/app/calendar` (Playwright MCP at viewport 1440×900). Attach.

> Calendar view. Same tasks as the board, the list, the timeline. Different lens.
>
> [screenshot]
>
> tasks-nu-hazel.vercel.app

---

## Quick-reference ledger — Week 1

| Day | Posts |
|---|---|
| Mon 05-11 | X pinned + 5-thread; Bluesky pinned + intro |
| Tue 05-12 | X single; Bluesky single |
| Wed 05-13 | X 4-thread; Bluesky single |
| Thu 05-14 | X 4-thread; Bluesky single; Designer News submit; Sidebar.io submit |
| Fri 05-15 | HN c22 cross-post; X HN-link; Bluesky pull-quote |
| Sat 05-16 | REST |
| Sun 05-17 | X calendar screenshot (LIGHT) |

**Total post count week 1:** X 12 (1 pinned + 5 in pinned thread + 6 daily including the Sunday LIGHT) · Bluesky 6 · HN 1 · Designer News 1 · Sidebar.io 1.
