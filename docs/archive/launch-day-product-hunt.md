# Tasks · Launch Day Playbook — Product Hunt (Tue 2026-06-23)

**Goal:** PH top-5 of the day; ≥400 cumulative free signups across the 24-hour window; reply within 15 min to every comment in the first 6 hours; at least 5 paid Wedding $79 conversions on the day.

**Brand voice on every reply:** dry, observational, em-dashes welcome, no emojis. Don't argue with comparisons to Notion / Linear / Asana. Acknowledge it's crowded and point at /principles. Don't lead with the tech stack. Don't claim AI-powered. Lead with the wedding tier — that's the lede the Show HN under-sold and the lesson in the Wed 06-17 recap.

**PH-specific posture:** Don't refresh the leaderboard obsessively — set a 30-min timer. The leaderboard is decided by sustained engagement across the full 24-hour window, not the first hour. The 3:01am PT slot is the launch slot, not the bedtime.

**Tools at hand:** Gmail MCP (press follow-up), Google Calendar MCP (reminders), Sentry pager, `docs/kpi-log.md`, `docs/product-hunt-page.md` (the PH page body — already shipped, not edited today).

---

## Mon 2026-06-22 — PH eve

### 5:00pm — Hunter status confirm
- Hunter line-up was supposed to be locked by 2026-06-08. If Chris Messina hasn't replied by 2026-06-05, the pivot was to a wedding-vertical maker — confirm which one is hunting today.
- DM the hunter: "Tomorrow morning, 3:01am PT. Page is at producthunt.com/products/taskshq. The first comment is at the top of the page; happy to send the body if you want to read it before publishing. Thanks for hunting."
- If the hunter is silent at 5pm Mon, escalate to a maker-as-hunter post. PH allows it; the page goes up either way.

### 5:30pm — PH page final review
- Open `docs/product-hunt-page.md`. Read it once, slowly. Do not edit at 5:30pm Mon.
- Confirm in PH dashboard: tagline (60 char) is set; description (260 char) is set; topics are Productivity / Project Management / SaaS / Design Tools / No-Code; gallery has 5 images uploaded (hero strikethrough, four-view montage, refusal list, pricing math, /p/ workspace); first comment is drafted in the maker dashboard, ready to publish at 3:02am PT.
- Confirm Image 6 (the optional 30s hero loop MP4) is uploaded if rendering finished — if not, the 5 images carry.

### 6:00pm — Sanity check (same as Show HN, but stricter)
- `/principles` 200, `/changelog` 200 with cycle 30 pinned, `/pricing` 200 with all 5 tiers, `/p/wedding-2026-public` 200, `/app/board` redirects to `/sign-in`.
- Stripe webhook event count last 24h non-zero. Sentry zero issues last 4h. Phone charged.
- Run a Stripe checkout for the Wedding $79 tier in incognito — confirm session.create returns a URL and the success-page renders. Wedding is the lede today — its checkout has to be flawless.

