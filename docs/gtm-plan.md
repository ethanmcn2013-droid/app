# Tasks · Go-to-Market Plan (8 weeks)

**Window:** 2026-05-11 → 2026-07-05 · **Operator:** solo · **Budget:** $500 paid, $0 PR firm
**Live URL:** tasks-nu-hazel.vercel.app (custom domain landing 2026-05-07 — swap throughout when live)
**Handle pattern:** `@taskshq` (`@tasks` and `@thetaskapp` are taken; `tasksapp.bsky.social` belongs to a competitor)

---

## 1. Executive summary

Tasks ships in eight weeks across two launch beats — Show HN on Tuesday 2026-06-16 and Product Hunt on Tuesday 2026-06-23. Weeks 1–5 build foundation and audience: profiles up, one /changelog cycle cross-posted to HN or IH every Friday, daily organic on three channels (X, Bluesky, Product Hunt). Weeks 6–7 are the launch sprint. Week 8 is cooldown.

The pitch is the refusal list. Every channel leads with `/principles` — eight features Tasks will never ship — because that's the strongest piece of writing the product owns and because positioning by what you refuse is rarer than positioning by what you build.

Three competitors get named in copy: Notion ("Notion is a wiki. This is a task app."), ClickUp ("ClickUp ships everything. We ship a refusal list."), Asana ("$9.95 a workspace. Not $25 a seat."). Linear, Things, and Apple/Google/MS Tasks get ignored.

The video pipeline is ScreenStudio → Descript → Remotion → ElevenLabs (PVC clone) → DaVinci Resolve. After Effects and Premiere stay out — community MCPs are toy-grade. The $500 paid budget runs as $300 Reddit Ads on r/weddingplanning + $200 Instagram boost via a wedding micro-influencer. Everything else is organic.

---

## 2. Positioning one-pager

**Audience:** the 80% who don't work in tech. Wedding planners, college students, freelancers, trades, families, small studios, school admin, clinic managers, restaurant GMs.
**Anti-audience:** 200-person SaaS engineering orgs. Linear has them. Don't pick that fight.

**Three pillars:**
1. **No vocabulary tax** — no sprints, no epics, no story points, no learning curve.
2. **Per-workspace pricing** — never per-seat. The wedding fits the bride, groom, both moms, the DJ, the florist, for $9.95 flat.
3. **A published refusal list** — eight features Tasks will never ship, on a public URL, so the manifesto can be held to.

**Refusal list excerpt** (full at /principles): no per-seat pricing · no Gantt charts · no SSO as a marketing line · no AI agent that runs your tasks for you · no real-time push notifications · no story points / velocity / burndown / OKR · no paid template marketplace · no threaded comments-on-comments.

**Positioning matrix:**

| Competitor | Audience | Pricing | Voice | Where Tasks wins |
|---|---|---|---|---|
| **Notion** | Knowledge workers | Per-seat $10–$20 | "Second brain" | A task app that's actually a task app |
| **Linear** | 11–150 eng orgs | Per-seat $10–$16 | "Magic for makers" | Not for engineers — that's the pitch |
| **Asana** | 50+ ops teams | Per-seat $11–$25 | "Clarity at scale" | One workspace, $9.95 flat — not $25/head |
| **ClickUp** | SMBs that want one tool | Per-seat $7–$12 + AI | "Everything app" | Refusal list — we ship less on purpose |
| **Trello** | Small teams | Per-seat $5–$10 | "Approachable kanban" | Four real views, not just boards |
| **Monday** | Mid-market ops | Per-seat $9–$19, 3-min | "Work without limits" | No seat creep, no minimum |
| **Todoist / Things / TickTick** | Solo professionals | $5–$50 various | "Calm" / "Designed" / "Lite" | Workspaces, four views, collaboration |
| **Motion / Sunsama / Akiflow** | Solo planners | $19–$29 | "AI chief of staff" / "Calm" / "Command bar" | The AI doesn't run your day — you do |
| **Apple / Google / MS Tasks** | Free defaults | $0 | Silent / Institutional | Designed, cross-platform, real workspaces |

**Position-against headlines (use these verbatim):**
1. "Notion is a wiki. This is a task app."
2. "ClickUp ships everything. We ship a refusal list."
3. "$9.95 a workspace. Not $25 a seat."

**Position-as headlines:**
1. "The productivity app that ships with a refusal list."
2. "No sprints. No epics. No agents closing your tasks for you. The 80% of work that isn't software."

---

## 3. Asset checklist

| Asset | Status | Target | Tool |
|---|---|---|---|
| Custom domain pointed at Vercel | Pending purchase | 2026-05-07 | Vercel Project → Domains |
| `/app/*` redirect to `/sign-in` for unauthenticated | Open bug from deploy memo | 2026-05-08 | Clerk `signInUrl` env var |
| Sentry pager set for launch | Open | 2026-06-15 | Sentry alert rule |
| At least one published `/p/{slug}` workspace live | Open | 2026-05-15 | Existing publish flow |
| 30-second hero loop video (silent, autoplay) | Not started | 2026-05-22 | Remotion |
| 90-second feature walkthrough (voiceover) | Not started | 2026-06-01 | ScreenStudio + Descript + Remotion + ElevenLabs |
| 3-minute founder explainer (voiceover) | Not started | 2026-06-08 | Same pipeline + Resolve |
| ElevenLabs PVC voice clone | Not started | 2026-05-15 | ElevenLabs Creator |
| X profile + banner + pinned post | Not started | 2026-05-11 | Figma + frontend-design skill |
| Bluesky profile + banner + pinned post | Not started | 2026-05-11 | Figma + frontend-design skill |
| Product Hunt product page (draft) | Not started | 2026-06-15 | producthunt.com |
| OG / Twitter cards on all marketing routes | Already shipped (cycle F) | — | Existing `opengraph-image.tsx` |
| Press email list (15 contacts) | Drafted in §9 below | 2026-06-08 send | Gmail MCP `create_draft` |
| Reddit Ads creative (static `/p/` published wedding workspace) | Not started | 2026-05-29 | Figma + frontend-design |
| IG boost reel (30-sec planner using day-of run-of-show) | Not started | 2026-06-05 | ScreenStudio + Resolve |

---

## 4. Video plan

