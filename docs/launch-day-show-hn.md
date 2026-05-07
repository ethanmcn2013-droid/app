# Tasks · Launch Day Playbook — Show HN (Tue 2026-06-16)

**Goal:** sustained ≥6 hrs top-30 on HN front page; ≥250 free signups by EOD; press-replies acknowledged within the hour.

**Brand voice on every reply:** dry, observational, em-dashes welcome, no emojis. Don't argue with "looks like Notion / Linear / Asana." Acknowledge it's crowded and point at /principles. Don't lead with the tech stack. Don't claim AI-powered. Don't reply within 30 seconds — wait 5–10 min between replies for the first hour. The link to the app IS the call to action.

**Tools at hand:** Gmail MCP (press-reply drafts), Google Calendar MCP (reminders), Sentry pager (already wired), `docs/kpi-log.md` (numbers go here, once per check-in).

---

## Mon 2026-06-15 — Final dry-run

### 7:00pm — Last sanity check
- `/principles` returns 200 in production — open in incognito.
- `/changelog` is current — cycle 24 should be pinned to top.
- `/pricing` shows all five tiers — Free, Pro $4.99, Team $9.95, Studio $14.95, Wedding $79.
- At least one published `/p/{slug}` returns 200 — the wedding-2026-public page is the canary.
- `/app/*` redirect: open `tasks-nu-hazel.vercel.app/app/board` in incognito — should land on `/sign-in`, not 404.
- OG images render — paste the URL into the Bluesky composer to confirm the card unfurls.
- Sentry pager set — phone-on-vibrate, not silenced.
- Stripe webhook event count for the last 24h is non-zero — billing is live.

### 7:30pm — Press inbox sweep (Gmail MCP)
- Run `mcp__claude_ai_Gmail__search_threads` with query `from:lenny@lennysnewsletter.com OR from:david@theverge.com OR from:luke@sherwoodmedia.com OR from:sarahp@techcrunch.com OR from:ben@stratechery.com` — anyone replied to the W5 send (rows 1, 2, 4, 8, 10, 12, 13)?
- For any thread that came back with an actual question, draft a reply now and save — the launch day is not the day to draft from scratch.
- Drafts only. Send Tuesday morning, after HN goes up, before X thread.

### 8:00pm — Pre-stage browser tabs (in this exact order, left-to-right)
- Tab 1: `news.ycombinator.com/submit` — logged in, ready.
- Tab 2: `docs/show-hn.md` — open in editor; the title and body are paste-ready.
- Tab 3: X composer — `@taskshq` logged in; the 8-post thread from `docs/posts-week-6.md` Tue 06-16 9:30am section open in a side-by-side editor.
- Tab 4: Bluesky composer — `taskshq.bsky.social` logged in; the announce single from `docs/posts-week-6.md` Tue 06-16 10:00am section open.
- Tab 5: incognito — for verifying the HN post is visible to logged-out users.
- Tab 6: `docs/kpi-log.md` — open and ready to take rows.
- Tab 7: Sentry — issues view, filter on production.
- Tab 8: PostHog — live events, filter on `signup_completed`.

### 8:30pm — One last read of the Show HN body
- Read `docs/show-hn.md` lines 17–95 once, slowly. Title is locked. Body is locked. Don't edit at 8:30pm the night before. If something feels off, mark it for the post-mortem, not the post.
- Confirm the title is the first option: "Show HN: We rebuilt project management for the 80% who don't work in tech."

### 9:00pm — Calendar holds
- Run `mcp__claude_ai_Google_Calendar__create_event` for: Tue 06-16 8:30am pre-flight, 9:00am POST HN, 9:30am POST X thread, 10:00am POST Bluesky, 10:30am HN second wave, 11:30am pulse check, 1:00pm lunch, 2:00pm pulse, 4:00pm pulse, 6:00pm pulse, 9:00pm close. 10-min reminders on each.

### 9:30pm — Sleep early
- No HN refresh. No "one more look." The product is what it is. Tomorrow is mostly typing into a comments box and answering questions you've already thought about.

---

## Tue 2026-06-16 — Show HN

### 6:30am — Coffee, no inbox
- Coffee. Eat something. Do not open Gmail. Do not open X. Do not open HN.
- The morning is for being awake at 9:00am, not for processing overnight noise.