### 6:30pm — Press follow-up state
- Run `mcp__claude_ai_Gmail__search_threads` with the Thu 06-18 follow-up senders (rows 5, 11, 14, 15 — Brach, the Allens, O'Leary, Moore).
- Anyone replied? Draft acknowledgments for tomorrow morning's send. Reference yesterday's PH launch as a fresh news peg.

### 7:00pm — Pre-stage browser tabs (left-to-right)
- Tab 1: `producthunt.com/products/taskshq` — logged in as maker, ready.
- Tab 2: PH maker dashboard — first comment ready to publish.
- Tab 3: `docs/product-hunt-page.md` — open in editor for reference.
- Tab 4: X composer — `@taskshq` logged in; the 10-post thread from `docs/posts-week-7.md` Tue 06-23 7:00am section open in side editor.
- Tab 5: Bluesky composer — `taskshq.bsky.social` logged in; the 4-post thread from `docs/posts-week-7.md` Tue 06-23 8:00am section open.
- Tab 6: r/SideProject submission — `docs/posts-week-7.md` Tue 06-23 8:00am ET section, body open.
- Tab 7: incognito — for verifying PH page is live to logged-out visitors.
- Tab 8: `docs/kpi-log.md` — open and ready.
- Tab 9: Sentry — production issues view.
- Tab 10: PostHog — `signup_completed` live events, filter on UTM=producthunt.

### 7:30pm — Calendar holds
- Run `mcp__claude_ai_Google_Calendar__create_event` for: Tue 06-23 5:30am wake, 6:01am POST PH, 7:00am maker comment + X 10-thread, 8:00am Bluesky 4-thread + r/SideProject, 11:30am pricing-math maker comment, 12:00pm X second push, 3:00pm cinematic-demo maker comment, 5:00pm X third push, every 30 min the pulse-check timer (don't refresh PH otherwise), 9pm close.
- 10-min reminders on each. The 30-min pulse timer is the discipline — set a phone alarm if calendar holds aren't loud enough.

### 8:00pm — Final read of the PH page first comment
- `docs/product-hunt-page.md` lines 63–73. Read it once. Confirm it leads with "solo founder here" and ends with the "which feature on the refusal list would you have argued hardest to keep?" question — that's the engagement hook for the first hour.

### 8:30pm — Maker comment cadence pre-flight
- Open `docs/posts-week-7.md` Tue 06-23 sections — confirm the X 10-thread, Bluesky 4-thread, r/SideProject body are ready.
- Confirm the maker comment cadence (from `docs/product-hunt-page.md` lines 79–86):
  - 7:00am Tue: launch announce + first principles excerpt.
  - 11:30am Tue: pricing-math drilldown.
  - 3:00pm Tue: cinematic-demo deep-dive.
  - 9:00am Wed: "what surprised me overnight."
  - 10:30am Wed: one cycle excerpt — pull from CHANGELOG cycle 30 (the Google bridges thesis).

### 9:00pm — Sleep early
- Wake-up is 5:30am ET (= 2:30am PT). Bed by 9:30 if you can hold it.
- No PH refresh tonight. The page goes live at 3:01am PT regardless of whether you're watching.

---

## Tue 2026-06-23 — Product Hunt LAUNCH DAY

### 5:30am ET — Wake, coffee, no inbox
- Coffee. Eat something simple. Do not open email, X, HN.
- The first 30 minutes are about being clear-headed at 6:01am, not about clearing the overnight backlog.

### 5:50am ET — Re-open the ten tabs
- Same order as Mon 7pm. Confirm sessions are live.

### 5:55am ET — Confirm PH page status
- The page should still be in "scheduled" / "coming soon" state until exactly 3:01am PT (= 6:01am ET).
- If the page is live early — that's a PH platform thing, not a problem. Roll with it.

### 6:01am ET — POST · Product Hunt goes live
- The page publishes automatically at 3:01am PT. Confirm in tab 1.
- In the incognito tab (tab 7), navigate to `producthunt.com/products/taskshq` — confirm the page is visible to logged-out visitors.
- Take a screenshot of the page live for the kpi-log.

### 6:02am ET — Publish the first comment (maker)
- In the PH maker dashboard (tab 2), publish the first comment from `docs/product-hunt-page.md` lines 63–73 verbatim.
- This is the maker's pinned reply — sets the tone for the day.
- Confirm it appears under the page within 30 seconds.

### 6:05am ET — Note the launch state
- Write to `docs/kpi-log.md`: `2026-06-23 06:01 | PH live | rank=initial | upvotes=0`.
- Don't refresh the leaderboard yet. The 30-min timer starts now — next leaderboard check at 6:35am.

### 6:15am ET — First 15 minutes of PH comments
- Reply within 15 min to every comment that lands in the first 6 hours — that's the cadence rule.
- Early commenters are typically PH regulars and the hunter's network. Be warm but dry. Don't over-explain.
- For "love the refusal list" — thank them; ask which refusal they'd argue with.
- For "looks like Notion / Linear / Asana" — same play as Show HN. Acknowledge crowded space; point at /principles.

### 6:35am ET — First 30-min leaderboard check
- Glance at the daily leaderboard. Note rank and upvote count.
- Don't react. The first 30 minutes is the slowest signal of the day.
- Write to `docs/kpi-log.md` with timestamp `06:35`.

### 7:00am ET — POST · X launch thread (10 posts)
**Lives at `docs/posts-week-7.md` Tue 06-23 7:00am section.** Paste the 10 posts in order, 2–3 min apart so the thread stays attached.

- Post 2/10 contains `[NEEDS-REVIEW: insert HN thread URL Tue 06-23 6:55am ET]` — replace with the HN thread URL from last week's Show HN (the URL is in `docs/kpi-log.md` Tue 06-16 row).
- Tick the boxes in `docs/posts-week-7.md` as you go.

### 7:00am ET — Maker comment #2 (PH) — launch announce + principles excerpt
- The 7:00am maker comment from the cadence in `docs/product-hunt-page.md` lines 80.
- Body to publish: *"Live now. The first comment above is the long version of why. The shortest version is on /principles — eight features Tasks will never ship, on a public URL. The most-argued-with item across last week's Show HN was *no AI agent that runs your tasks for you. The dopamine of crossing it off is not outsourceable.* Curious which one you'd push back on hardest."*
- This is a fresh comment, not a reply to the first comment. Sets a second discussion thread under the page.

### 7:30am ET — PH reply round 1
- Reply to all comments that have landed since 6:01am. 15-min cadence rule is in force.
- For "what makes this different from [tool X]?" — point at /principles. The differentiator is the refusal list, not the feature list. Don't compare line-by-line.
- For "is the free tier really free?" — paste the canned answer from `docs/show-hn.md` lines 127–131. *"There isn't one [catch]. Free is one workspace, every view, three editing guests, the daily digest, magic-link sharing — no time limit, no card, no degradation."*

### 8:00am ET — POST · Bluesky launch thread (4 posts)
**Lives at `docs/posts-week-7.md` Tue 06-23 8:00am section.** Paste posts 1/4 through 4/4 in order, 2–3 min apart.

### 8:00am ET — POST · r/SideProject launch
**Body lives at `docs/posts-week-7.md` Tue 06-23 8:00am ET section.** Title and body verbatim. Submit. Tick the box.
- r/SideProject is upvote-and-comment driven; reply to the first 5–10 comments within 30 min.

### 8:30am ET — PH reply round 2
- Reply to comments that landed since 7:30am. 15-min cadence.
- The leaderboard at 8:30am is meaningless — too early. Don't refresh it just to refresh it.

### 9:00am ET — Pulse check (write to kpi-log)
- Don't refresh the PH leaderboard manually — pull the rank from the maker dashboard, which has it cached.
- Note: rank, upvote count, comments count, X 10-thread post 1/10 engagement, Bluesky 4-thread post 1/4 engagement, r/SideProject upvote count, PostHog `signup_completed` count since 6:01am, Stripe checkout sessions started since 6:01am, Wedding $79 conversions since 6:01am.
- Single row, timestamp `09:00`.

### 9:30am ET — PH reply round 3
- Reply to comments since 8:30am. The 9–11am window is when PH gets its first real engagement wave (East Coast logged on, West Coast still logging in).

### 10:00am ET — Press follow-up send (any inbound from W6 follow-up)
- Run `mcp__claude_ai_Gmail__search_threads`. Anyone replied to the Thu 06-18 follow-up?
- Reply within the hour. Reference today's PH launch as a fresh news peg: *"Tasks just launched on Product Hunt this morning at 6am ET — currently at [rank] with [N] upvotes and [M] comments. If a piece would benefit from both Show HN and PH numbers, happy to send a combined snapshot Wed."*
- Send drafts one-by-one. No BCC.

### 10:30am ET — PH reply round 4
- Reply to comments since 9:30am.
- For SSO questions — paste the canned answer from `docs/show-hn.md` lines 122–125 or `docs/posts-week-6.md` Thu 06-18 Post 5/5: *"Maybe. Quietly. We won't put it on the pricing page. Companies that sell SSO sell fear."*
- For Gantt questions — same canned answer as Show HN. Don't argue.

### 11:00am ET — Pulse check (write to kpi-log, prep for noon push)
- Same row shape as 9:00am. Timestamp `11:00`.
- Note: at 11am ET it's 8am PT — West Coast wave is incoming. Rank should hold or climb.

### 11:30am ET — Maker comment #3 (PH) — pricing-math drilldown
- The 11:30am maker comment from `docs/product-hunt-page.md` lines 81.
- Body to publish — front-runs the inevitable "isn't $9.95 too cheap?" question:
  - *"Front-running the question that came up most on Show HN: 'Won't per-workspace pricing lose money on big teams?' Yes — and that's the design, not a bug. The wedding workspace fits the bride, groom, both moms, the MOH, the DJ for one number, $9.95 flat. Per-seat tools charge 5–6 × $9.95 for the same group. We chose the audience that wins under per-workspace (small groups, individual operators) and accepted that we'll lose 200-person engineering orgs to Linear. Linear already has them. The math is at /pricing. The reasoning is at /principles."*
- Fresh comment under the page, not a reply.

### 12:00pm ET — POST · X second push single
**Body lives at `docs/posts-week-7.md` Tue 06-23 12:00pm ET section.** Replace the placeholder `[NEEDS-REVIEW: insert PH rank + upvote count Tue 06-23 11:55am ET]` with the rank and upvote count from the 11:00am kpi-log row (the 11:55am check is for fresh numbers — pull from PH dashboard at 11:55am, drop into the post, hit publish at 12:00pm).
- Tick the box.

### 12:15pm ET — LUNCH (a real one, off-screen)
- 30 min. Phone in another room. The PH leaderboard does not require your eyes from 12:15 to 12:45.
- The 15-min reply cadence is paused — but the day's first 6 hours are 6:01am–12:01pm, so the strict 15-min rule has actually just relaxed naturally. From here, 30-min reply cadence is the new floor.

### 12:45pm ET — PH reply round 5
- Reply to comments since 11:30am. 30-min cadence.
- The midday lull is real — same as Show HN. Reply through it.

### 1:00pm ET — Press inbox triage
- Run `mcp__claude_ai_Gmail__search_threads`. Anyone new since 10am?
- Inbound from the PH launch is starting to land — PH coverage in newsletters tends to send writers your way mid-afternoon.
- Draft replies. Send at 4pm.

### 1:30pm ET — Pulse check (write to kpi-log)
- Same row shape. Timestamp `13:30`.
- Compare 11:00 → 13:30: is rank holding, climbing, dipping? PH leaderboards reshuffle most aggressively in the 1–3pm ET window because the West Coast pile-on starts around 12pm PT (= 3pm ET).

### 2:00pm ET — PH reply round 6
- Reply to comments since 12:45pm.
- The afternoon wave is more skeptical — same pattern as Show HN. The "love it" early upvotes are done; what's left is the harder questions.

### 2:30pm ET — Don't post anything new
- The 7am X 10-thread, the 8am Bluesky 4-thread, the 8am r/SideProject post, the 12pm X second push, the maker comments — that's the day's broadcast load. No additional posts in the early afternoon.
- Read. Don't write outside the comments box.

### 3:00pm ET — Maker comment #4 (PH) — cinematic-demo deep-dive
- The 3:00pm maker comment from `docs/product-hunt-page.md` lines 82.
- Body to publish — hooks the design crowd:
  - *"The hero on tasks-nu-hazel.vercel.app is a fully-autonomous demo. Three users moving cards, leaving comments, switching views — over real cursors with real motion physics. No video. Live React. The trick is `LayoutGroup` + `layoutId` — when a task moves between board / list / timeline, it FLIPs in place. Same DOM node, four geometries. Cursors carry weight: when David picks up a card, the cursor's spring-physics target lags the card by 80ms. You can see him *holding* it. Source is at `src/components/showcase/cinematic-demo.tsx`. Marketing isn't a different app — it's the app, on autopilot, in a loop."*
- Fresh comment.

### 3:30pm ET — PH reply round 7
- Reply to comments since 2:00pm.
- The cinematic-demo comment will draw a wave of "show me the code" / "how did you build the cursor physics" — be ready to answer with specifics. Don't dodge into "happy to write a blog post" — answer the question in the reply if it fits in two paragraphs.

### 4:00pm ET — Press follow-up send
- Send drafts from the 1pm triage. One-by-one. No BCC.
- Reference today's PH numbers from the 13:30 kpi-log row.

### 4:30pm ET — Pulse check (write to kpi-log)
- Same row shape. Timestamp `16:30`.
- Compare 13:30 → 16:30: is rank top-5 yet? Top-3? The end-of-day rank locks at midnight PT (= 3am ET Wed); the 4:30pm row is the strongest signal of where the day will land.

### 5:00pm ET — POST · X third push single
**Body lives at `docs/posts-week-7.md` Tue 06-23 5:00pm ET section.** Replace the placeholder `[NEEDS-REVIEW: insert PH rank + upvote count Tue 06-23 4:55pm ET]` with the rank and upvote count from the 16:30 kpi-log row (or pull fresh at 4:55pm if numbers have moved since).
- Tick the box.

### 5:30pm ET — PH reply round 8
- Reply to comments since 3:30pm. 30-min cadence holds.

### 6:00pm ET — Eat dinner near the desk
- 20 min. Stay near the laptop. The 6–9pm ET window is the European-overnight + late West Coast traffic — slower comments, but typically from people who actually clicked through and used the product.

### 6:30pm ET — PH reply round 9
- Reply to comments since 5:30pm.
- Sentry check: any production issues? PH traffic peaks tend to surface bugs the regular workload didn't.

### 7:00pm ET — Pulse check (write to kpi-log)
- Same row shape. Timestamp `19:00`.

### 7:30pm ET — Long-tail replies
- The thread is now mostly long-tail — one new comment every 15–20 min.
- Reply when something is interesting. Ignore the pile-on.

### 8:00pm ET — Final pulse check (write to kpi-log)
- Same row shape. Timestamp `20:00`.
- This is the row that closes the day. The numbers here are the ones that go into the Wed 06-24 IH milestone post and the Wed 10am X recap.

### 8:30pm ET — Last reply pass
- Reply to anything from the last hour that's worth it. Otherwise step back.

### 9:00pm ET — Close
- The PH day technically runs until midnight PT (= 3am ET Wed). The final rank locks at 3am ET.
- You don't need to be awake at 3am ET to lock the rank — PH does that automatically. Bed at a normal hour.
- Final write to `docs/kpi-log.md`: closing row with all PH day numbers, marked `EOD-Tue`. Note that the EOD-PH-time is 3am ET Wed; the actual rank-locked number gets written into the Wed kpi-log row at 9am Wed.
- Phone notifications off except Sentry.
- Bed by 10:30. Tomorrow is the IH milestone post day, and it starts at 8am ET.

---

## Wed 2026-06-24 — IH milestone day

### 8:00am ET — Wake, coffee, check the locked PH rank
- The PH leaderboard locked at 3am ET. Open `producthunt.com/products/taskshq` and note the EOD rank, final upvotes, final comments.
- Write to `docs/kpi-log.md`: `2026-06-24 08:00 | PH EOD rank=X | upvotes=Y | comments=Z`.
- Confirm: did we hit top-5? Top-10? The IH post is honest about whatever the number is — no spin.

### 8:15am ET — Sentry + PostHog overnight check
- Sentry: any new issues from the late-night PH traffic? If yes, triage.
- PostHog: cumulative `signup_completed` since Tue 6:01am — this is the launch-day signup count for the IH post.
- Stripe: tier mix on paid conversions since Tue 6:01am — Wedding $79, Studio $14.95, Team $9.95, Pro $4.99 counts.
- Write all of the above to `docs/kpi-log.md` as the Wed AM row.

### 8:30am ET — Maker comment #5 (PH) — "what surprised me overnight"
- The 9:00am maker comment from `docs/product-hunt-page.md` lines 83 — pulled forward to 8:30am because PH commenters are awake at 8:30 ET.
- Body to publish — acknowledges the top comment from yesterday, then names the surprise:
  - *"Eighteen hours in, the comment that's lodged hardest is the pushback on *no AI agent that runs your tasks for you.* About a third of yesterday's thread argued that the dopamine of crossing it off should be outsourceable to an agent — that the modern productivity bar is an agent that closes the loop. We hold the line on that one. The dopamine isn't separable from the act; outsourcing the close means outsourcing the agency. The list waits for you. You don't wait for the list. The Wed 9am ET version of that argument is honest because the upvotes don't change the answer — /principles is the spine, and the spine doesn't bend on the launch high."*
- Fresh comment.

### 9:00am ET — POST · Indie Hackers milestone post
**Lives at `docs/posts-week-7.md` Wed 06-24 9:00am section.** Title and body verbatim. Submit.

- The post has 5 placeholders tagged `[NEEDS-REVIEW: ... Wed 06-24 8am ET]` — fill in from the 8:00am and 8:15am kpi-log rows:
  - Show HN result (rank, hours top-30, comments) — pull from `docs/kpi-log.md` Tue 06-16 EOD row.
  - PH result (rank, upvotes, comments) — pull from this morning's 8:00am row.
  - Free signups across the launch week — cumulative.
  - Paid conversions across the launch week — cumulative, with tier mix.
  - Published `/p/{slug}` workspaces — current count.
- One placeholder is the wedding-tier purchase count — pull from Stripe.
- Tick the box.

### 9:30am ET — Reply to early IH comments
- IH responds within minutes when a post lands well. Reply to the first 5 comments within 30 min.
- IH audience cares about: solo-founder math, bootstrapping pricing, the operator-persona patch story (cycle 21 Studio tier). Lean into specifics, not generalities.

### 10:00am ET — POST · X recap thread (6 posts)
**Lives at `docs/posts-week-7.md` Wed 06-24 10:00am section.** Insert the placeholders from the morning kpi-log rows. Paste posts 1/6 through 6/6 in order, 2–3 min apart.
- The post has 6 placeholders to fill — all the rank/comment/conversion counts from the 8:00am row.
- Tick the boxes.

### 10:30am ET — Maker comment #6 (PH) — cycle excerpt
- The 10:30am maker comment from `docs/product-hunt-page.md` lines 84 — pulls one cycle-narrative excerpt from CHANGELOG cycle 30 (the Google bridges thesis).
- Body to publish:
  - *"One cycle excerpt for context: cycle 30 was the Google integrations decision. We didn't ship Google OAuth. We shipped CSV import, Markdown export, and an iCal subscribe URL. Three thinner bridges instead of one fat OAuth tunnel. The reasoning: OAuth is a relationship; subscribe URLs are a handshake. The user we built for doesn't want a relationship with Google in their productivity tool — they want their calendar to update when the task date changes. iCal does that. OAuth would do it heavier, with a permissions screen, a privacy review, and a quarterly token refresh. We took the lighter answer. /changelog has the full writeup."*
- Fresh comment.

### 11:00am ET — PH reply round (Wed)
- Reply to comments that landed overnight or this morning.
- The 15-min cadence rule expired at midnight PT (= 3am ET) — Wed cadence is 30–60 min.

### 11:30am ET — IH reply round
- Reply to IH comments since 9:00am. Pick the threads that move the conversation, not every comment.

### 12:00pm ET — LUNCH

### 12:30pm ET — Bluesky cross-post (IH link + headline numbers)
- Single post. Body: *"What two launches in eight days actually taught us. Solo, no funding, per-workspace pricing — Show HN [HN result], Product Hunt [PH result], free signups across the week [N], paid mix [tier breakdown]. The full IH writeup is at [IH URL]."*
- Pull all numbers from this morning's kpi-log rows.
- Tick — this body is a day-of insert, not a pre-written `posts-week-7.md` body.

### 1:00pm ET — Press follow-up send
- Run `mcp__claude_ai_Gmail__search_threads`. Anyone replied since yesterday?
- Send Wed press follow-ups one-by-one. Use the body template from `docs/posts-week-6.md` Thu 06-18 12:00pm section as a starting frame, but update for the PH numbers.

### 2:00pm ET — YouTube 90s capture
**Script lives at `docs/posts-week-7.md` Wed 06-24 3:00pm section.** Voiceover paragraph is single-take, dry register. Pull the placeholder numbers from this morning's kpi-log rows.
- Pipeline: ScreenStudio → Descript → Remotion (10 on-screen captions, lower-third, 11px caps) → ElevenLabs → Resolve → 1080p30 export.
- Aim for upload by 3pm. Slip OK to 4pm.

### 3:00pm ET — Upload YouTube 90s
- Title and description from `docs/posts-week-7.md` Wed 06-24 3:00pm section. Pull the numbers in.
- Set as regular video (1080p), not Short — 90s with captions reads better as a regular video.

### 3:30pm ET — Pulse check (write to kpi-log)
- The Wed cumulative numbers: free signups since Tue 6am, paid since Tue 6am, tier mix, X 6-thread engagement, IH milestone reactions/comments, YouTube view count if uploaded.
- Single row, timestamp `15:30`.

### 4:00pm ET — PH + IH reply round
- Reply to PH comments since 11am. Reply to IH comments since 11:30am.
- 60-min cadence is fine on Wed afternoon.

### 5:00pm ET — Stop
- The launch-day-plus-one work is done. Thursday is the by-the-numbers long-form day; Friday is the thank-you close.
- Take the evening.

---

## End-of-launch retro template (write to `docs/kpi-log.md` Wed evening)

A 150-word retro, dry register, written before you close the laptop Wed.

```
## 2026-06-23 PH retro

What landed:
- [the comment / thread / asset that performed best — and the one observable reason it did]
- [the audience surprise — who showed up that you didn't expect]
- [the wedding-tier conversion signal — did leading with $79 do the work the post-mortem from Show HN said it would?]

What didn't:
- [the angle that fell flat — the cinematic-demo deep-dive? the 3pm push?]
- [the leaderboard rank vs. the goal — top-5 hit or missed]
- [the maker comment that drew silence — and the reading of why]

What surprised:
- [the question that came up that you didn't have a canned answer for]
- [the cross-pollination — did Show HN traffic cross over to PH, or was it two different audiences?]
- [the conversion mix — Wedding-heavy, Studio-heavy, or balanced?]

What changes for the next 8-week cycle:
- [the post-launch retention play — daily digest is the lever; what's the cadence after 2 weeks?]
- [the press-coverage lesson — which writer's piece moved signups, and what did the angle have in common?]
- [the refusal-list pressure points — which item drew the most pushback and is therefore the most valuable to keep on the list]
```

This 150-word retro becomes raw material for the Thu 06-25 long-form post (`docs/posts-week-7.md` Thu 06-25 10:00am section), which already has a structured "by the numbers" frame waiting for the launch-week totals.

---

## Quick-reference ledger — PH day

| Time (ET) | Action | Source |
|---|---|---|
| Mon 5:00pm | Hunter status confirm | this file |
| Mon 5:30pm | PH page final review | docs/product-hunt-page.md |
| Mon 6:00pm | Sanity check | this file |
| Mon 6:30pm | Press follow-up state | Gmail MCP |
| Mon 7:00pm | Pre-stage 10 browser tabs | this file |
| Mon 7:30pm | Calendar holds (Google Calendar MCP) | this file |
| Mon 8:00pm | Final read of first comment | docs/product-hunt-page.md |
| Tue 5:30am | Wake | — |
| Tue 6:01am | **POST · PH live** | producthunt.com/products/taskshq |
| Tue 6:02am | Publish first comment (maker) | docs/product-hunt-page.md |
| Tue 6:35am | First leaderboard check | PH dashboard |
| Tue 7:00am | **POST · X 10-thread** | docs/posts-week-7.md Tue 7:00am |
| Tue 7:00am | Maker comment #2 — launch announce | this file |
| Tue 8:00am | **POST · Bluesky 4-thread** | docs/posts-week-7.md Tue 8:00am |
| Tue 8:00am | **POST · r/SideProject** | docs/posts-week-7.md Tue 8:00am |
| Tue 9:00am | Pulse check #1 → kpi-log | docs/kpi-log.md |
| Tue 11:00am | Pulse check #2 → kpi-log | docs/kpi-log.md |
| Tue 11:30am | Maker comment #3 — pricing-math | this file |
| Tue 12:00pm | **POST · X second push** | docs/posts-week-7.md Tue 12:00pm |
| Tue 12:15pm | Lunch | — |
| Tue 1:30pm | Pulse check #3 → kpi-log | docs/kpi-log.md |
| Tue 3:00pm | Maker comment #4 — cinematic-demo | this file |
| Tue 4:00pm | Press follow-up send | Gmail MCP |
| Tue 4:30pm | Pulse check #4 → kpi-log | docs/kpi-log.md |
| Tue 5:00pm | **POST · X third push** | docs/posts-week-7.md Tue 5:00pm |
| Tue 7:00pm | Pulse check #5 → kpi-log | docs/kpi-log.md |
| Tue 8:00pm | Final pulse → kpi-log EOD | docs/kpi-log.md |
| Tue 9:00pm | Close | — |
| Wed 8:00am | Locked PH rank check → kpi-log AM row | PH dashboard |
| Wed 8:30am | Maker comment #5 — overnight surprise | docs/product-hunt-page.md |
| Wed 9:00am | **POST · IH milestone** | docs/posts-week-7.md Wed 9:00am |
| Wed 10:00am | **POST · X 6-thread recap** | docs/posts-week-7.md Wed 10:00am |
| Wed 10:30am | Maker comment #6 — cycle excerpt | docs/product-hunt-page.md |
| Wed 12:30pm | Bluesky cross-post (IH link) | this file |
| Wed 1:00pm | Press follow-up send | Gmail MCP |
| Wed 2:00pm | YouTube 90s capture | docs/posts-week-7.md Wed 3:00pm |
| Wed 3:00pm | Upload YouTube 90s | YouTube |
| Wed 3:30pm | Pulse check → kpi-log | docs/kpi-log.md |
| Wed 5:00pm | Retro to kpi-log (150 words) | docs/kpi-log.md |

**PH-specific discipline:**
- Don't refresh the leaderboard obsessively — 30-min timer, then a row in kpi-log.
- Reply within 15 min for the first 6 hours (6:01am–12:01pm ET). After that, 30-min cadence is fine. Wed cadence relaxes to 30–60 min.
- 5 maker comments across the day, plus the first comment on launch — that's the load. Don't over-comment; the page is its own broadcast.
- Wedding tier leads. Every reply that touches pricing names the wedding tier first, the per-workspace pricing second.
- Refusal list is the spine. Every comparison-to-other-tools reply ends with /principles.

**Press contacts in scope today:** rows 5, 11, 14, 15 from `gtm-plan.md` §9 (Brach, the Allens, O'Leary, Moore) — these are the ones the Thu 06-18 follow-up went to. Plus any inbound from the Show HN W6 window that hadn't replied yet.

**No new asset renders Tue.** All gallery images, the first comment, the PH page copy — all shipped Mon. Tuesday is comments-and-pulse.

**One asset on Wed:** the YouTube 90s. Same pipeline as W1's hero loop — ScreenStudio → Descript → Remotion → ElevenLabs → Resolve.

**No paid spend today.** PH runs on organic + the hunter network + the cumulative warmth from W6's Show HN. Paid wraps after this week.

---

*Three assumed timing calls in this doc, flagged for the operator: (1) PH comments arrive in three waves — early-PT-regulars 6:01–8:00am ET, East Coast 9:00am–noon ET, West Coast 12:00–4:00pm ET. The 15-min cadence rule covers all three but the actual reply pace will dip in the 12–1pm ET lunch lull and pick up again at 1pm. (2) Press inbound starts arriving around 10am ET Tue, peaks 1–4pm — based on PH coverage in newsletters tending to be written same-day, sent next-day. (3) The IH milestone post reaction window is the first 4 hours after 9am Wed — reply within 30 min for the first 5 comments to anchor the thread, then 60-min cadence. All three are revisable based on what the Show HN W6 window taught.*
