# Tasks · Posts Week 3 (Mon 2026-05-25 → Sun 2026-05-31)

Verbatim copy-paste deck. Tick the box once posted.

Voice rules — dry, observational, em-dashes welcome, no emojis, no hype. Every URL stays as `tasks-nu-hazel.vercel.app` until the custom domain is swapped.

---

## Monday 2026-05-26 — Strikethrough manifesto annotated

### Mon 05-25, 9:15am ET — X (thread, 8 posts) — annotated manifesto
- [ ] Post 1/8
- [ ] Post 2/8
- [ ] Post 3/8
- [ ] Post 4/8
- [ ] Post 5/8
- [ ] Post 6/8
- [ ] Post 7/8
- [ ] Post 8/8

**Post 1/8:**

> The /about page on Tasks has a strikethrough block — ten phrases the industry uses, all crossed out. *Sprint planning. Epic refinement. Ticket triage. Issue grooming. Story points. Burndown reviews. Stand-up rituals. Backlog dependencies. Gantt cascades. OKR alignment.* Here's what each one is supposed to do, and what we replaced it with.

**Post 2/8:**

> *Sprint planning.* Allocates work into a fixed time-box. We replaced it with a list of cards in the Doing lane. The cards are the plan. The drag is the planning. There is no separate ritual.

**Post 3/8:**

> *Epic refinement.* Means breaking a feature into smaller features. We don't have epics. If a card is too big, you make more cards. The act of making more cards is the refinement.

**Post 4/8:**

> *Story points.* Estimates effort on a Fibonacci scale. We don't estimate. The card has a due date or it doesn't. The list either gets shorter or it doesn't. Estimates are a stand-in for finishing.

**Post 5/8:**

> *Burndown reviews.* Charts remaining work over time. We have a sparkline next to the workspace name that ticks down silently as cards close. There is no review meeting attached to it.

**Post 6/8:**

> *Stand-up rituals.* Synchronous status meeting. Replaced by the daily digest — one inbox email a day with what changed. Async, scannable, doesn't break flow.

**Post 7/8:**

> *Gantt cascades.* Dependencies visualized as cascading bars. Timeline view shows duration, no cascade. If a task slips, the next task doesn't auto-shift — because in real life, the wedding doesn't move just because the cake is late.

**Post 8/8:**

> *OKR alignment.* The annual ritual that maps everyone's quarterly work to a tree of objectives. We don't ship OKR fields. The work is the objective. The list is the alignment. tasks-nu-hazel.vercel.app/about.

---

## Tuesday 2026-05-26

### Tue 05-26, 9:00am ET — X (thread, 7 posts) — cycle 22 narrative
- [ ] Post 1/7
- [ ] Post 2/7
- [ ] Post 3/7
- [ ] Post 4/7
- [ ] Post 5/7
- [ ] Post 6/7
- [ ] Post 7/7

**Post 1/7:**

> Cycle 22 was the cycle we shipped five A-tier features in one cycle, parallel-agent dispatch. Five surfaces, five sub-agents, ten minutes of wall-clock time, zero broken builds. Here's how each landed.

**Post 2/7:**

> 1) iOS share-sheet capture. The PWA manifest declares Tasks as a `share_target`, so iOS Safari's share sheet lists Tasks alongside Notes and Mail. Share a URL, the quick-add modal opens with the title and link pre-filled. Save what you saw.

**Post 3/7:**

> 2) Cross-workspace overdue command. ⌘. opens a 440px popover top-right, listing every overdue task across every workspace you're in, grouped by workspace, sorted most-overdue-first. Click flips the active workspace and routes to the board. Empty state: *"Nothing's late. The rare clean inbox."*

**Post 4/7:**

> 3) Share-card PNG from the daily digest. The /share-card/[workspaceId]/opengraph-image route renders a 1200×630 PNG showing how many tasks closed that week. Inbox digest gains a "Share this week" button. Drop it in Slack, the count lands as an image.

**Post 5/7:**

> 4) Template remix. Open any template at /templates/[slug], hit *Remix in a new workspace*, you get a fresh workspace named *"{template name} · my remix"*, owned by you, slugged uniquely, all tasks pre-applied. The template stays untouched. Your remix is yours.

**Post 6/7:**

> 5) External contact field on tasks. Two new nullable columns: contact name, contact email. The detail panel shows a quiet *+ Add contact* chip when empty, *Name · email* when present. Absorbs the wedding-vendor / freelance-invoice spreadsheet column in one move.