### 7:30am — Re-open the eight tabs from last night
- Same order. Confirm sessions are still logged in.
- Confirm the show-hn.md file is unchanged — last edited timestamp should match what you saw at 8:30pm.

### 8:00am — Final pre-flight checklist
- `/principles` — 200, copy reads cleanly.
- `/changelog` — 200, cycle 24 on top.
- `/pricing` — 200, all 5 tiers, Wedding $79 visible without scroll.
- `/p/wedding-2026-public` — 200, renders.
- `/app/board` in incognito — redirects to `/sign-in`.
- Stripe checkout — click through the Pro $4.99 path in incognito to confirm session.create returns a URL.
- Sentry — zero issues in last 4 hours.
- Phone — charged, on vibrate.

### 8:30am — Press-reply drafts: send the ones from last night
- Open Gmail MCP `mcp__claude_ai_Gmail__list_drafts`.
- Send any drafts you wrote at 7:30pm Mon. One-by-one. No BCC. No broadcast.
- Acknowledge: "Show HN goes up at 9am ET — happy to send numbers after the front-page window closes." Don't promise interview times yet.

### 8:50am — Last 10 minutes
- Refresh `news.ycombinator.com` once — confirm there isn't already a Show HN dominating the page (if there is, still post — HN's algorithm rewards the front page, not slot avoidance).
- Open `docs/show-hn.md` to the title line. Open the post body to line 33.
- Phone face-down. Notifications off on everything except Sentry.

### 9:00am ET — POST · Hacker News
**The post body lives at `docs/show-hn.md`. Paste verbatim. Hit submit. Note the timestamp.**

- Title: "Show HN: We rebuilt project management for the 80% who don't work in tech."
- URL field: `https://tasks-nu-hazel.vercel.app`
- Body: paste from `docs/show-hn.md` lines 33–95 verbatim. Replace `[your handle]` with the actual HN handle.
- Hit submit. Do not preview-edit-second-guess. The post is locked.

### 9:01am — Open the second tab
- Copy the new HN item URL — `news.ycombinator.com/item?id=XXXXXXXX` — into a notes file. This URL gets pasted into:
  - Tue 9:30am X 8-thread, post 8/8.
  - Tue 10:00am Bluesky single.
  - Tue 11:00am LinkedIn note (if posting).
  - Wed 10:00am X recap thread, post 5/5.
  - Wed press nudge email.
  - Thu press follow-up email.
- Open the same URL in the incognito tab to confirm logged-out visitors see it.
- Write to `docs/kpi-log.md`: `2026-06-16 09:00 | HN submitted | item_id=XXXXXXXX`.

### 9:05am — First eyes on
- Refresh the post page. There may be 1–2 comments already. Don't reply yet. Read.
- If a comment is hostile, do not reply. If a comment asks a real question, queue it mentally — first reply lands at 9:15.

### 9:15am — Start replying to comments
- Reply pattern for the first hour: 5–10 min between replies. Don't reply to every comment — pick the ones that move the thread.
- For "won't per-workspace pricing lose money on big teams?" — paste the canned answer from `docs/show-hn.md` lines 105–109 verbatim. *"Yes — and that's the point. We chose the audience that wins under per-workspace pricing (small groups, individual operators) and accepted that we'll lose 200-person companies to Linear. Linear already has them."*
- For "looks like Notion / Linear / Asana" — acknowledge it's crowded; point at `/principles`. Don't argue.
- For "what about Gantt charts?" — paste the canned answer from `docs/show-hn.md` lines 110–114. *"Timeline view is the friendly cousin — visual sequencing without the cascading-dependencies-and-percent-complete-bars language of consultants. Gantt is enterprise theater. The audience we built for doesn't need it; the audience that needs it isn't us."*
- For "where's the catch on free?" — paste lines 127–131. *"There isn't one. Free is one workspace, every view, three editing guests, the daily digest, magic-link sharing — no time limit, no card, no degradation."*

### 9:30am — POST · X narrative thread (8 posts)
**The thread lives at `docs/posts-week-6.md` Tue 06-16 9:30am section.** Paste the 8 posts in order. Each post 2–3 minutes apart so the thread stays attached and X doesn't rate-limit.

