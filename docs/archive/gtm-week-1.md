# Tasks · GTM Week 1 (Mon 2026-05-11 → Sun 2026-05-17)

**Goal:** profiles live on X, Bluesky, Product Hunt; first /changelog cross-post on HN Friday; the refusal list seen by ≥3,000 people by Sunday night.

**Brand voice on every post:** dry, observational, em-dashes welcome, no emojis, no `🚀` energy. Match `/about`'s strikethrough manifesto.

**Tools at hand:** `frontend-design` skill (banners), Playwright MCP (screenshots), Gmail MCP (drafts), Google Calendar MCP (holds), Vercel skills (deploys), Remotion (motion).

---

## Sunday evening 2026-05-10 (prep — before Monday wakes up)

### 7:00pm — Domain check
- Confirm custom domain landed 2026-05-07 and points to Vercel project `ethanmcn2013-1730s-projects/tasks`.
- If yes: update `NEXT_PUBLIC_SITE_URL` env var to the new domain. Sitemaps, OG URLs, absolute links all read from that var. Redeploy: `vercel deploy --prod --yes`.
- If domain still tasks-nu-hazel.vercel.app: every URL in this doc stays as-is. Revisit week 2.

### 7:30pm — Fix the `/app/*` redirect bug (memo'd in project_tasks_deploy.md)
- Set Clerk `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` env var on Vercel.
- In `src/proxy.ts`, ensure `auth.protect({ unauthenticatedUrl: '/sign-in' })` for non-public routes.
- Redeploy and test: visit `/app/board` in an incognito window — should redirect, not 404.

### 8:00pm — Claim handles (15 min)
- X / Twitter: sign up `@taskshq` at x.com/i/flow/signup (use `hello@<domain>` if domain landed, otherwise gmail).
- Bluesky: claim `taskshq.bsky.social` at bsky.app.
- Product Hunt: confirm/claim `producthunt.com/products/taskshq`. Add `@ethanmcn` as maker.
- Reserve (do not activate, just hold): YouTube `@taskshq`, TikTok `@taskshq`, Instagram `@taskshq`, Threads (inherits IG), LinkedIn company page slug `taskshq`. Mastodon — defer instance pick to week 2.

### 8:30pm — Banner design (60 min, frontend-design skill)
Run two `Skill: frontend-design` invocations:

**Brief 1 — X banner (1500×500):** "Strikethrough manifesto wallpaper. Background: studio off-white from /about (`bg-bg-elevated`). Foreground: ten phrases — *sprint planning, epic refinement, ticket triage, issue grooming, story points, burndown reviews, stand-up rituals, backlog dependencies, gantt cascades, OKR alignment* — laid out as wallpaper, each with a thin rose-300 strikethrough line. Bottom-right: 'You don't need a vocabulary. You need a list.' in Geist semibold. No logo. No emojis."

**Brief 2 — Bluesky banner (1500×500):** "Four view icons in a 2×2 grid — board (lanes), list (lines), timeline (bars), calendar (cells). Hand-drawn weight, on the studio off-white. Each icon labeled in 11px caps tracking. No tagline."

Export both as PNG. Save to `~/Projects/tasks/public/social/`.

### 9:30pm — Pinned-post images (30 min)
- X pinned post image (1200×675): "8 features we'll never ship. /principles — the other roadmap." Black on cream, Geist semibold, no emojis.
- Bluesky pinned post image: same, sized 1200×630.

### 10:00pm — Schedule reminders
Run `mcp__claude_ai_Google_Calendar__create_event` for every Monday–Friday posting time below. Title each "Tasks · post — [channel] [format]". Set reminder 10 min before.

---

## Monday 2026-05-11 — Profiles live + pinned posts

### 7:30am — Coffee, no inbox

### 8:00am — Final profile copy paste

**X bio (160 char):** Project management without the vocabulary tax. Four views, per-workspace pricing, a refusal list. For the 80% who don't work in tech. — tasks-nu-hazel.vercel.app

**Bluesky bio (256 char):** Project management for the 80% who don't work in tech. Four views — board, list, timeline, calendar. Per-workspace pricing. A short list of features we'll never ship. Built solo, in public. tasks-nu-hazel.vercel.app

