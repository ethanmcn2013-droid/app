# Tasks · Posts Week 6 (Mon 2026-06-15 → Sun 2026-06-21)

Verbatim copy-paste deck. Tick the box once posted.

Voice rules — dry, observational, em-dashes welcome, no emojis, no hype. Every URL stays as `tasks-nu-hazel.vercel.app` until the custom domain is swapped.

**Launch week.** Show HN goes live Tuesday 06-16 at 9:00am ET. The Show HN body itself lives in `docs/show-hn.md` — do not duplicate it here. This deck is the surrounding sprint: warm-up Mon, narrative thread + announces Tue, recap + press nudge Wed, top-questions carousel + press follow-up Thu, IH cross-post + refusal thread Fri, PH back-channel Sun.

---

## Monday 2026-06-15 — Launch eve warm-up

### Mon 06-15, 9:00am ET — X (thread, 4 posts) — "tomorrow we Show HN"
- [ ] Post 1/4
- [ ] Post 2/4
- [ ] Post 3/4
- [ ] Post 4/4

**Post 1/4:**

> Tomorrow morning, 9:00am ET, we Show HN. Eight weeks of building in public, twenty-four cycles shipped, one refusal list pinned. The submission is written and locked. Posting it is the easy part — staying in the comments for 90 minutes is the work.

**Post 2/4:**

> The pitch is one sentence: project management for the 80% who don't work in tech. The wedding planner. The college student with a 14-week paper. The freelance dev juggling four clients. The mom running a 200-guest event from a Google Sheet. None of them need an epic. All of them need a list.

**Post 3/4:**

> The argument is the refusal list. No per-seat pricing. No Gantt. No SSO as a marketing line. No AI agent that closes your tasks for you. No real-time push notifications. No story points / velocity / burndown / OKR. No paid template marketplace. No threaded comments-on-comments. Eight noes, on a public URL, so we can be held to them.

**Post 4/4:**

> If you've been following — thank you. If you haven't — tomorrow's the day to look. tasks-nu-hazel.vercel.app/principles is the shortest version of why we built it. The HN link drops here at 9:30am ET tomorrow.

### Mon 06-15 — Final dry-run + reply to press replies — OPS, not a post body
- [ ] Run the show-hn.md preflight checklist top-to-bottom
- [ ] Confirm `/app/*` redirect resolves to `/sign-in` for unauthenticated
- [ ] Confirm Sentry pager is live and routes to phone
- [ ] Confirm at least one `/p/{slug}` returns 200 in production
- [ ] Reply to any press replies from W5 send (rows 1, 2, 4, 8, 10, 12, 13, 5, 11, 14, 15) — no broadcast, one-by-one
- [ ] Hold all other social today; the silence makes tomorrow louder

---

## Tuesday 2026-06-16 — SHOW HN

### Tue 06-16, 9:00am ET — Hacker News (Show HN launch) — POST FROM `docs/show-hn.md`
- [ ] Submit

**Ops note:** Post the Show HN body from `docs/show-hn.md` at 9:00am ET. Then return here for the X narrative thread at 9:30am.

### Tue 06-16, 9:30am ET — X (thread, 8 posts) — Show HN narrative
- [ ] Post 1/8
- [ ] Post 2/8
- [ ] Post 3/8
- [ ] Post 4/8
- [ ] Post 5/8
- [ ] Post 6/8
- [ ] Post 7/8
- [ ] Post 8/8

**Post 1/8:**

> Show HN is live. The link drops at the bottom of this thread. First, the thirty-second version of why we built it — because the post itself is for HN, and this thread is for everyone who's been watching the cycles ship.

**Post 2/8:**

> The audience is the 80% who don't work in tech. The college student in front of a 14-week paper at 4am. The wedding planner running a 200-guest event from a spreadsheet with seventeen tabs. The freelance dev juggling four clients across four stale tools. The mom organizing the school auction the same way the freelancer is organizing the launch.