- Post 8/8 contains `news.ycombinator.com/item?id=[INSERT-AFTER-POST]` — replace the placeholder with the real item ID before posting.
- Tick the boxes in `docs/posts-week-6.md` as you go.

### 9:50am — Back to HN
- New comments since 9:15. Reply to 2–3 more. Same 5–10 min cadence.
- If a comment is from a known reviewer (Lenny, Pierce, Kawa, Brach), reply within 5 min and tag the reply with one specific anecdote — not a generic ack.

### 10:00am — POST · Bluesky announce
**Body lives at `docs/posts-week-6.md` Tue 06-16 10:00am section.** Paste verbatim, replace the HN URL placeholder with the real item ID. Hit post.
- Tick the box in `docs/posts-week-6.md`.

### 10:15am — Pulse check #1 (don't write to kpi-log yet — too early)
- Glance at HN rank. Note it mentally. If front-page top-30, good. If not yet, the next two hours decide it.
- Glance at X thread engagement on post 1/8 — likes + reposts. Likes alone are not the signal; quote-reposts are.
- Glance at PostHog `signup_completed` count for the last hour — should be non-zero.

### 10:30am — Back to HN — second wave of replies
- Mid-morning HN brings the second wave: people who saw it on /newest, refreshed at 9:30, are now arriving.
- Specific guidance for the questions you'll get this hour:
  - **"Won't per-workspace pricing lose money on big teams?"** — answer once, in the post body if not already there, with the IH math: yes, and that's the point. Don't repeat the answer in three different replies; link the canonical reply.
  - **"This looks like Notion."** — acknowledge crowded space. Point at `/principles`. The differentiator is the refusal list, not the feature list. Don't try to win on features.
  - **"What about Gantt?"** — paste the canned answer. Move on.
  - **"How is this different from Linear?"** — Linear is for engineering teams with epics and sprints; Tasks is for everyone else. Audience-not-features framing. Don't compare line-by-line.
  - **"Show me the code."** — Tasks is closed-source for now; happy to talk about the cinematic-demo source which is in `src/components/showcase/cinematic-demo.tsx` if HN cares about the marketing-as-app pattern. Don't apologize for closed-source; HN respects shipping.

### 11:00am — Short break
- Five minutes off-screen. Stand up. Water. Bathroom. The day is long.
- Phone stays face-down.

### 11:30am — First pulse check (write to kpi-log.md)
- HN rank — record exact rank and time.
- HN comments count.
- HN upvotes (if visible to you as OP).
- X thread post 1/8 — likes, reposts, quote reposts.
- Bluesky announce — likes, reposts.
- PostHog `signup_completed` count since 9am.
- Stripe checkout sessions started since 9am.
- Write a single row to `docs/kpi-log.md` with all of the above and the timestamp `11:30`.

### 12:00pm — LUNCH (a real one, off-screen)
- Phone in another room. The HN front page does not require your eyes from 12 to 12:45.
- Eat protein. Don't carb-crash at 2pm.

### 12:45pm — Back at the desk
- Glance at HN. The midday lull is real — Europe is logging off, West Coast hasn't logged on. Rank may dip slightly. This is normal. Replying through it is what keeps the thread alive.

### 1:00pm — Press-reply triage round 2 (Gmail MCP)
- Run `mcp__claude_ai_Gmail__search_threads` again — anyone new?
- The HN front-page exposure brings press out who didn't reply to the W5 send. Treat new inbound as: reply within the hour, draft only — do not send within 5 minutes of receipt.
- Specific reply template: *"Thanks — Show HN went up at 9am ET, currently at [rank] with [N] comments. Happy to jump on a call this week, or send written numbers Wed morning. Either works."*
- Save as drafts. Send at 4pm.

### 1:30pm — HN reply round 3
- Afternoon comments. The thread is now more skeptical — the easy "love it" upvotes happened in the first 90 minutes; what's left is the harder questions.
- Reply pace slows naturally to one reply per 15–20 min. Don't force it.
- If a comment thread is going sideways (hostile, off-topic), let it die. HN downweights low-signal replies.

### 2:00pm — Pulse check #2 (write to kpi-log)
- Same row shape as 11:30. Timestamp `14:00`.
- Compare to 11:30: are signups accelerating, flat, or decelerating? Front-page time is the leading indicator; signups lag by 30–60 min.