**Pipeline:** ScreenStudio (UI capture) → Descript (transcript-driven cut) → Remotion (motion overlays + titles) → ElevenLabs PVC clone (voiceover) → DaVinci Resolve free (composite + color + final export).

**Skipped on purpose:** After Effects and Premiere — community MCPs (Dakkshin/after-effects-mcp ~32 stars; mikechambers/adb-mcp ~527 stars but explicitly "proof of concept") are toy-grade. CleanShot X (no auto-zoom). Descript as primary editor (overkill).

**Time-to-first-cut:** 30s hero ~2–4 hrs · 90s walkthrough ~1 day · 3min founder ~1.5–2 days.

### 4a · 30-second hero loop (silent autoplay, on-page)

| # | Time | Screen action | On-screen text |
|---|---|---|---|
| 1 | 0:00–0:04 | Empty board snaps in, four lanes settle. Three cursors arrive (Chloe, David, Alex). | "Work that moves itself forward." |
| 2 | 0:04–0:10 | David carries t-101 to Doing. Alex pushes t-303 to Done — confetti at column header. Burndown sparkline ticks down. | "Real-time. No reload." |
| 3 | 0:10–0:15 | Chloe opens t-202, types a comment inline. Thread blooms beneath the card. | "Comments where the work is." |
| 4 | 0:15–0:21 | View tabs flick: Board → List → Timeline → Board. Same tasks, four lenses. Layout morphs, no fade. | "Four views. Same list." |
| 5 | 0:21–0:25 | AI nudge slides in: "Nudge David on creative review?" Chloe clicks Send. Toast: Sent. | "AI that surfaces. Never closes the loop for you." |
| 6 | 0:25–0:29 | Cursors drift to rest. Status bar: "Live · 3 collaborators." | "tasks-nu-hazel.vercel.app" |
| 7 | 0:29–0:30 | Board settles back to opening frame. Clean loop. | (matches frame 1) |

### 4b · 90-second feature walkthrough (voiceover, single-take feel)

| Time | Screen action | Voiceover | On-screen text |
|---|---|---|---|
| 0:00–0:08 | Landing hero. Cinematic demo running silently. | "Project management for the eighty percent who don't work in tech. No sprints. No epics. No learning curve." | "Tasks" |
| 0:08–0:20 | Board view. David carries a card from Todo to Doing; Alex moves one to Done; confetti, sparkline ticks. | "A board if you think in lanes. Cursors carry weight — when someone picks up a card, you can see them holding it." | "Board · momentum" |
| 0:20–0:35 | Tabs flick through List, Timeline, Calendar. Tasks morph in place. | "The same list, four ways. List for triage. Timeline for shape. Calendar for commitments. No re-entering anything — just a different lens." | "List · Timeline · Calendar" |
| 0:35–0:50 | Chloe opens t-202, types inline, posts. Thread sits flat under the card. | "Comments are flat, not threaded — because comments aren't the work. The tasks are." | "Threads stay where the task is" |
| 0:50–1:10 | AI nudge appears. "Nudge David on creative review?" Chloe sends. | "Tasks AI surfaces what's stuck — an idle card, a quiet review, a blocked dependency. It hands you a one-tap nudge. It will never auto-complete a task on your behalf. The dopamine of crossing it off is yours." | "AI that nudges. Not agents that finish." |
| 1:10–1:25 | Burndown sparkline pulses. Status bar: "Live · 3 collaborators." | "No dashboards tab. No analytics paywall. The signals live inside the work." | "Burndown · without the dashboard" |
| 1:25–1:30 | Pull back to landing URL. | "Tasks. Per workspace, not per seat." | "tasks-nu-hazel.vercel.app" |

### 4c · 3-minute founder explainer (voiceover-over-screen, no face)

**Act 1 — The Audience (0:00–1:00)**
*B-roll: cluttered Google Sheet zooming on a "Final-FINAL-v3" wedding tab. College student's iPad with sticky notes spilling off it. A freelancer's split monitor — Trello, Notion, Apple Notes, all stale. A mom at a kitchen table with a printed seating chart.*

> "There's a college student writing a thesis in a Google Doc, with her advisor's feedback in a separate email thread, and her chapter deadlines on a Post-it stuck to her laptop. There's a freelance developer juggling four clients in four different tools, none of which talk to each other. There's a wedding planner running a two-hundred-guest event from a spreadsheet with seventeen tabs. And there's a mom organizing the school auction the same way.
> None of these people work in tech. None of them have a project manager. None of them are going to learn the word *epic*. And none of the tools built for them, by us, in the last twenty years, were actually built for them."

**On-screen text (0:50):** "Project management for the 80% who don't work in tech."

**Act 2 — The Refusal List (1:00–2:00)**
*B-roll: /principles page scrolling slowly. Each refusal card surfaces on cue.*

> "So we wrote down what we refuse to build. Eight features, on a public URL.
> No per-seat pricing. Inviting a collaborator should not be a budget decision. Add the whole study group, both moms, the DJ. Same price.
> No Gantt charts. No story points. No velocity. No burndown reviews. The vocabulary other tools spent twenty years training people in — sprint planning, ticket triage, OKR alignment — we cut it. All of it.
> No AI agent that runs your tasks for you. The dopamine of crossing it off is not outsourceable.
> No real-time push notifications. No inbox red-dot. If a tool's strategy is winning more of your attention, the tool isn't on your side.
> Every one of these stays a no. We publish the list so you can hold us to it."

**On-screen text (1:55):** "What we refuse, stays refused."

**Act 3 — The Answer (2:00–3:00)**
*B-roll: cinematic demo playing. View morph cycle — Board, List, Timeline, Calendar. Pricing page dissolve.*

> "What's left after you cut the vocabulary is a list. A board if you think in lanes. A list if you think in lines. A timeline if you think in shape. A calendar if you think in days. Same tasks, four lenses, no re-entering anything.
> Real-time when it matters — cursors carry weight, comments stream in flat. Plain-English dates, so you can write *next Thursday* and the app knows what you mean.
> And we charge per workspace, never per seat. Because a wedding planner shouldn't pay more to invite the florist. That's the proof we mean it."

**On-screen text (2:50):** "tasks-nu-hazel.vercel.app"

*Hold on URL. Cut.*

---