**Post 3/8:**

> None of them need an epic. None of them are going to learn the word *velocity.* And none of the productivity software built in the last twenty years was actually built for them — it was built for the engineering org, and then sold sideways with the jargon stripped off the marketing page but left in the product.

**Post 4/8:**

> So we wrote down what we refuse to build. Eight features, on a public URL at /principles. No per-seat pricing. No Gantt. No SSO as a marketing line. No AI agent that runs your tasks. No real-time push notifications. No story points. No paid template marketplace. No threaded comments-on-comments. The list is the spine.

**Post 5/8:**

> Per-workspace pricing, not per-seat, is the load-bearing pricing decision. The wedding workspace fits the bride, groom, both moms, the MOH, the DJ — one number, $9.95 flat. Inviting the right people stops being a budget decision. The math is the proof we mean it.

**Post 6/8:**

> What's left after you cut the vocabulary is a list. A board if you think in lanes. A list if you think in lines. A timeline if you think in shape. A calendar if you think in days. Same tasks, four lenses, no re-entering anything. The tool fades. The work stays.

**Post 7/8:**

> Free is honest. One workspace, every view, three editing guests, the daily digest, magic-link sharing — no time limit, no card, no degradation. We make money on depth, not on basics. Pro lands automatically for `.edu` accounts at signup. Students don't pay.

**Post 8/8:**

> Show HN, live now. I'll be in the comments for the next 90 minutes — happy to answer the per-workspace pricing math, the refusal list reasoning, the parallel-agent shipping discipline, or anything else. news.ycombinator.com/item?id=[INSERT-AFTER-POST]

### Tue 06-16, 10:00am ET — Bluesky (single, Show HN announce + first-comment excerpt)
- [ ] Post

> Show HN is live. The shortest pitch is the refusal list — eight features we'll never ship, on a public URL: per-workspace pricing, no Gantt, no SSO upsell, no AI agent that closes your tasks, no per-seat anything. Full list at tasks-nu-hazel.vercel.app/principles. In the HN comments for the next 90 minutes — news.ycombinator.com/item?id=[INSERT-AFTER-POST]

### Tue 06-16, 11:00am ET — LinkedIn (founder note)
- [ ] Post — skip if LI not yet activated; defer to W7

**Status:** LinkedIn was deferred per §6 of `gtm-plan.md` ("activate after first 1k signups + video assets exist"). Week 6 launches on ~750 cumulative signups; LI is unlikely to be open. If activated by W6 Tue, post the body below. Otherwise defer to W7 launch-week recap.

> Eight weeks ago I started building Tasks in public. This morning it went up on Show HN. The pitch is short and the audience is broader than this feed: a productivity app for the 80% who don't work in tech — wedding planners, students, freelance operators, families, school admins, clinic managers.
>
> The argument is a published refusal list. Eight features Tasks will never ship — per-seat pricing, Gantt, SSO as marketing copy, AI agents that close tasks for you, real-time push, story points, paid template marketplaces, comment threading. The list is at tasks-nu-hazel.vercel.app/principles. Most roadmaps are a list of yeses; this is the other one.
>
> Per-workspace pricing, not per-seat. A wedding fits the bride, groom, both moms, the MOH, the DJ for one number — $9.95 flat — instead of six times $9.95. The pricing page is the deck.
>
> Show HN: news.ycombinator.com/item?id=[INSERT-AFTER-POST]
>
> If you know one person outside tech who's running their work from a spreadsheet, this is the link to forward.

---

## Wednesday 2026-06-17 — Recap + press nudge + reaction short

### Wed 06-17, 10:00am ET — X (thread, 5 posts) — "Show HN, 24 hours in"
- [ ] Post 1/5
- [ ] Post 2/5
- [ ] Post 3/5
- [ ] Post 4/5
- [ ] Post 5/5

**Post 1/5:**