### 2:30pm — Don't post anything
- The 9:30am X thread is doing its work; the 10am Bluesky is doing its work; HN is doing its work. Adding another post in the early afternoon dilutes attention.
- Read. Don't write.

### 3:00pm — HN reply round 4 — the West Coast wave
- 12pm PT = 3pm ET. The West Coast logs on. Fresh eyes on the post.
- Reply to 2–3 comments. Same 5–10 min cadence. The post may climb again on the West Coast wave.

### 3:30pm — Press follow-up: send the 1pm drafts
- Open Gmail MCP. Send any drafts you wrote at 1:00pm.
- One-by-one, no BCC.

### 4:00pm — Pulse check #3 (write to kpi-log)
- Same row shape. Timestamp `16:00`.
- This is the row that tells you whether the ≥6 hours top-30 goal is going to land. If you've been on the front page since 9:30am-ish and you're still on it at 4pm, the goal is hit. If you fell off at 2pm, you can still come back on the West Coast wave but it's tighter.

### 4:30pm — Comments round 5
- The thread is now mostly long-tail — one new comment every 10–15 min.
- Reply when something is interesting; ignore the pile-on.

### 5:00pm — Snack, stand up, walk around the block
- Ten minutes off-screen. The HN comments page does not require your eyes for this window.

### 5:30pm — Back at the desk
- Read what came in during the walk. Reply to one or two if they're interesting.
- Don't manufacture replies for engagement. The thread is what it is.

### 6:00pm — Pulse check #4 (write to kpi-log)
- Same row shape. Timestamp `18:00`.
- Are we still on the front page? Note rank. Note whether the top-30 streak is intact.

### 6:30pm — Light dinner. Stay near the desk but don't stare.
- The evening HN traffic is European-overnight + late West Coast. Slower, but the comments that come in now tend to be from people who actually used the product.

### 7:30pm — Reply round 6
- Anyone who signed up and is reporting a bug — reply within 30 min, fix if trivial, otherwise acknowledge and ticket.
- Sentry should already have flagged anything load-bearing.

### 8:00pm — Final pulse check (write to kpi-log)
- Same row shape. Timestamp `20:00`.
- This is the row that closes the day. Numbers here are the ones you'll quote tomorrow morning in the X recap thread, the press nudge email, and the YouTube Short script.

### 8:30pm — Stop replying
- The HN thread will keep generating comments overnight; replying at 8:30pm-Eastern is replying for nobody.
- Step away from the keyboard.

### 9:00pm — Close
- Final glance: HN rank, comments count, signups for the day.
- Final write to `docs/kpi-log.md`: a closing row with all five Show HN day numbers, marked `EOD`.
- Phone notifications off for the night except Sentry.
- Dinner. Couch. Bed by 10:30. Tomorrow is the recap day and it starts at 8:30am.

---

## Wed 2026-06-17 — Recap day

### 8:30am — Review overnight HN comments
- Open the HN thread. Read the 5–15 comments that came in overnight. Most are from non-US time zones; some will be the most thoughtful comments of the launch.
- Reply to 3–5 of them. Same 5–10 min cadence.
- Update `docs/kpi-log.md` with the overnight numbers — final HN rank progression, comments count, total signups since 9am Tue.

### 9:00am — Press inbox sweep (Gmail MCP)
- Run `mcp__claude_ai_Gmail__search_threads` — overnight replies?
- Reply to any thoughtful inbound within 30 min. Numbers are the lever — quote the HN result.

### 9:30am — Confirm HN numbers for the recap thread
- Pull the final numbers for the Wed 10am X 5-thread post 1/5 — `docs/posts-week-6.md` Wed 06-17 10:00am section, the placeholders tagged `[NEEDS-REVIEW: insert HN numbers Wed 06-17 EOD]`.
- Specific values to drop in:
  - `[X upvotes]` — final upvote count.
  - `[Y comments]` — final comments count.
  - `[Z hours]` — total hours top-30 on front page.
- Read the values back from `docs/kpi-log.md` Tue EOD row — do not eyeball, do not round.

### 10:00am — POST · X recap thread (5 posts)
**Lives at `docs/posts-week-6.md` Wed 06-17 10:00am section.** Insert the HN numbers from `kpi-log.md` Tue EOD row. Replace `[INSERT-AFTER-POST]` in post 5/5 with the HN item URL.