**Both:** upload banner + 400×400 avatar (use the `tasks·` wordmark with animated dot at rest — export from `src/components/brand/wordmark.tsx` via Playwright `browser_take_screenshot`).

### 8:45am — Avatar export (Playwright MCP)
```
mcp__plugin_playwright_playwright__browser_navigate → tasks-nu-hazel.vercel.app
browser_take_screenshot {selector: "[data-wordmark]", fullPage: false} (clip to wordmark)
```
Save to `~/Projects/tasks/public/social/avatar-400.png`. Resize via `sips -z 400 400` if needed.

### 9:00am — POST · X pinned post (single post, then promote to pinned)
> We published a list of eight features we'll never ship. /principles — the other roadmap.
>
> tasks-nu-hazel.vercel.app/principles

After posting, click *more* → *pin to your profile*.

### 9:15am — POST · X thread (5 posts) — refusal list
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

### 11:00am — POST · Bluesky pinned post (single, then pin)
> Most roadmaps are a list of yeses. We published the other list — eight features we'll never ship.
>
> tasks-nu-hazel.vercel.app/principles

Then: profile → ⋯ → *pin post*.

### 11:30am — Founder intro (Bluesky single, no thread)
> I built a productivity tool for the 80% of people who don't work in tech. Wedding planners. College students. Freelancers. Trades. Families running events from spreadsheets.
>
> No sprints. No epics. No vocabulary tax. tasks-nu-hazel.vercel.app

### 12:00pm — LUNCH (the day will be long)

### 1:00pm — Set up the publishing rhythm
- Open `~/Projects/tasks/docs/posts-week-1.md`. Paste this week's entries (copy from this doc). Tick off as posted.
- Open `~/Projects/tasks/docs/kpi-log.md` (create if needed). Add headers: `Date | Free signups | Paid | HN front-page mins | PH rank | /p/ count`.

### 2:00pm — Submit to Product Hunt as "coming soon"
- producthunt.com/products/taskshq → *Coming soon* → set launch date 2026-06-23.
- Tagline: *"Project management without the vocabulary tax."*
- Description: *"Four views — board, list, timeline, calendar. Per-workspace pricing, not per-seat. A published list of eight features we'll never ship. Built for wedding planners, students, freelancers, trades, families — the 80% who don't work in tech."*

### 3:00pm — Begin first video asset (30s hero loop)
This is the only video that needs to ship by week 2. Time-to-first-cut is ~2–4 hours.

- Open `~/Projects/tasks` and `~/Projects/approvals-motion` for Remotion reference.
- Spin up new Remotion composition `HeroLoop30s.tsx` at 1080×1080 (square; works on X, IG, Bluesky preview).
- Reuse `cinematic-demo.tsx` scene order: open board → carry → comment → view-morph → AI nudge → settle.
- On-screen text per the §4a script in `gtm-plan.md`.
- First render: `npx remotion render HeroLoop30s out/hero-loop-30s.mp4`.

Stop at 5pm whether it's done or not. It can finish Tuesday morning.

### 5:00pm — Day-1 KPI snapshot
Write to `docs/kpi-log.md`:
- Free signups today: \_\_\_
- /p/ published count: \_\_\_
- Notes: profile launch traffic spike (or absence thereof)

### 5:30pm — Off

---

## Tuesday 2026-05-12

### 8:30am — Coffee, glance at overnight HN/Bluesky/X notifications. Reply only to thoughtful threads; ignore pile-ons.

### 9:00am — POST · X single
> No AI summary. No inbox. No streaks. No daily mood reflection. No focus timer. Tasks does the boring thing — it tracks what you have to do — without trying to also be a journal, a meditation app, or your therapist.
>
> tasks-nu-hazel.vercel.app

### 10:00am — POST · Bluesky single (strikethrough manifesto excerpt)
> Sprint planning. Epic refinement. Ticket triage. Issue grooming. Story points. Burndown reviews. Stand-up rituals. Backlog dependencies. Gantt cascades. OKR alignment.
>
> None of that is true.
>
> tasks-nu-hazel.vercel.app/about

### 10:30am — Resume HeroLoop30s render. Aim for shippable cut by EOD.

### 12:00pm — LUNCH