## 5. Voice + tool stack

### Voice
- **Primary: ElevenLabs Creator ($22/mo)** — best naturalism for a designer-narrating-his-own-product tone. PVC clone of own voice unlocks "this is the founder reading it himself." [elevenlabs.io/pricing](https://elevenlabs.io/pricing/api)
- **Backup: Hume Octave 2 ($14/mo)** — steerability via prompt ("dry, slightly bored, observational") beats every other model when energy-bro defaults are wrong. [hume.ai/pricing](https://www.hume.ai/pricing)
- **Skip:** Murf, Wellsaid (corporate-narrator voice), PlayHT (podcast bias), Cartesia (tuned for realtime agents, not narration), OpenAI TTS (cheap fallback only — $0.015/min — but no clone).

### Production stack (final picks)
- **UI capture:** ScreenStudio — auto-zoom, cursor smoothing, padded backgrounds, cinematic defaults. [screen.studio](https://screen.studio)
- **Transcript-driven cut:** Descript — for the 3-min founder explainer specifically. Scalpel only, not the whole pipeline.
- **Motion overlays + titles + 30s hero loop:** Remotion — already in stack (~/Projects/approvals-motion), 90s @ 1080p30 renders in ~2–6 min on Apple Silicon.
- **Voiceover:** ElevenLabs PVC clone (Creator tier).
- **Final composite + color + audio mix + export:** DaVinci Resolve free — covers the 5% Remotion can't.

---

## 6. Social setup

**Launch trio:** X / Twitter, Bluesky, Product Hunt. Defer LinkedIn, Threads, YouTube, TikTok, Instagram, Mastodon — reserve handles now, activate after first 1k signups + video assets exist.

### X — `@taskshq`
**Bio (160 char):** "Project management without the vocabulary tax. Four views, per-workspace pricing, a refusal list. For the 80% who don't work in tech. — tasks-nu-hazel.vercel.app"
**Banner concept:** strikethrough manifesto rendered as wallpaper — *sprint planning, story points, burndown* crossed out; "You don't need a vocabulary. You need a list." standing.
**Pinned post:** "We published a list of eight features we'll never ship. /principles — the other roadmap."
**Cadence:** 5 posts/week. Mon 9:15a, Tue 11:40a, Wed 8:50a, Thu 2:10p, Fri 10:05a ET.

### Bluesky — `taskshq.bsky.social`
**Bio (256 char):** "Project management for the 80% who don't work in tech. Four views — board, list, timeline, calendar. Per-workspace pricing. A short list of features we'll never ship. Built solo, in public. tasks-nu-hazel.vercel.app"
**Banner concept:** four view icons in a 2×2 grid, hand-drawn weight, on the studio off-white from /about.
**Pinned post:** "Most roadmaps are a list of yeses. We published the other list — eight features we'll never ship. /principles."
**Cadence:** 4 posts/week. Tue 10:00a, Wed 1:30p, Thu 9:20a, Fri 12:00p ET.

### Product Hunt — `producthunt.com/products/taskshq`
**Tagline:** "Project management without the vocabulary tax."
**Description:** "Four views — board, list, timeline, calendar. Per-workspace pricing, not per-seat. A published list of eight features we'll never ship. Built for wedding planners, students, freelancers, trades, families — the 80% who don't work in tech."
**Gallery:** strikethrough hero (sprints / epics / burndowns crossed out, "a list" standing) + four-view montage + refusal list as third frame.
**First-comment:** "Hey — solo founder. The shortest pitch is the refusal list: per-workspace pricing, no Gantt, no SSO upsell, no AI agent that runs your tasks for you, no per-seat anything. Full list at /principles. Happy to answer anything."

### Week 1 content list (verbatim posts, no emojis)

**X:**
1. "Per-workspace pricing, not per-seat. Inviting a collaborator shouldn't be a budget decision. The math at /pricing."
2. "We published a refusal list. Eight features we'll never ship. /principles. Most roadmaps are a list of yeses — this is the other one."
3. "No AI agent that runs your tasks. The dopamine of crossing it off is not outsourceable."
4. "Wedding planner, three months out. RSVPs, seating, vows, the small fires before the big day. /templates."
5. "Cycle 22 shipped five things at once — iOS share-sheet, cross-workspace search, share-card PNG, remix, contacts. /changelog."
6. "No SSO as a marketing line. Companies that sell SSO sell fear. /principles."
7. "Four views. Same data. Board, list, timeline, calendar. The tool fades, the work stays."

**Bluesky:**
1. "Sprint planning. Epic refinement. Ticket triage. Story points. Burndown reviews. None of that is true. /about."
2. "Final paper push — research, outline, draft, edit, submit, without the 4am panic. /templates/final-paper-push."
3. "Cycle 24 shipped a B-tier delight wave — eight features, sprint close. 36 dispatches, 0 broken builds. /changelog."
4. "No paid template marketplace. Templates are oxygen — the moment they cost money they become scarce. /templates is free, all twelve."
5. "For the trades: jobsite punchlist, day-of run-of-show, tax season. Same four views. /for/trades."

---

## 7. 8-week content calendar

Posting times in ET. Saturdays REST; Sundays LIGHT or REST.

### Week 1 — Foundation (May 11–17)
| Date | Day | Channel | Format | Source | CTA | ET |
|---|---|---|---|---|---|---|
| 05-11 | Mon | X | Profile launch + pinned thread (5 posts) | /principles | /principles | 9am |
| 05-11 | Mon | Bluesky | Profile launch + pinned post | /about | /about | 11am |
| 05-12 | Tue | X | Single — "no AI summary, no inbox, no streaks." | /principles | /principles | 9am |
| 05-12 | Tue | Bluesky | Strikethrough manifesto excerpt | /about | /about | 10am |
| 05-13 | Wed | X | Thread (4) — domain packs explained | cycle 23 + DOMAINS | /for | 9am |
| 05-13 | Wed | Bluesky | Cycle 22 narrative (1-paragraph excerpt) | cycle 22 | /changelog | 1:30pm |
| 05-14 | Thu | X | Thread (4) — auto-running showcase explained | cycle 19 demo loop | / | 9am |
| 05-14 | Thu | Bluesky | Wedding template post | /templates/wedding | /templates | 9:20am |
| 05-15 | Fri | HN | Cross-post cycle 22 ("how we shipped 5 features in one cycle") | docs/syndication.md HN template | /changelog | 9am |
| 05-15 | Fri | X | Hook + HN link | — | HN URL | 10am |
| 05-15 | Fri | Bluesky | Refusal list pull-quote | /principles | /principles | 12pm |
| 05-16 | Sat | — | **REST** | — | — | — |
| 05-17 | Sun | X | LIGHT — calendar-view screenshot | cycle 18 | /app | 11am |

### Week 2 — Soft launch (May 18–24)
| Date | Day | Channel | Format | Source | CTA | ET |
|---|---|---|---|---|---|---|
| 05-18 | Mon | X | Thread (5) — "what is a workspace" | /pricing | /pricing | 9:15am |
| 05-19 | Tue | X | Thread (7) — wedding workspace anatomy | /for/weddings | /for/weddings | 9am |
| 05-19 | Tue | Bluesky | Single — "comments aren't the work, the tasks are" | /principles | /principles | 10am |
| 05-19 | Tue | r/SideProject | Soft-launch post | /pricing essay | / | 8pm |
| 05-20 | Wed | YouTube | Upload 30-sec hero loop (silent) — channel launch | hero loop | / | 3pm |
| 05-20 | Wed | Bluesky | Single — view morph GIF | cycle 1 FLIP | /app | 1:30pm |
| 05-21 | Thu | X | Thread (5) — student template breakdown | /templates/student | /templates | 9am |
| 05-21 | Thu | Bluesky | "designed, not assembled" — Things-style restraint | /about | /about | 9:20am |
| 05-22 | Fri | IH | Cross-post: per-workspace pricing essay | docs/syndication.md IH template | /pricing | 9am |
| 05-22 | Fri | X | Hook + IH link | — | IH URL | 10am |
| 05-22 | Fri | Bluesky | "the 80% who don't work in tech" pull-quote | /about | /about | 12pm |
| 05-23 | Sat | — | **REST** | — | — | — |
| 05-24 | Sun | X | LIGHT — observational one-liner | /about | / | 11am |

### Week 3 — Audience build (May 25–31)
| Date | Day | Channel | Format | Source | CTA | ET |
|---|---|---|---|---|---|---|
| 05-25 | Mon | X | Thread (8) — strikethrough manifesto annotated | /about | /about | 9:15am |
| 05-26 | Tue | X | Thread (7) — cycle 22 ("5 features, 1 cycle") | cycle 22 | /changelog | 9am |
| 05-26 | Tue | Designer News | Submit /principles as a curated link | /principles | /principles | 10am |
| 05-26 | Tue | Bluesky | Cycle 22 single | cycle 22 | /changelog | 10am |
| 05-27 | Wed | YouTube | Upload 90s feature walkthrough (voiceover) | walkthrough | /app | 3pm |
| 05-27 | Wed | Bluesky | Single — pricing math, $9.95 flat | /pricing | /pricing | 1:30pm |
| 05-28 | Thu | X | Thread (4) — trades vertical, jobsite checklists | /for/trades | /for/trades | 10am |
| 05-28 | Thu | Bluesky | "no paid template marketplace" | /principles | /templates | 9:20am |
| 05-29 | Fri | HN | Cross-post cycle 21 (Studio tier — operator pricing) | cycle 21 | /pricing | 9am |
| 05-29 | Fri | Sidebar.io | Submit /principles | /principles | /principles | 10am |
| 05-29 | Fri | Bluesky | Refresh — refusal list short form | /principles | /principles | 12pm |
| 05-30 | Sat | — | **REST** | — | — | — |
| 05-31 | Sun | X | LIGHT — timeline view screenshot | cycle 12 | /app | 11am |

### Week 4 — Audience build + paid test 1 (Jun 1–7)
| Date | Day | Channel | Format | Source | CTA | ET |
|---|---|---|---|---|---|---|
| 06-01 | Mon | X | Thread (5) — why 12 templates not 1 | /templates | /templates | 9:15am |
| **06-01** | **Mon** | **Reddit Ads (paid $300, runs 7 days)** | Promoted post in r/weddingplanning + r/wedding | wedding 3-month checklist + /p/ wedding workspace | /for/weddings + /templates/wedding | 8am launch |
| 06-02 | Tue | X | Thread (6) — cycle 14 (CSV import) story | cycle 14 | /changelog | 9am |
| 06-02 | Tue | r/SaaS | Build-in-public: per-workspace pricing | docs/syndication.md IH template | /pricing | 8am |
| 06-02 | Tue | Bluesky | "Studio tier — operator pricing" — single | cycle 21 | /pricing | 10am |
| 06-03 | Wed | YouTube | Short — board view in 60 sec | cycle 9 | /app | 3pm |
| 06-03 | Wed | Bluesky | Single — "what 22 cycles taught us about scope" | cycle 22 | /changelog | 1:30pm |
| 06-04 | Thu | X | Thread (5) — student template, finals week | /templates/final-paper-push | /templates | 9am |
| 06-04 | Thu | Bluesky | Calendar view single | cycle 18 | /app | 9:20am |
| 06-05 | Fri | IH | Cross-post cycle 20 (publishable workspaces) | cycle 20 | /templates | 9am |
| 06-05 | Fri | Sidebar.io / Refind | Re-submit /principles essay | /principles | /principles | 10am |
| 06-05 | Fri | Bluesky | Closing post for Reddit Ad cycle | /pricing | /pricing | 12pm |
| 06-06 | Sat | — | **REST** | — | — | — |
| 06-07 | Sun | Bluesky | LIGHT — pull quote slide | /about | /about | 9am |

### Week 5 — Pre-launch warm-up + paid test 2 (Jun 8–14)
| Date | Day | Channel | Format | Source | CTA | ET |
|---|---|---|---|---|---|---|
| **06-08** | **Mon W5** | **Press emails: send 8 personal pitches** (rows 1, 2, 4, 8, 10, 12, 13 in §9) | Email via Gmail MCP | /about + /principles | tasks-nu-hazel | 11am |
| 06-08 | Mon | X | Thread (6) — "we're launching next week. here's what we cut." | /principles | / | 9:15am |
| **06-08** | **Mon** | **IG boost (paid $200, runs 7 days)** | 30s reel: planner using day-of run-of-show on phone | Existing template | /for/weddings | Coordinate w/ creator |
| 06-09 | Tue | Press emails: send 4 newsletter / curation (rows 3, 5, 11, 14) | Email | / | / | 11am |
| 06-09 | Tue | X | Thread (8) — full product tour, all 4 views | full demo | /app | 9am |
| 06-09 | Tue | r/freelance | **Comment-only** — jump on per-client juggling threads, mention Studio tier | /pricing | /pricing | 7am |
| 06-09 | Tue | Bluesky | "what I'd cut" — rare-feature observation | /principles | /principles | 10am |
| 06-10 | Wed | Sidebar.io + Designer News submit | Web forms | / | / | 10am |
| 06-10 | Wed | YouTube | Upload 3-min founder explainer | full script | / | 3pm |
| 06-10 | Wed | Bluesky | "Show HN drops next Tuesday" tease | — | / | 1:30pm |
| 06-11 | Thu | X | Thread (5) — wedding workspace deep-dive | /for/weddings | /for/weddings | 10am |
| 06-11 | Thu | Refind | Submit /about | /about | /about | 12pm |
| 06-11 | Thu | Bluesky | Refusal list — short-form repost | /principles | /principles | 9:20am |
| 06-12 | Fri | HN | Cross-post cycle 23 (distribution activation — meta angle) | cycle 23 | /changelog | 9am |
| 06-12 | Fri | X | Tease — refusal list thread coming | /principles | / | 10am |
| 06-12 | Fri | Bluesky | Refresh post + HN link | / | HN URL | 12pm |
| 06-13 | Sat | — | **REST** — final QA on `/app/*` redirect | — | — | — |
| 06-14 | Sun | Sun pre-launch | Schedule Show HN copy; warm-DM 5 HN regulars (no upvote ring) | DM | / | 6pm |
| 06-14 | Sun | X | LIGHT — "T-2" teaser, one screenshot | / | / | 8pm |

### Week 6 — Show HN sprint + press follow-up (Jun 15–21)
| Date | Day | Channel | Format | Source | CTA | ET |
|---|---|---|---|---|---|---|
| 06-15 | Mon W6 | X | Thread (4) — "tomorrow we Show HN" | docs/show-hn.md | / | 9am |
| 06-15 | Mon | Final dry-run; reply to press replies | — | — | — | — |
| **06-16** | **Tue** | **HN Show HN** | **Launch post** | docs/show-hn.md | / | **9:00am** |
| 06-16 | Tue | X | Show HN narrative thread (8) — 30 min after HN | docs/show-hn.md | HN URL | 9:30am |
| 06-16 | Tue | Bluesky | Show HN announce + first-comment excerpt | docs/show-hn.md | HN URL | 10am |
| 06-16 | Tue | LinkedIn | (If opened by now) Show HN founder note | /about | / | 11am |
| 06-17 | Wed | X | Recap thread (5) — "Show HN, 24 hours in" | HN comments | / | 10am |
| 06-17 | Wed | Press | Nudge 3 newsletter writers w/ HN data | Email | / | 12pm |
| 06-17 | Wed | YouTube | Short reaction recap — Show HN comments | HN thread | /changelog | 3pm |
| 06-18 | Thu | LinkedIn / X | Carousel / thread — top 5 questions from HN, answered | HN comments | /principles | 10am |
| 06-18 | Thu | Press | Dense Discovery / Sherwood / Stratechery follow-ups w/ HN numbers | Email | / | 12pm |
| 06-19 | Fri | IH | Cross-post: "what Show HN taught us in 72 hours" | docs/show-hn.md + HN | /changelog | 9am |
| 06-19 | Fri | X | Refusal list full thread — designed to travel | /principles | /principles | 11am |
| 06-19 | Fri | Bluesky | Single — IH link | / | IH URL | 12pm |
| 06-20 | Sat | — | **REST** (mandatory PH eve) | — | — | — |
| 06-21 | Sun | PH back-channel | Brief 8 hunter-friends (no upvote ring) | DM | PH URL | 6pm |
| 06-21 | Sun | X | LIGHT — "tomorrow: Product Hunt" | / | / | 8pm |

### Week 7 — Product Hunt sprint (Jun 22–28)
| Date | Day | Channel | Format | Source | CTA | ET |
|---|---|---|---|---|---|---|
| 06-22 | Mon W7 | X | Thread (5) — "PH tomorrow at 3:01am ET" | / | / | 9am |
| 06-22 | Mon | Bluesky | PH heads-up post | / | / | 10am |
| **06-23** | **Tue** | **Product Hunt** | **Launch** | / + demo loop | PH URL | **3:01am** |
| 06-23 | Tue | X | Launch thread (10) at 7am ET; second push 12pm; third 5pm | PH URL | PH URL | 7am/12pm/5pm |
| 06-23 | Tue | Bluesky | Launch thread (4) | / | PH URL | 8am |
| 06-23 | Tue | r/SideProject | Launch post | / | PH URL | 8am |
| **06-24** | **Wed** | **Indie Hackers** | **Launch milestone post** | docs/show-hn.md + PH stats | /pricing | 9am |
| 06-24 | Wed | YouTube | "PH launch day, what actually happened" | PH thread | / | 3pm |
| 06-24 | Wed | X | Recap thread (6) — PH numbers + lessons | PH stats | / | 10am |
| 06-25 | Thu | LinkedIn / X | "launch week by the numbers" | HN+PH+IH metrics | /changelog | 10am |
| 06-25 | Thu | Press | Thank-you to every writer who covered | Email | / | 12pm |
| 06-26 | Fri | X | Thank-you single, link to /changelog | /changelog | /changelog | 11am |
| 06-26 | Fri | Bluesky | Closing post | /changelog | / | 12pm |
| 06-27 | Sat | — | **REST** | — | — | — |
| 06-28 | Sun | — | **REST** (post-launch recovery) | — | — | — |

### Week 8 — Cooldown + retention (Jun 29 – Jul 5)
| Date | Day | Channel | Format | Source | CTA | ET |
|---|---|---|---|---|---|---|
| 06-29 | Mon | LinkedIn / X | Long-form retro — "8 weeks, 2 launches, what held" | full calendar | /changelog | 11am |
| 06-30 | Tue | X | Thread (5) — "for the new arrivals: start here" | /templates | /templates | 9am |
| 06-30 | Tue | r/productivity | Long discussion — refusal list, post-launch | /principles | /principles | 8pm |
| 07-01 | Wed | YouTube | 6-min — full /about manifesto read | /about | /about | 3pm |
| 07-01 | Wed | Bluesky | Top 5 templates, one-line each | /templates | /templates | 1:30pm |
| 07-02 | Thu | X | Thread (4) — trades vertical retention | /for/trades | /for/trades | 10am |
| 07-03 | Fri | IH | Launch-week pricing-conversion data | post-launch metrics | /pricing | 9am |
| 07-03 | Fri | X | Single — IH link, observation about pre-July-4 quiet | — | IH URL | 10am |
| 07-04 | Sat | — | **REST** (Independence Day, also Sat) | — | — | — |
| 07-05 | Sun | X | LIGHT — closing line, "back Monday" | / | / | 8pm |

**Cycle cross-post rotation (alternates HN/IH each Friday per docs/syndication.md):**
W1 HN c22 · W2 IH pricing · W3 HN c21 · W4 IH c20 · W5 HN c23 · W6 IH show-hn-recap · W7 — (PH week, skip) · W8 IH pricing-data.

---

## 8. Channel-by-channel acquisition plan

### Organic, ranked by ROI for this product

**1. Hacker News — Show HN.** Draft locked at `docs/show-hn.md`. Tue 2026-06-16, 9:00am ET. Title: *"Show HN: We rebuilt project management for the 80% who don't work in tech."* Lead with strikethrough manifesto. Founder live in comments first 90 min, 5–10 min reply gaps. **Pre-flight:** /principles 200, /changelog current, /pricing all 5 tiers, ≥1 published `/p/{slug}`, Sentry pager set, `/app/*` redirect bug fixed.

**2. Indie Hackers.** Per-workspace pricing essay Friday W6 (`docs/syndication.md` IH template). Foreground commercial honesty. End with a question.

**3. Product Hunt — Tue 2026-06-23, 3:01am ET.** Hunter: line up Chris Messina or a wedding-vertical maker by W5. Pre-stage 5 hunter-friends from each audience (wedding, student, freelance, trades, family). Reply within 15 min of every comment. Maker comments staggered Tue 7am / 11:30am / 3pm; Wed 9am; Thu 10am.

**4. Reddit (rules-aware).**

| Sub | Rule | Angle |
|---|---|---|
| r/SideProject | Self-promo encouraged; live link + GIF + one honest lesson | "Built a productivity app where inviting people doesn't cost extra — pricing math that broke" |
| r/weddingplanning | 250k members; standard 90/10; lead with utility | Share `/templates/wedding-3-month-countdown` as free planning checklist, mention app at bottom |
| r/Notion | Templates allowed; alternatives discussion welcome | "I left Notion for a smaller tool — what I lost and gained" |
| r/freelance | **Strict — service/promo posts removed** | **Comment-only** strategy: jump on per-client juggling threads, mention Studio tier when on-topic |
| r/productivity | 90/10 strict, mods active | Manifesto post: *"What if a tool refused to add Gantt?"* — link `/principles` |
| r/Entrepreneur | **Self-promo Saturdays only** | Saturday post with full pricing breakdown |

**5. Niche communities (verified active 2025/26).** Weddingbee Boards, College Confidential Forums, r/GetStudying, r/Construction, A Practical Wedding (pitch as guest essay; community newsletter only). **Skip TheKnot forums** — low engagement vs WeddingWire.

**6. Designer / dev surfaces.** Submit to Sidebar.io (W3 Tue), Designer News (W3 Tue), Hacker Newsletter (email Kale Davis W5), Refind (W5 Thu), Pocket Hits (W5 Fri), Dense Discovery (W5 Tue — Kai Brach, manifesto angle).

**7. SEO via /templates — top 5 long-tail targets.**
- `wedding 3-month checklist template` (peaks May–Sept — current peak)
- `freelancer tax season checklist` (peaks Jan–Apr — queue Q1 2027)
- `apartment move checklist template`
- `final paper sprint plan`
- `new client onboarding checklist`

**8. Partnership categories beyond venues.**
- **University student newsletters / orgs:** Morning Brew *Sidekick*, *Daily Pennsylvanian*, *Stanford Daily*, campus RA programs. Offer free Pro for `.edu` (already built, cycle 23).
- **Freelance dev directories / newsletters:** Indie Hackers Sponsor a Newsletter, *Bytes.dev*, *ClientJoy* community, *Freelancing.tv*. Offer Studio tier 60-day trial codes.

### Paid experiments — $500 across W4–W6

**Experiment 1 — Reddit Ads on r/weddingplanning ($300, W4 Mon → W4 Sun).**
- Targeting: r/weddingplanning + r/wedding + interest "wedding planning," US, 25–38F.
- Creative: static image of `/p/` published wedding workspace (blush serif).
- Copy: "$79 once. Fits the bride, groom, both moms, and the DJ."
- KPI: ≥40 free signups + ≥3 $79 Wedding purchases.
- **Kill criteria:** CPA on free signup >$5 by day 4 — pause and reallocate. Zero $79 conversions by day 7 — pause.

**Experiment 2 — Instagram boosted post via wedding micro-influencer ($200, W5 Mon → W5 Sun).**
- Partner: 1 micro-influencer 15–50k followers (e.g., @hellobrennae, @theweddingplanneracademy, or any vetted planner from `docs/venue-outreach.md` Rolodex).
- Creative: 30-sec reel of planner using day-of run-of-show template on phone.
- Split: $150 partner fee + $50 boost.
- KPI: ≥1,000 link clicks, ≥25 free signups.
- **Kill criteria:** <200 clicks in 72h — don't renew. <5 signups from 1k clicks — landing page issue, fix before re-running.

**Skip:** Google Ads (Notion/Asana CPCs uncompetitive at this scale), X promoted posts (audience mismatch for non-tech verticals), LinkedIn promoted (no ops persona overlap).

---

## 9. Press list + 14-day launch sequence

### Press list (15 contacts)

| # | Name | Outlet | Beat | Contact | Angle |
|---|---|---|---|---|---|
| 1 | Sarah Perez | TechCrunch | Consumer apps / productivity | @sarahintampa on X; sarahp@techcrunch.com | Per-workspace pricing breaks the per-seat SaaS default — small teams pay once, not per head. |
| 2 | Ivan Mehta | TechCrunch | Global consumer tech | @indianidle on X; tips form at techcrunch.com/got-a-tip | Productivity built for the 80% outside SF — restaurants, clinics, schools. |
| 3 | David Pierce | The Verge / Installer | Consumer software, link-driven | david@theverge.com; @pierce on X; @imdavidpierce on Threads | The "refusal list" — what Tasks deliberately doesn't ship — is an Installer-sized story. |
| 4 | Luke Kawa | Sherwood News | Markets, business of tech | luke@sherwoodmedia.com (verify via masthead); @LJKawa on X | Per-workspace pricing as a quiet rejection of the per-seat unit-economics model. |
| 5 | Kai Brach | Dense Discovery | Design-led tools, indie software | Submission form at densediscovery.com (footer); @kaibrach on Mastodon | Four views, opinionated defaults, refusal list — a tool with a position, not a feature list. |
| 6 | Sacha Greif / Fabricio Teixeira | Sidebar.io | Curated daily design links | Submit at sidebar.io (sign-in required); @sachagreif and @fabricioteixeira on X | The /pricing page itself — type, restraint, one number. |
| 7 | Designer News | Designer News (DN) | Designer-curated link board | Post directly at news.layervault.com (community-moderated) | Show DN: a productivity app designed like a design tool. |
| 8 | Vitaly Friedman | Smashing Magazine | Web design / UX craft | vitaly@smashingmagazine.com; @smashingmag on X | Case study angle — building four views without a settings page. |
| 9 | Refind editors | Refind | Trending link curation | Auto-curated from URL signal; submit by getting traction | Drive Show HN momentum into Refind's algorithmic surface. |
| 10 | Kale Davis | Hacker Newsletter | Weekly HN curation | kale@hey.com; @kale on X; reply-to any issue | Show HN piece + the refusal list — both already match HN's taste. |
| 11 | Channing & Courtland Allen | Indie Hackers | Solo founders, bootstrapped | @csallen and @ChanningAllen on X; pitch via indiehackers.com/contact | Solo founder, no funding, per-workspace pricing — exactly the IH story shape. |
| 12 | Lenny Rachitsky | Lenny's Newsletter | Product / growth / career | @lennysan on X; lenny@lennysnewsletter.com | Pricing-page-as-deck is a teardown post he's written variants of three times. |
| 13 | Ben Thompson | Stratechery | Strategy, business of tech | ben@stratechery.com; @benthompson on X | Per-workspace pricing as aggregation-theory counter-move — pricing the workspace, not the user. |
| 14 | Aaron O'Leary | Product Hunt newsletter | PH daily/weekly digest | editorial@producthunt.co; hello@producthunt.com | Pre-flag the 6/23 launch one week early; offer the refusal list as the hook. |
| 15 | Justine Moore | a16z consumer | Productivity / consumer | @venturetwins on X; justine@a16z.com | Productivity for the 80% — a category a16z consumer has flagged but few are building for. |

### 14-day launch Gantt

| Date | Day | Action | Channel |
|---|---|---|---|
| 2026-06-08 | Mon W5 | **Send 8 personal press emails (rows 1, 2, 4, 8, 10, 12, 13, plus 3)** — T-7 to Show HN. One sender, no BCC. | Email |
| 2026-06-09 | Tue W5 | Send 4 newsletter / curation emails (rows 5, 11, 14, 15) | Email |
| 2026-06-10 | Wed W5 | Submit to Sidebar.io + Designer News | Web forms |
| 2026-06-11 | Thu W5 | Soft post on X — single screenshot of /pricing | X / Bluesky |
| 2026-06-12 | Fri W5 | Tease refusal-list thread; cross-post cycle 23 to HN | X / Bluesky / HN |
| 2026-06-13 | Sat W5 | Final QA on tasks-nu-hazel.vercel.app / `/app/*` redirect | Product |
| 2026-06-14 | Sun W5 | Schedule Show HN copy; warm-DM 5 HN regulars (no upvote ring) | DM |
| **2026-06-15** | **Mon W6** | Final dry-run; reply to press replies; hold all social | Email |
| **2026-06-16** | **Tue W6** | **Show HN at 9:00am ET. In comments all day. X link 30 min after submission.** | HN |
| 2026-06-17 | Wed W6 | Recap Show HN thread on X; nudge 3 newsletter writers with HN data | X + Email |
| 2026-06-18 | Thu W6 | Dense Discovery / Sidebar follow-up; pitch Sherwood + Stratechery again w/ HN numbers | Email |
| 2026-06-19 | Fri W6 | Post refusal list full thread (designed to travel) | X / Bluesky |
| 2026-06-20 | Sat W6 | Off | — |
| 2026-06-21 | Sun W6 | Schedule PH assets; brief 8 hunter-friends back-channel | DM |
| **2026-06-23** | **Tue W7** | **Product Hunt at 3:01am PT (= 6:01am ET).** Reply to every comment within 15 min. | PH |
| **2026-06-24** | **Wed W7** | **Indie Hackers post: "Solo, no funding, per-workspace pricing — what happened."** Link PH + HN data. | IH |
| 2026-06-25 | Thu W7 | Round-up post on X w/ all numbers; thank-you email to every writer who covered | X + Email |
| 2026-06-26 | Fri W7 | Cooldown begins. Ship one small thing visible to first wave. | Product |

### Press email template — Lenny Rachitsky (118 words, in voice)

**Subject:** the productivity app for the 80%

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

---

## 10. KPI dashboard (5 metrics)

| Metric | Source | Target by 2026-07-05 | Why this one |
|---|---|---|---|
| **Free signups (cumulative)** | PostHog `signup_completed` event (or Clerk webhook → Postgres) | 1,000 | Top of funnel. The number that proves distribution worked. |
| **Paid conversions (cumulative)** | Stripe dashboard / `entitlements` table | 50 | Proof the pricing page closes. Mix matters: target ≥10 Wedding $79, ≥30 Pro/Studio. |
| **Show HN front-page time** | news.ycombinator.com (manual log on launch day) | ≥6 hours top-30 | Single biggest organic acquisition lever in the 8 weeks. |
| **Product Hunt rank EOD** | producthunt.com/products/taskshq | Top 5 of the day | Sets the "social proof" backdrop for press follow-ups. |
| **`/p/{slug}` published workspaces** | Postgres `share_links` count | 100 | Every published workspace is a marketing asset (cycle 20 thesis). The leading indicator of organic SEO compounding. |

**Don't track:** social impressions, follower count, email open rates. Vanity metrics do not move launch decisions.

**Read cadence:** Monday morning standup-with-yourself. Write the five numbers in `docs/kpi-log.md` once per week.

---

## 11. Appendix · Claude Code skills, MCPs, and agents to run the plan

### The 5 highest-leverage Claude Code patterns for this plan

| # | Tool | Use for | Invocation |
|---|---|---|---|
| 1 | **`frontend-design` skill** | OG cards, pinned-post images, banner concepts, Reddit Ad creative, IG reel composition | `Skill: frontend-design` with brief: "1200×630 OG card, dry voice, no emojis" |
| 2 | **Playwright MCP** | Pixel-perfect product screenshots, marketing-page QA, before/after comparison strips, competitor scraping | `mcp__plugin_playwright_playwright__browser_navigate` → `browser_take_screenshot` |
| 3 | **Vercel skills (`deploy`, `vercel-agent`, `runtime-cache`)** | Marketing-page Core Web Vitals (SEO ranking), landing-page A/B experiments, pre-launch perf review | `Skill: vercel:deploy` for prod pushes; `Skill: vercel:vercel-agent` for PR-level perf |
| 4 | **Gmail MCP + drafts workflow** | 15 press emails, venue follow-ups (Lamb's Hill + Abbey Inn from `docs/venue-outreach.md`), influencer DMs | `mcp__claude_ai_Gmail__create_draft` → `mcp__claude_ai_Gmail__search_threads` for reply tracking |
| 5 | **Google Calendar MCP + `schedule` skill** | Show HN Tue 6/16 9am ET hold; PH Tue 6/23 3:01am PT hold; weekly content cadence; recurring "review KPI dashboard" Monday standup | `Skill: schedule` for cron remote agents; `mcp__claude_ai_Google_Calendar__create_event` for holds |

### Verified-real MCPs available (for jobs that aren't yet MCP-served)

| Service | MCP | Source |
|---|---|---|
| ElevenLabs (voice) | Official | github.com/elevenlabs/elevenlabs-mcp |
| PostHog (analytics) | Official | github.com/PostHog/mcp |
| Stripe (revenue) | Official | docs.stripe.com/mcp |
| Notion | Official | github.com/makenotion/notion-mcp-server |
| Resend (email) | Official | github.com/resend/mcp-send-email |
| X / Twitter | Community | github.com/EnesCinr/twitter-mcp · github.com/crazyrabbitLTC/mcp-twitter-server |
| Bluesky / atproto | Community | github.com/cameronrye/atproto-mcp · github.com/brianellin/bsky-mcp-server |
| Buffer | Community | github.com/jakemeany523/buffer-mcp |
| Hypefury | Vendor | github.com/Hypefury/hypefury-mcp |
| Plausible | Community (Sentry-hosted) | github.com/getsentry/plausible-mcp |
| Umami | Community | github.com/Macawls/umami-mcp-server |

### Gaps — Bash / WebFetch territory

- **Video editing:** no Remotion MCP; drive `~/Projects/approvals-motion`-style projects via Bash (`npx remotion render`).
- **Screen recording:** ScreenStudio has no MCP; trigger via macOS `osascript` or run manually; post-process with ffmpeg.
- **Image generation:** no Midjourney/Ideogram MCP; use `claude-api` skill against Anthropic vision-out, or Bash → Replicate API via `curl`.
- **CRM:** no Attio/Folk MCP confirmed; WebFetch their REST APIs with bearer token.
- **SEO crawl:** no Ahrefs/SEMrush MCP; WebFetch Google Search Console API or scrape SERPs via Playwright.
- **After Effects / Premiere:** community MCPs exist (Dakkshin, mikechambers/adb-mcp, hetpatel-11) but are toy-grade. **Don't wire into the pipeline.** Stick with Remotion.

### How to run a typical week from one Claude Code session

1. `Skill: schedule` — pull this week's calendar entries from the table in §7.
2. For each post: `Skill: frontend-design` to compose any image; `mcp__claude_ai_Gmail__create_draft` for any outbound; commit text to `docs/posts-<week>.md` for the record.
3. Friday: cross-post — read `docs/syndication.md` HN or IH template, paste, post manually (no auto-post — voice integrity).
4. Monday: review KPIs — write the five numbers in `docs/kpi-log.md`.
5. Skip backwards-compat hacks. Skip "rest day" content. Skip vanity metrics.

---

## Trade-offs surfaced (instead of clarifying questions)

- **Handle is `@taskshq` not `@tasks`** — `@tasks`, `@thetaskapp`, `tasksapp.bsky.social` are all taken. Once the custom domain lands 2026-05-07, revisit if the domain unlocks a stronger handle (e.g., `@tasksdotapp` if the domain is tasks.app).
- **Defer LinkedIn / YouTube / TikTok / IG** — on purpose. Each one is a content engine. Three live channels is the realistic solo cap. Activate after first 1k signups when video assets exist.
- **Skip After Effects and Premiere** — community MCPs are toy-grade in 2026. Remotion + Resolve covers the real range. Revisit in 6 months if Adobe ships an official MCP.
- **Skip Google Ads** — at $500 budget the CPCs lose to Notion/Asana before the click. Reddit Ads + IG micro-influencer get more reach per dollar in this audience.
- **Position against Notion/ClickUp/Asana, not Linear** — Linear is the wrong fight. Picking it makes Tasks look like a knockoff; ignoring it lets Tasks own the non-engineer audience cleanly.
- **No paid auto-poster** — Buffer/Hypefury MCPs exist but the brand voice is fragile under automation. Drafts in Gmail / `docs/posts-<week>.md`, post manually.
- **One press push, not a press blast** — 15 contacts, personal emails, T-7 to Show HN. Bigger lists at this stage produce silence.