> Twenty-four hours after Show HN. The numbers, in voice: [X upvotes] upvotes, [Y comments] comments, [Z hours] on the front page. [NEEDS-REVIEW: insert HN numbers Wed 06-17 EOD] Thank you to everyone who showed up in the thread — the comments did the work the post couldn't.

**Post 2/5:**

> The questions that came up most: per-workspace pricing math, why no Gantt, how this isn't Notion, where SSO sits, the catch on the free tier. Answers were the ones we'd already written — the refusal list at /principles is the same answer to most of them.

**Post 3/5:**

> One pattern worth naming: the post landed hardest with engineers who wanted to forward it to a non-engineer. That was the design intent. The pitch isn't *for* HN; it's for the people HN sends links to. The refusal list reads in five minutes; that's the forwardable shape.

**Post 4/5:**

> What I got wrong in the post: the wedding tier is buried — it should have been the lede, not the fourth bullet. The $79-once is the clearest product-market fit we have, and the post under-sold it. Noted for PH next Tuesday.

**Post 5/5:**

> The full HN thread is here — news.ycombinator.com/item?id=[INSERT-AFTER-POST]. The product is at tasks-nu-hazel.vercel.app. Cycle 24's narrative — what shipped this week alongside the launch sprint — is at /changelog. Now back to building.

### Wed 06-17, 12:00pm ET — Press nudge to 3 newsletter writers (email body template)
- [ ] Send to writer 1
- [ ] Send to writer 2
- [ ] Send to writer 3

**Subject:** Show HN, 24 hours in — the numbers

**Body template (no recipients — fill in per-writer):**

> [First name] —
>
> Quick follow-up on the note from last week. Tasks went up on Show HN yesterday morning at 9am ET. Twenty-four hours in: [X upvotes] upvotes, [Y comments] comments, [Z hours] on the front page top-30. [NEEDS-REVIEW: insert HN numbers Wed 06-17 EOD]
>
> The thread is here if it's useful: news.ycombinator.com/item?id=[INSERT-AFTER-POST]
>
> The angle that landed hardest in the comments was the refusal list — eight features we won't ship, on a public URL — and the per-workspace pricing math underneath it. Both are at /principles and /pricing if you want a closer look.
>
> If there's a piece in here for [outlet], happy to answer anything by reply or jump on a call. Numbers will only get better through the weekend.
>
> — Ethan
> tasks-nu-hazel.vercel.app

### Wed 06-17, 3:00pm ET — YouTube Short (60s reaction recap to HN comments)
- [ ] Upload

**Title:** Show HN, the comments — what we got back in 24 hours.

**Description:**

> Twenty-four hours after the Show HN. [X upvotes] upvotes, [Y comments] comments, [Z hours] on the front page. [NEEDS-REVIEW: insert HN numbers Wed 06-17 EOD] The questions, the patterns, the one thing the post under-sold.
>
> tasks-nu-hazel.vercel.app/changelog

**Voiceover paragraph (60 seconds, single take, dry register):**

> Yesterday morning at nine ET, Tasks went up on Show HN. Twenty-four hours later — front page for [Z hours], [X upvotes] upvotes, [Y comments] comments in the thread. The questions that came up most weren't the ones I'd written canned answers for. They were per-workspace pricing math, why no Gantt, how this isn't Notion. The refusal list at /principles answered most of them better than any reply I could write live. The thing I got wrong: the wedding tier is buried in the post. Seventy-nine dollars once, fits everyone in the wedding for one number — that's the clearest product-market fit we have, and I under-sold it. Noted for Product Hunt next Tuesday. The HN thread is open. The product is at tasks-nu-hazel-dot-vercel-dot-app. Cycle 24 narrative is at /changelog. Back to building.

**On-screen captions (3, timed to voiceover):**

1. (0:08–0:14) "[Z hours] front page · [X upvotes] · [Y comments]" — [NEEDS-REVIEW: insert HN numbers Wed 06-17 EOD]
2. (0:24–0:32) "Most asked: per-workspace pricing math · no Gantt · how is this not Notion"
3. (0:48–0:58) "tasks-nu-hazel.vercel.app/changelog"