**Post 7/7:**

> Sprint parallel-agent throughput across cycle 22: 27 dispatches, 27 complete, 0 broken builds. The full operating-loop write-up is at tasks-nu-hazel.vercel.app/changelog.

### Tue 05-26, 10:00am ET — Designer News submission
- [ ] Submit

URL: `tasks-nu-hazel.vercel.app/principles`
Title: *Eight features we'll never ship — a productivity app's published refusal list.*

### Tue 05-26, 10:00am ET — Bluesky (single, cycle 22)
- [ ] Post

> Cycle 22 — five A-tier features in one cycle. iOS share-sheet, ⌘. cross-workspace overdue, share-card PNG, template remix, external contact field. Five sub-agents in parallel, ten minutes wall-clock, zero broken builds.
>
> The full narrative is at tasks-nu-hazel.vercel.app/changelog.

---

## Wednesday 2026-05-27

### Wed 05-27, 3:00pm ET — YouTube (upload 90s feature walkthrough)
- [ ] Upload

**Title:** Tasks — 90 seconds. The whole product.

**Description:**

> A 90-second walkthrough of Tasks. Board, list, timeline, calendar — the same tasks, four lenses. Comments where the work is. AI that nudges, never agents that finish.
>
> Per-workspace pricing, not per-seat. Built for the 80% who don't work in tech.
>
> tasks-nu-hazel.vercel.app

Use the voiceover render from `public/social/walkthrough-90s.mp4`. ElevenLabs PVC clone or stock voice "Adam" Calm.

### Wed 05-27, 1:30pm ET — Bluesky (single, pricing math)
- [ ] Post

> $9.95 a workspace. Not $25 a seat. The wedding fits the bride, the groom, both moms, the MOH, the DJ, and the florist for one number. Inviting people stops being a budget decision.
>
> tasks-nu-hazel.vercel.app/pricing

---

## Thursday 2026-05-28

### Thu 05-28, 10:00am ET — X (thread, 4 posts) — trades vertical
- [ ] Post 1/4
- [ ] Post 2/4
- [ ] Post 3/4
- [ ] Post 4/4

**Post 1/4:**

> Trades crews — electricians, plumbers, GCs, landscapers — run their day off a clipboard. Tasks for trades is the digital clipboard, sized for one foreman, three-to-five crew, multiple jobsites. Here's what changes.

**Post 2/4:**

> Jobsite punchlist as the first template. Each item: *thing, where, who, by when.* No story points. No epic. Card on the board, address on the card, photo if you need it.

**Post 3/4:**

> Day-of run-of-show for install days. Calendar view shows the order of operations from gear-up to wrap. Each crew member sees their own lane on the board. Same data, different lens, no re-entering anything.

**Post 4/4:**

> Three editing guests are free on every workspace, so the foreman can add the apprentice without the math changing. Studio tier — $14.95/mo, unlimited workspaces — covers the GC running 6 jobsites at once. tasks-nu-hazel.vercel.app/for/trades.

### Thu 05-28, 9:20am ET — Bluesky (single, no paid template marketplace)
- [ ] Post

> No paid template marketplace. Templates are oxygen — the moment they cost money they become scarce. Every template at tasks-nu-hazel.vercel.app/templates is free, all twelve of them. That stays a no.

---

## Friday 2026-05-29 — HN cross-post + Sidebar.io

### Fri 05-29, 9:00am ET — Hacker News (cross-post cycle 21)
- [ ] Post

**Title (under 80 chars):**

> Per-workspace pricing broke for operators. We added a tier to fix it

**Body:**