- Paste posts 1/5 through 5/5 in order, 2–3 min apart.
- Tick the boxes as you go.
- Don't add commentary outside what's in the file.

### 10:30am — Bluesky cross-post
- Pull the headline number from post 1/5 and craft a single Bluesky post: *"Twenty-four hours after Show HN — [Z hours] on the front page, [X upvotes] upvotes, [Y comments] comments. The full thread is at [HN URL]. The recap on X: [X URL]."*
- Bluesky doesn't have a scheduled body in `posts-week-6.md` for Wed 10:30am — the body above is the day-of insert. Post once, move on.

### 11:00am — Reply to inbound from the recap thread
- The X recap thread will draw replies from people who saw it but didn't see the original. Reply to 2–3.
- Don't link the HN thread again — it's in the recap thread already.

### 11:30am — Sentry + PostHog check
- Sentry: any new issues since yesterday morning? If yes, triage.
- PostHog: signup-to-Pro conversion rate for the launch cohort. If it's >2%, the pricing page is doing the work. If it's <1%, note for the Friday IH retro.
- Stripe: tier mix on the paid conversions. Wedding $79 should be punching above its weight.

### 12:00pm — LUNCH

### 12:30pm — Press nudge email send (Wed press nudge — `docs/posts-week-6.md` 12:00pm section)
**Body lives at `docs/posts-week-6.md` Wed 06-17 12:00pm ET section.** The template is no-recipients — fill in per writer.

- Send to writer 1 (Lenny Rachitsky): personalize the opening — reference his most recent pricing-page teardown.
- Send to writer 2 (Luke Kawa, Sherwood): personalize the opening — reference his recent piece on SaaS pricing.
- Send to writer 3 (Kai Brach, Dense Discovery): personalize the opening — reference a recent design-led tool he linked.
- Insert the HN numbers from `kpi-log.md` Tue EOD row into each.
- Insert the HN item URL into each.
- Send one-by-one. No BCC. No broadcast.

### 1:30pm — Reply to anyone who replied to the press nudge
- Some writers reply within 30 min. If yes, reply within the hour, draft only — don't send within 5 minutes.

### 2:00pm — YouTube Short capture (60s reaction recap)
**Script lives at `docs/posts-week-6.md` Wed 06-17 3:00pm ET section.**
- Record the voiceover paragraph as a single take. Dry register. No retakes for 'energy.'
- The 3 on-screen captions go where the file specifies. Pull the HN numbers from `kpi-log.md` for caption 1.
- Pipeline: ScreenStudio capture → Descript trim → Remotion overlay captions → ElevenLabs voiceover (or read it yourself if PVC clone is trained) → Resolve free composite → 1080p30 export.
- Aim for upload by 3pm. Slip OK to 4pm.

### 3:00pm — Upload YouTube Short
- Title and description from `docs/posts-week-6.md` Wed 06-17 3:00pm section.
- Insert HN numbers in the description.
- Set as `Short` (not regular video). 1080×1920 vertical.

### 3:30pm — Pulse check on the recap thread
- X recap thread, post 1/5 — likes, reposts, quote reposts.
- The recap thread typically gets ~30–50% of the launch thread's engagement. Use this as a noise floor for the PH recap structure next week.

### 4:00pm — Reply to HN thread one more time
- The HN thread is now ~30 hours old; one more pass through unreplied comments and then the thread is done with active replies.
- Reply to 2–3 if anything is worth it. Otherwise close the tab.

### 4:30pm — Update `docs/kpi-log.md` with Wed numbers
- New row: HN final state (no longer climbing), Wed signup delta, Wed paid conversions delta, recap thread engagement, Bluesky engagement.
- Note any press replies in a sidebar column.

### 5:00pm — Stop
- The launch day work is done. The launch week is half-done. Thursday is the top-questions carousel + press follow-up day; Friday is the IH cross-post day.
- Take the evening.

---

## End-of-launch retro template (write to `docs/kpi-log.md` Wed evening)

A 150-word retro, dry register, written before you close the laptop Wed.