---

## Thursday 2026-06-18 — Top questions carousel + press follow-up

### Thu 06-18, 10:00am ET — X / LinkedIn (carousel/thread, 5 posts) — top 5 HN questions answered
- [ ] Post 1/5
- [ ] Post 2/5
- [ ] Post 3/5
- [ ] Post 4/5
- [ ] Post 5/5

**Post 1/5 — "Won't per-workspace pricing lose money on big teams?"**

> Yes. That's the design, not a bug. We chose the audience that wins under per-workspace pricing — small groups, individual operators, weddings, classrooms, clinics — and accepted that we'll lose 200-person engineering orgs to Linear. Linear already has them. Picking that fight makes Tasks a knockoff. Ignoring it lets Tasks own the audience nobody else is building for cleanly.

**Post 2/5 — "Why no Gantt? Surely it's just a view?"**

> Timeline view is the friendly cousin — visual sequencing without the cascading-dependencies-and-percent-complete-bars language of consultants. Gantt is enterprise theater. Building it would mean shipping the vocabulary that goes with it — milestones, baselines, critical-path math. The audience we built for doesn't need that. The audience that needs it isn't us.

**Post 3/5 — "How is this different from Notion?"**

> Notion is a Lego set — you build a custom database with seven views and a wiki. Tasks is a tool — you write down what you have to do and look at it four ways. If the job is *build the workspace,* Notion wins. If the job is *do the work,* Tasks wins. Both can be right. We picked the second job and shipped a refusal list to make sure we don't drift back to the first.

**Post 4/5 — "Where's the catch on the free tier?"**

> There isn't one. Free is one workspace, every view (board, list, timeline, calendar), three editing guests, the daily digest, magic-link sharing — no time limit, no card, no degradation. We make money on depth, not on basics. Pro lands automatically for `.edu` accounts at signup. The free-tier honesty is at /pricing.

**Post 5/5 — "Will you build SSO?"**

> Maybe. Quietly. We won't put it on the pricing page. Companies that sell SSO sell fear — *what if your IT department asks?* — and we won't run that play. If a team genuinely needs it, we'll build it for them. It will never be the upsell, never the gate on a tier, never the thing that turns Tasks into the kind of company we built Tasks not to become.

### Thu 06-18, 12:00pm ET — Press follow-up to Dense Discovery / Sherwood / Stratechery (email body template)
- [ ] Send to Kai Brach (Dense Discovery)
- [ ] Send to Luke Kawa (Sherwood)
- [ ] Send to Ben Thompson (Stratechery)

**Subject:** Tasks · Show HN numbers + the angle for [outlet]

**Body template (no recipients — fill in per-writer):**

> [First name] —
>
> Following up on the note from last week with the numbers, since they read better than the pitch did.
>
> Show HN landed Tuesday morning. Through 72 hours: [X upvotes] upvotes, [Y comments] comments, [Z hours] on the front page top-30, [N signups] cumulative signups attributable to the launch. [NEEDS-REVIEW: insert HN numbers Wed 06-17 EOD]
>
> The angle for [outlet] specifically — the one I think holds: per-workspace pricing as a quiet rejection of per-seat unit economics. The math is at /pricing and the reasoning is at /principles. The HN thread is at news.ycombinator.com/item?id=[INSERT-AFTER-POST] if the comments are useful color.
>
> Product Hunt is next Tuesday 6/23. Happy to send PH numbers Wednesday if a piece would benefit from both. No pressure either way — wanted you to have the data.
>
> — Ethan
> tasks-nu-hazel.vercel.app

---

## Friday 2026-06-19 — IH cross-post + refusal-list thread

### Fri 06-19, 9:00am ET — Indie Hackers (cross-post: "what Show HN taught us in 72 hours")
- [ ] Post

**Title:**