> We've been shipping a small productivity tool [tasks-nu-hazel.vercel.app] in weekly cycles. Cycle 21 fixed a real pricing leak we'd shipped into production three cycles earlier — and the architecture turned out cleaner than I expected.
>
> The setup: pricing is per workspace, not per seat. Free, $4.99 Pro for one user with unlimited workspaces, $9.95/workspace/mo Team with unlimited members, $79 once for a wedding workspace, lifetime. The whole pitch is that inviting collaborators is free — the wedding fits the bride, groom, both moms, MOH, and DJ for one number.
>
> The leak: a freelance dev with 5 clients on Team would pay 5 × $9.95 a month for what's structurally one operator's work. A wedding planner running 10 weddings/year would pay 10 × $79 to use the product they already knew. Both audiences would either bounce or downgrade to Pro and lose Team features (multi-member workspaces, real-time, the lot).
>
> Studio is the operator-tier patch: $14.95/mo, unlimited workspaces you own as sole admin, full Team capabilities on every one. The interesting part is how it sits in the entitlements model.
>
> The architectural call: grant Studio as a *single user-level entitlement row* — `workspaceId IS NULL`, tier `studio`. `getEffectiveTier(user, workspace)` runs an OR query that matches per-workspace OR user-level entitlements in a single shot, picking the highest rank. `TIER_RANK[studio] === TIER_RANK[team]` — they unlock the same features, they just have different scope. The gating code doesn't branch on Studio vs. Team. Member-cap resolution gets Studio's unlimited-members capacity for free through `isUnlimited = team || studio || wedding`.
>
> What this avoids:
>
> 1. **No bulk INSERTs at purchase.** Buying Studio doesn't write a row per workspace you currently own. One row, period.
>
> 2. **No cleanup INSERT when a new workspace is created.** The next workspace you spin up is automatically Studio because the user-level entitlement matches at query time, not at creation time.
>
> 3. **No DELETEs on cancellation.** The existing `expiresAt` mechanic on the single user-level row handles the off-ramp. The per-workspace lookups go back to whatever they were before.
>
> The Stripe side: `createCheckoutSessionAction` checks `tier === "studio"` and scopes the entitlement to `null`. Stripe metadata can't carry null directly, so we encode `"*"` as the sentinel and decode in the webhook. `grantEntitlement`'s signature widens to `workspaceId: string | null` (the column was already nullable) so the contract declares scope intent explicitly. A guardrail rejects `null` workspaceId for any tier that isn't Studio.
>
> The lesson: name your *operator persona* before you launch per-tenant pricing. Anyone whose business shape is *one of me, many of you* is an operator — freelancers, wedding planners, contractors, consultants, agency owners. They're the audience that breaks per-tenant math, and the cleanest fix is a per-user entitlement layered on top of the per-tenant lookup, not a separate billing model.
>
> Full cycle write-up — including the FAQ entry framing operator-vs-team and the settings-tab tier-meta wiring — is at tasks-nu-hazel.vercel.app/changelog.
>
> Anyone else hit this in their per-tenant pricing? Did you fix it with a per-user layer, a separate plan, or by switching the unit?

### Fri 05-29, 10:00am ET — Sidebar.io submission
- [ ] Submit

URL: `tasks-nu-hazel.vercel.app/principles`
Title: *A productivity app published its refusal list — eight features it will never ship.*

### Fri 05-29, 10:00am ET — Designer News submission (re-pitch /pricing)
- [ ] Submit

URL: `tasks-nu-hazel.vercel.app/pricing`
Title: *The pricing page itself — type, restraint, one number per scope.*

### Fri 05-29, 12:00pm ET — Bluesky (single, refusal list short form)
- [ ] Post

> Eight features we'll never ship.
>
> No per-seat pricing. No Gantt charts. No SSO upsell. No AI agent that runs your tasks for you. No real-time push notifications. No story points / velocity / burndown / OKR. No paid template marketplace. No threaded comments-on-comments.
>
> tasks-nu-hazel.vercel.app/principles

---

## Saturday 2026-05-30 — REST

No posts. No replies.

---

## Sunday 2026-05-31 — LIGHT

### Sun 05-31, 11:00am ET — X (single, timeline-view screenshot)
- [ ] Post

Take a screenshot of `tasks-nu-hazel.vercel.app/app/timeline` (Playwright MCP at viewport 1440×900). Attach.

> Timeline view. Same tasks as the board, the list, the calendar. Different lens — duration, not order.
>
> [screenshot]
>
> tasks-nu-hazel.vercel.app

---

## Quick-reference ledger — Week 3

| Day | Posts |
|---|---|
| Mon 05-25 | X 8-thread (annotated manifesto) |
| Tue 05-26 | X 7-thread (cycle 22); Bluesky cycle 22 single; Designer News submit |
| Wed 05-27 | YouTube 90s walkthrough; Bluesky pricing-math single |
| Thu 05-28 | X 4-thread (trades); Bluesky single (no paid templates) |
| Fri 05-29 | HN c21 cross-post; Sidebar.io submit; Designer News /pricing submit; Bluesky refusal-list short form |
| Sat 05-30 | REST |
| Sun 05-31 | X timeline screenshot (LIGHT) |

**Total post count week 3:** X 21 (8-thread + 7-thread + 4-thread + Sun LIGHT) · Bluesky 4 · HN 1 · YouTube 1 · Designer News 2 · Sidebar.io 1.