### 1:00pm — Press list prep (Gmail MCP drafts — DO NOT SEND YET)
Send is week 5 (06-08). Today is just drafting.

Run for each of the 15 press contacts in `gtm-plan.md` §9: `mcp__claude_ai_Gmail__create_draft` with body templated from the Lenny example. Personalize each opening line — name a piece they wrote that's relevant. Drafts saved, not sent.

The Lenny draft body verbatim (use as template):

> Subject: the productivity app for the 80%
>
> Lenny — built a thing you might find useful, or at least amusing.
>
> Tasks is a productivity app for the people who don't work in tech — the GM, the clinic manager, the head of school. Per-workspace pricing, not per-seat. Four views (board, list, timeline, calendar) and an actual refusal list of features we won't ship.
>
> The reason I'm writing you specifically: you've taken apart pricing pages enough times that I think the punchline lands faster with you than with most. Per-workspace flips the unit economics small teams have been losing on for a decade.
>
> Show HN goes live Tuesday 6/16. Happy to send numbers after.
>
> The deck is at /pricing — there's no deck.
>
> — Ethan
> tasks-nu-hazel.vercel.app

### 4:00pm — Finish HeroLoop30s. Render, then upload to:
- X (post Wed morning per calendar — don't post early)
- Bluesky (post Wed afternoon)
- YouTube channel (week 2)

Save final file to `public/social/hero-loop-30s.mp4` (also commit to repo for the embed widget).

### 5:00pm — KPI snapshot. Off.

---

## Wednesday 2026-05-13

### 9:00am — POST · X thread (4 posts) — domain packs
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

### 1:30pm — POST · Bluesky single
> Cycle 22 — five features in one cycle, parallel-agent dispatch. iOS share-sheet, cross-workspace search, share-card PNG, remix, contacts. 27 sub-agent dispatches across the sprint. 0 broken builds.
>
> The whole writeup is at /changelog.

### 2:00pm — Begin 90-second walkthrough video
Per `gtm-plan.md` §4b. Pipeline:
1. ScreenStudio capture: actual product flow per the script's screen actions. Record three takes; pick the cleanest.
2. Descript: import → trim against transcript.
3. Remotion: import the trimmed cut as `<OffthreadVideo>` and overlay the on-screen text per script timing.
4. ElevenLabs: generate voiceover from the script (use PVC clone if already trained — if not, use stock voice "Adam" Calm).
5. Resolve free: composite + final mix + 1080p30 export.

Stop at 5pm.

### 5:00pm — KPI snapshot. Off.

---

## Thursday 2026-05-14

### 9:00am — POST · X thread (4 posts) — auto-running showcase
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

### 9:20am — POST · Bluesky single
> Wedding planner, three months out. RSVPs, seating, vows, the small fires before the big day. The free template is at tasks-nu-hazel.vercel.app/templates/wedding-3-month-countdown.

### 10:30am — Finish 90s walkthrough render. If not ready, slip to Friday.

### 12:00pm — LUNCH

### 1:00pm — Prepare HN cross-post for Friday
- Open `~/Projects/tasks/docs/syndication.md`. Read the HN cycle-22 template (lines ~24–67 of that doc).
- Open a draft in Apple Notes (don't pre-post in HN; HN is a manual, hand-on-keyboard event).
- Title: *"How we shipped 5 features in one cycle with parallel sub-agents."*
- Body: paraphrase the template; include actual cycle-22 narrative excerpts from `CHANGELOG.md`.
- End with a question: *"Curious what others are doing with parallel sub-agents — what's your file-scope pattern? Anyone running >5 reliably?"*

### 3:00pm — Submit `/principles` to Designer News
news.layervault.com → submit link → URL: `tasks-nu-hazel.vercel.app/principles` → title: *"Eight features we'll never ship — a productivity app's public refusal list."*

### 4:00pm — Submit `/about` to Sidebar.io
sidebar.io → submit (sign-in required, use Google) → URL: `tasks-nu-hazel.vercel.app/about` → title: *"Project management shouldn't be behind a paywall — a designer's manifesto."*

### 5:00pm — KPI snapshot. Off.

---

## Friday 2026-05-15 — First HN cross-post

### 8:30am — Coffee. Final read of HN draft. Confirm title length (<80 char), body length (~250–400 words). Re-check that the HN-rules-aware question at the end is a real question, not a CTA.

### 9:00am — POST · Hacker News
news.ycombinator.com → submit → paste title + body. Hit submit. Note the timestamp. Open the post in a second browser tab to monitor.

### 9:15am — Be in HN comments. Reply pattern:
- Wait 5–10 min between replies for the first hour.
- Don't argue with "looks like Notion / Linear / Asana." Acknowledge it's a crowded space; point to /principles.
- For "won't per-workspace pricing lose money on big teams?" — answer once, in the post body if not already, with the IH math: yes, and that's the point. We chose the audience that wins under per-workspace pricing.

### 10:00am — POST · X (the hook + HN link)
> 22 cycles, 27 sub-agent dispatches, 0 broken builds. What we learned shipping 5 features in one cycle with parallel agents.
>
> news.ycombinator.com/item?id=[insert-id]

### 12:00pm — POST · Bluesky single (refusal list pull-quote)
> "If a tool's strategy is winning more of your attention, the tool isn't on your side."
>
> — from /principles, refusal #5
>
> tasks-nu-hazel.vercel.app/principles

### 12:30pm — LUNCH. Don't refresh HN. Eat.

### 2:00pm — Back to HN. Reply to mid-day comments. Acknowledge the lurkers.

### 4:00pm — Reply pace slows naturally. Stop manually triggering replies.

### 5:00pm — KPI snapshot — special week-1 close edition:
- HN front-page minutes (record peak rank + duration on FP)
- Click-throughs from HN (PostHog `referrer = news.ycombinator.com`)
- Free signups today + week total
- /principles page views (the post-launch leading indicator)

### 6:00pm — Off.

---

## Saturday 2026-05-16 — REST

No posts. No replies. No KPI checks. The product made it through week 1; the operator gets a Saturday.

---

## Sunday 2026-05-17 — LIGHT

### 11:00am — POST · X single (calendar-view screenshot)
Take a screenshot of `tasks-nu-hazel.vercel.app/app/calendar` (use Playwright MCP at viewport 1440×900). Post:

> Calendar view. Same tasks as the board, the list, the timeline. Different lens.
>
> [screenshot]
>
> tasks-nu-hazel.vercel.app

### 11:30am — Off.

---

## End-of-week-1 retrospective (write to `docs/posts-week-1.md`, ~200 words, voice: dry)

Answer four questions:
1. What landed? (Which post got the most engagement and why?)
2. What didn't? (Which post fell flat? Surprise?)
3. What surprised? (Any audience signal you didn't expect?)
4. What changes for week 2?

This becomes raw material for the week-2 LinkedIn long-form post on 2026-05-18 ("per-workspace pricing math") if you want to fold week 1 lessons in.

---

## Quick-reference ledger

| Day | Posts | Renders | Submits | Drafts |
|---|---|---|---|---|
| Sun 05-10 | — | — | — | Banners; profile copy |
| Mon 05-11 | X pinned + 5-thread; Bluesky pinned + intro | Begin 30s hero loop | PH coming-soon | — |
| Tue 05-12 | X single; Bluesky single | Finish 30s hero loop | — | 15 press email drafts (Gmail MCP) |
| Wed 05-13 | X 4-thread; Bluesky single | Begin 90s walkthrough | — | — |
| Thu 05-14 | X 4-thread; Bluesky single | Finish 90s walkthrough | DN /principles; Sidebar.io /about | HN post body |
| Fri 05-15 | **HN c22**; X HN-link; Bluesky pull-quote | — | — | — |
| Sat 05-16 | REST | — | — | — |
| Sun 05-17 | X calendar screenshot (LIGHT) | — | — | Week 1 retro |

**Total post count week 1:** X 12 (1 pinned + 5 in pinned thread + 6 daily) · Bluesky 6 · HN 1 · Designer News 1 · Sidebar.io 1 · Product Hunt coming-soon 1.

**No paid spend this week.** Paid begins week 4.

**No emails sent this week.** Press send is week 5 (2026-06-08).

---

*If a step says "write a post," the post is written. If a step says "send a draft," the body is written. If a step says "render," the output filename is named. Wake up Monday and execute.*