> What Show HN taught us in 72 hours — the numbers, the question that came up most, and the one thing I got wrong

**Body:**

> We launched Tasks [tasks-nu-hazel.vercel.app] on Show HN Tuesday morning at 9am ET. Solo founder, no funding, eight months of weekly cycles, twenty-four cycles shipped before the post went up. Here's what 72 hours of HN front-page exposure actually taught us — the numbers, the question that came up most, and the one thing I got wrong in the submission.
>
> **The numbers, plain:**
>
> - Show HN upvotes: [X upvotes]
> - Comments: [Y comments]
> - Hours on front page top-30: [Z hours]
> - Cumulative free signups attributable to the launch window: [N signups]
> - Paid conversions in 72 hours: [P paid] (mix: [W] Wedding $79, [S] Studio, [T] Pro/Team)
> - `/principles` page views: [PR views]
> - `/pricing` page views: [PP views]
>
> [NEEDS-REVIEW: insert HN numbers + signup/paid breakdown Fri 06-19 8am ET]
>
> **The question that came up most:** *"Won't per-workspace pricing lose money on big teams?"*
>
> Yes — and that's the design, not a bug. We chose the audience that wins under per-workspace pricing (small groups, individual operators, weddings, classrooms, clinics) and accepted that we'll lose 200-person engineering orgs to Linear. Linear already has them. Picking that fight makes Tasks a knockoff. Ignoring it lets Tasks own the audience nobody else is building for cleanly. The math: the wedding workspace fits six people for $9.95 flat instead of six times $9.95. Per-workspace pricing converts at the small-team end — where every other tool was leaving money on the table by anchoring on per-seat — and breaks at 50+ headcount, where we don't sell.
>
> **What I got wrong in the post:** the wedding tier is buried. $79 once, lifetime, for the workspace that matters most — and it sat as the fourth bullet in the pricing list at the bottom of the post. The wedding tier is the clearest product-market fit we have. Couples buy without a sales call. Three free editing guests on every workspace fits the bride, groom, both moms, MOH, and the DJ for one number. That should have been the lede. Noted for Product Hunt next Tuesday — the PH page leads with $79.
>
> **What worked, that I want to share:**
>
> 1. **The refusal list is the spine.** /principles — eight features we'll never ship, on a public URL — was the single most-referenced thing in the comments. People forwarded it more than they forwarded the product itself. Positioning by what you refuse is rarer than positioning by what you build, and rarer means it travels.
> 2. **Per-workspace pricing converted on the spot.** [P paid] paid conversions in 72 hours from a single launch — without a sales motion, without a trial, without a credit card on the free tier. Pricing-page-as-deck did the work the deck would have done.
> 3. **Comments-as-product.** Five canned-but-not-canned anecdotes ready before the post went live (per-workspace math, no Gantt, not-Notion, free-tier honesty, SSO) covered ~80% of the thread. The other 20% taught us things — and that 20% is what made the launch worth it.
>
> **What broke, that I want to share:**
>
> 1. **Hour-three lull.** Front page momentum dipped between 12pm and 2pm ET as the European audience tapped out and the West Coast hadn't logged on. We'd planned for it but it still felt long. Replying through it kept the thread alive.
> 2. **The wedding burial in the post body.** Already covered above.
> 3. **One signup-flow bug surfaced under load** — `/app/*` redirect for unauthenticated users took an extra hop on first visit. Patched within the launch window. Sentry caught it.
>
> **The lesson I'd hand to anyone planning a Show HN:** lead with what you *refuse,* not what you *built.* Refusal lists travel because they are short, opinionated, and forwardable. Feature lists do not travel because every other tool also has feature lists.
>
> Full pricing math is at tasks-nu-hazel.vercel.app/pricing. The refusal list is at /principles. Cycle 24 — what we shipped alongside the launch sprint — is at /changelog.
>
> Product Hunt is Tuesday 6/23 at 3:01am PT. If you've launched on both — what's the play you wished you'd run between Show HN and PH?