```
## 2026-06-16 Show HN retro

What landed:
- [the post / thread / reply that performed best — and the one observable reason it did]
- [the audience surprise — who showed up that you didn't expect]

What didn't:
- [the angle that fell flat — the one that you thought would carry and didn't]
- [the comment-thread that went sideways — and what shape the question took]

What surprised:
- [the question that came up that you didn't have a canned answer for]
- [the audience signal you didn't expect — the demographic, the use case, the geography]

What changes for PH (Tue 06-23):
- [the post-body adjustment — e.g. lead with the wedding tier, not bury it]
- [the reply pattern adjustment — e.g. pre-write the SSO answer in the maker comment]
- [the rhythm adjustment — e.g. the 12pm lull is real, plan a press send for 12:30 not 1pm]
```

This 150-word retro becomes raw material for the Fri 06-19 IH cross-post (`docs/posts-week-6.md` Fri 06-19 9:00am section), which already has a structured "what worked / what broke" frame waiting for these notes.

---

## Quick-reference ledger — Show HN day

| Time (ET) | Action | Source |
|---|---|---|
| Mon 7:00pm | Sanity check + tab pre-stage | this file |
| Mon 7:30pm | Press inbox sweep (Gmail MCP) | this file |
| Mon 8:30pm | Final read of show-hn.md | docs/show-hn.md |
| Mon 9:00pm | Calendar holds (Google Calendar MCP) | this file |
| Tue 8:30am | Send press-reply drafts | Gmail MCP |
| Tue 9:00am | **POST · HN** | docs/show-hn.md |
| Tue 9:15am | Start HN replies (5–10 min cadence) | this file |
| Tue 9:30am | **POST · X 8-thread** | docs/posts-week-6.md Tue 9:30am |
| Tue 10:00am | **POST · Bluesky announce** | docs/posts-week-6.md Tue 10:00am |
| Tue 11:30am | Pulse check #1 → kpi-log | docs/kpi-log.md |
| Tue 12:00pm | Lunch | — |
| Tue 1:00pm | Press triage round 2 | Gmail MCP |
| Tue 2:00pm | Pulse check #2 → kpi-log | docs/kpi-log.md |
| Tue 3:00pm | West Coast reply wave | HN |
| Tue 3:30pm | Press follow-up send | Gmail MCP |
| Tue 4:00pm | Pulse check #3 → kpi-log | docs/kpi-log.md |
| Tue 6:00pm | Pulse check #4 → kpi-log | docs/kpi-log.md |
| Tue 8:00pm | Final pulse → kpi-log EOD | docs/kpi-log.md |
| Tue 9:00pm | Close | — |
| Wed 8:30am | Overnight comment review | HN |
| Wed 9:30am | Confirm numbers for recap thread | docs/kpi-log.md |
| Wed 10:00am | **POST · X recap 5-thread** | docs/posts-week-6.md Wed 10:00am |
| Wed 10:30am | Bluesky cross-post | this file |
| Wed 12:30pm | Press nudge email send (3 writers) | docs/posts-week-6.md Wed 12:00pm |
| Wed 2:00pm | YouTube Short capture | docs/posts-week-6.md Wed 3:00pm |
| Wed 3:00pm | Upload YouTube Short | YouTube |
| Wed 4:30pm | Update kpi-log Wed row | docs/kpi-log.md |
| Wed 5:00pm | Retro to kpi-log (150 words) | docs/kpi-log.md |

**Press contacts in scope:** rows 1, 2, 4, 8, 10, 12, 13 from `gtm-plan.md` §9 (Sarah Perez, Ivan Mehta, Luke Kawa, Vitaly Friedman, Kale Davis, Lenny Rachitsky, Ben Thompson). The W5 send went out Mon 06-08; replies are landing in the Tue 06-16 window.

**No new asset renders today.** The hero loop, the 90s walkthrough, the principles thread visuals — all shipped in W2–W4. Today is typing into a comments box and watching the dashboard.

**No paid spend today.** Show HN runs on organic. Paid resumed Mon 06-08 with the W5 budget; no day-of adjustment.

---

*Two assumed timing calls in this doc, flagged for the operator: (1) press replies start arriving Tue around 1pm ET — based on the W5 send being received Mon morning by US-based writers and acknowledged within 24–36h. (2) The midday HN lull (12–2pm ET) is treated as a known dip — replying through it is the play, not posting more. Both are revisable based on what the W5 press window actually looks like.*