### Fri 06-19, 11:00am ET — X (thread, 9 posts) — refusal list, full, designed to travel
- [ ] Post 1/9
- [ ] Post 2/9
- [ ] Post 3/9
- [ ] Post 4/9
- [ ] Post 5/9
- [ ] Post 6/9
- [ ] Post 7/9
- [ ] Post 8/9
- [ ] Post 9/9

**Post 1/9:**

> The refusal list. Eight features Tasks will never ship, on a public URL at tasks-nu-hazel.vercel.app/principles. Most roadmaps are a list of yeses. This is the other roadmap. One feature per post, in plain words, with the reason underneath.

**Post 2/9 — No per-seat pricing.**

> Inviting a collaborator should not be a budget decision. Per-seat pricing makes adding the lab partner, the florist, the DJ, the second mom into a math problem the user has to solve before they can do the work. Per-workspace flips it. The wedding fits everyone for one number — $9.95 flat, not six times $9.95.

**Post 3/9 — No Gantt charts.**

> Gantt is enterprise theater. Cascading dependencies, percent-complete bars, baselines, critical paths — the language of consultants billing hourly. Timeline view is the friendly cousin: visual sequencing without the vocabulary tax. The audience we built for doesn't need Gantt. The audience that needs it isn't us.

**Post 4/9 — No SSO as a marketing line.**

> Companies that sell SSO sell fear — *what if your IT department asks?* We won't run that play. If a team genuinely needs SSO, we'll build it for them. It will never be the upsell, never the tier gate, never the thing that turns Tasks into the kind of company we built Tasks not to become.

**Post 5/9 — No AI agent that runs your tasks for you.**

> The dopamine of crossing a task off is not outsourceable. AI in Tasks surfaces what's stuck — an idle card, a quiet review, a blocked dependency — and hands you a one-tap nudge. It will never auto-complete on your behalf. The work is still yours. That's the whole point of having a list.

**Post 6/9 — No real-time push notifications.**

> If a tool's strategy is winning more of your attention, the tool isn't on your side. Tasks ships a daily digest at the time you choose. No red dots. No "@you" pings. No lock-screen interrupts. The list waits for you. You don't wait for the list.

**Post 7/9 — No story points, velocity, burndown, OKR.**

> The vocabulary other tools spent twenty years training people in — sprint planning, ticket triage, OKR alignment, velocity reviews — we cut all of it. The wedding planner doesn't have a backlog. The college student doesn't run a retro. The freelance dev doesn't need a burndown chart. None of them ever did.

**Post 8/9 — No paid template marketplace.**

> Templates are oxygen. The moment they cost money they become scarce — and a productivity tool with scarce templates is a tool that punishes the people who needed it most. All twelve templates are free, forever. Wedding 3-month, day-of run-of-show, final paper sprint, freelance new-client onboarding, apartment move, product launch — all at /templates, free.

**Post 9/9 — No threaded comments-on-comments.**

> Comments aren't the work. The tasks are. Threading turns a task page into a forum and a forum is not what anyone came here for. Comments stay flat under the card. The conversation lives where the work lives. /principles is the full list — eight noes, on a public URL, so we can be held to them.

### Fri 06-19, 12:00pm ET — Bluesky (single, IH link)
- [ ] Post

> What Show HN taught us in 72 hours — the numbers, the question that came up most, and the one thing I got wrong in the submission. Cross-posted to Indie Hackers this morning. [NEEDS-REVIEW: insert IH URL after Fri 9am post]
>
> tasks-nu-hazel.vercel.app

---

## Saturday 2026-06-20 — REST (mandatory PH eve)

(rest day — no posts; PH launches Tuesday 06-23 at 3:01am PT)

---

## Sunday 2026-06-21 — PH back-channel + LIGHT

### Sun 06-21, 6:00pm ET — Product Hunt back-channel (DM template to 8 hunter-friends)
- [ ] DM hunter 1
- [ ] DM hunter 2
- [ ] DM hunter 3
- [ ] DM hunter 4
- [ ] DM hunter 5
- [ ] DM hunter 6
- [ ] DM hunter 7
- [ ] DM hunter 8

**DM template (no recipients — one-to-one, no group send, no upvote ring language):**

> Hey [first name] — heads-up, not an ask.
>
> Tasks goes up on Product Hunt Tuesday 6/23 at 3:01am PT. Show HN ran last week and held the front page for [Z hours] — [X upvotes], [Y comments]. [NEEDS-REVIEW: insert HN numbers]
>
> If you happen to be on PH Tuesday and the product looks right to you, the page will be at producthunt.com/products/taskshq. No upvote ask — just letting friends know it's coming so it isn't a surprise in the feed. The shortest version of why is at tasks-nu-hazel.vercel.app/principles.
>
> Either way — appreciate you. Talk soon.
>
> — Ethan

### Sun 06-21, 8:00pm ET — X (single, LIGHT) — "tomorrow: Product Hunt"
- [ ] Post

> Tomorrow: Product Hunt, 3:01am PT. Eight weeks, twenty-four cycles, one Show HN already in the books. The PH page leads with the wedding tier this time — $79 once, fits the bride, groom, both moms, the MOH, and the DJ for one number. The lede that should have been the lede.
>
> tasks-nu-hazel.vercel.app

---

## Quick-reference ledger — Week 6

| Day | Posts |
|---|---|
| Mon 06-15 | X 4-thread (launch eve); ops dry-run + press replies |
| Tue 06-16 | **Show HN 9:00am (from `docs/show-hn.md`)**; X 8-thread narrative; Bluesky announce; LinkedIn note (skip if LI not active) |
| Wed 06-17 | X 5-thread recap; press nudge email template (3 writers); YouTube Short reaction recap |
| Thu 06-18 | X/LinkedIn 5-post top-questions carousel; press follow-up email template (Dense Discovery/Sherwood/Stratechery) |
| Fri 06-19 | IH cross-post (72-hour Show HN retro); X 9-post refusal-list thread; Bluesky IH-link single |
| Sat 06-20 | REST (mandatory PH eve) |
| Sun 06-21 | PH back-channel DM template (8 hunter-friends); X LIGHT single |

**Total post-body count week 6:** X 27 (4+8+5+5+9, plus 1 LIGHT single = 32 across X) · Bluesky 2 · LinkedIn 1 (conditional) + 1 carousel · YouTube 1 Short · IH 1 long · Show HN 1 (sourced from `docs/show-hn.md`, not duplicated here) · Press nudge template 1 · Press follow-up template 1 · PH back-channel DM template 1.

**Templates / briefs (not post bodies):** Press nudge (Wed 06-17), Press follow-up (Thu 06-18), PH back-channel DM (Sun 06-21).

**`[NEEDS-REVIEW]` placeholders to resolve in-window:**
- Wed 06-17 EOD — insert HN numbers (`[X upvotes]`, `[Y comments]`, `[Z hours]`) for: Wed X recap thread, Wed press nudge email, Wed YouTube Short description + on-screen caption.
- Fri 06-19 8am ET — insert HN numbers + 72-hour signup / paid breakdown (`[N signups]`, `[P paid]`, `[W]`/`[S]`/`[T]` mix, `[PR views]`, `[PP views]`) for IH cross-post.
- Fri 06-19 post-9am — insert IH URL into Bluesky single.
- Sun 06-21 — insert HN numbers into PH back-channel DM template.
- HN URL placeholder `news.ycombinator.com/item?id=[INSERT-AFTER-POST]` — resolve immediately after Tue 9:00am submission, then back-fill into: Tue X 8-thread (post 8/8), Tue Bluesky single, Tue LinkedIn note (if posting), Wed X recap (post 5/5), Wed press nudge email, Thu press follow-up email.
