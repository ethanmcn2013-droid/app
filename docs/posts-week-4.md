# Tasks · Posts Week 4 (Mon 2026-06-01 → Sun 2026-06-07)

Verbatim copy-paste deck. Tick the box once posted.

Voice rules — dry, observational, em-dashes welcome, no emojis, no hype. Every URL stays as `tasks-nu-hazel.vercel.app` until the custom domain is swapped.

---

## Monday 2026-06-01 — Twelve templates explainer + Reddit Ads launch

### Mon 06-01, 9:15am ET — X (thread, 5 posts) — why 12 templates not 1
- [ ] Post 1/5
- [ ] Post 2/5
- [ ] Post 3/5
- [ ] Post 4/5
- [ ] Post 5/5

**Post 1/5:**

> Tasks ships with twelve templates. Not one *"start blank,"* not three *"productivity / personal / work,"* — twelve specific drop-in workspaces. Why twelve, not one. Short answer: a blank canvas is the worst onboarding step in the productivity category.

**Post 2/5:**

> Wedding 3-month countdown. Day-of run-of-show. Final paper sprint. Job application sprint. Freelance new-client onboarding. Apartment move. Product launch. Each one is a destination URL — `/templates/[slug]` — written for one person, in their words.

**Post 3/5:**

> The bride doesn't need *"a productivity template."* She needs the wedding 3-month countdown. The freelancer doesn't need *"task management."* He needs the new-client onboarding checklist. The template is the product, not the wrapper.

**Post 4/5:**

> Each template is also an SEO surface. *"wedding 3-month checklist template,"* *"freelancer tax season checklist,"* *"final paper outline"* — long-tail queries the audience actually types. The copy is in our voice. Not Pinterest-spam.

**Post 5/5:**

> Open one, hit *Remix in a new workspace*, you get a fresh workspace pre-applied. The original template stays untouched. Your remix is yours. All twelve are free, forever — that one's on the refusal list. tasks-nu-hazel.vercel.app/templates.

### Mon 06-01, 8:00am ET — Reddit Ads launch (paid, $300, 7-day flight) — BRIEF, not a post body
- [ ] Launch

**Targeting:** r/weddingplanning + r/wedding + interest *wedding planning*; US; women 25–38.

**Creative:** static image — a `/p/` published wedding workspace in the wedding domain pack (ivory, blush florals, italic serif lane labels). Crop to 1080×1080 + 1200×628.

**Headline:** *"$79 once. Fits the bride, groom, both moms, and the DJ."*

**Body:** *"A wedding planner that's a planner — not a spreadsheet, not a binder, not seventeen tabs. Per-workspace pricing means inviting people doesn't cost extra. Free 3-month countdown template, no card."*

**CTA URL:** `tasks-nu-hazel.vercel.app/for/weddings`

**KPI:** ≥40 free signups + ≥3 $79 Wedding purchases over the 7-day flight.

**Kill criteria:**
- CPA on free signup >$5 by day 4 → pause and reallocate.
- Zero $79 conversions by day 7 → pause.

**Daily check:** 9am ET; log in `docs/kpi-log.md` if signups land.

---

## Tuesday 2026-06-02

### Tue 06-02, 9:00am ET — X (thread, 6 posts) — CSV import (cycle 15 narrative)
- [ ] Post 1/6
- [ ] Post 2/6
- [ ] Post 3/6
- [ ] Post 4/6
- [ ] Post 5/6
- [ ] Post 6/6

**Post 1/6:**

> Cycle 15 shipped CSV import — drag a `.csv` from Trello, Asana, or Notion and the workspace fills itself. Not because everyone is migrating *from* something, but because the cost of trying a new tool is *re-entering the work,* and we wanted that cost to be zero.

**Post 2/6:**

> `/app/import` is a three-step wizard — upload, preview, confirm. Drag-and-drop. The parser auto-detects the source: Trello reads `Card Name / List Name / Labels / Due Date / Members`. Asana reads `Name / Section / Tags / Assignee`. Notion reads whatever the database export gave us.

**Post 3/6:**

> The preview table maps detected columns to canonical Task fields with a header-row dropdown — if the heuristic guessed wrong, you fix it inline. Per-row *skip* toggle. Bottom-of-table count: *"47 ready · 3 skipped · 2 missing title."* You see what you're about to import.

**Post 4/6:**

> The action runs in a single transaction. If any row fails, the whole import rolls back. Tasks land in the active workspace, fresh ids, positions extending the end of their target lane. Comments and activities aren't imported — out of scope on purpose.

**Post 5/6:**

> 500-row cap with a *"split into batches"* nudge if exceeded. The cap is opinionated — five hundred tasks is more than any one workspace should hold; if you have more, you have multiple workspaces.

**Post 6/6:**

> Migration shouldn't be a marketing line. It should be the floor of the product. Cycle 15's full narrative — the parser heuristics, the rollback discipline, the preview UX — is at tasks-nu-hazel.vercel.app/changelog.

### Tue 06-02, 8:00am ET — r/SaaS (build-in-public, per-workspace pricing)
- [ ] Post

**Title:** Why we charge per workspace, not per seat — the math, and where it broke

**Body:**

> Solo founder, no funding. Productivity tool at tasks-nu-hazel.vercel.app, eight months in.
>
> The single biggest call we made was per-workspace pricing instead of per-seat. The pitch: inviting people becomes a free action instead of a budget decision. A wedding workspace fits the bride, groom, both moms, the MOH, and the DJ for one number. A study group fits the lab partner and the advisor for one number. Per-workspace, not per-head.
>
> The pricing today:
> - Free — 1 workspace, 3 editing guests
> - Pro — $4.99/mo, unlimited workspaces (one user)
> - Team — $9.95/workspace/mo, unlimited members
> - Studio — $14.95/mo, unlimited workspaces YOU own (operators)
> - Wedding — $79 once, lifetime
>
> What worked: the wedding tier closes without a sales call. Three free editing guests on every workspace, *including the free tier,* cut paid-conversion friction in a way we didn't expect. Naming the tier after the use case (*Wedding,* not *Premium*) jumped pricing-page conversion measurably.
>
> What broke: the operator persona. Freelancers running 5 clients hit 5 × $9.95 immediately on Team. Wedding planners running 10 weddings/year would need 10 × $79. They were bouncing.
>
> The fix was Studio at $14.95/mo — a single user-level entitlement row that layers on top of the per-workspace lookup. No bulk INSERTs at purchase. No DELETEs on cancellation. `TIER_RANK[studio] === TIER_RANK[team]`, same gating code, no branch.
>
> The lesson I'd hand to anyone building per-tenant pricing: name your *operator persona* before you launch. Anyone whose business shape is *one of me, many of you* is an operator. They're the audience that breaks per-tenant math.
>
> Full pricing math is at tasks-nu-hazel.vercel.app/pricing. Curious how others have handled the operator-vs-team split — separate plan, per-user layer, or different unit entirely?

### Tue 06-02, 10:00am ET — Bluesky (single, Studio tier)
- [ ] Post

> Studio tier — $14.95/mo, unlimited workspaces you own as sole admin, full Team capabilities on every one. Built for the freelancer running five clients and the planner running ten weddings. Per-workspace pricing's operator-shaped patch.
>
> tasks-nu-hazel.vercel.app/pricing

---

## Wednesday 2026-06-03

### Wed 06-03, 3:00pm ET — YouTube (Short, 60s board view)
- [ ] Upload

**Title:** Tasks — board view in 60 seconds.

**Description:**

> The board view in Tasks. Same data as the list, the timeline, the calendar. Cursors carry weight, cards FLIP between layouts, comments stream in flat.
>
> tasks-nu-hazel.vercel.app

Capture board view via ScreenStudio at 1440×900, single-take, 60 seconds. Three cursors moving cards across lanes; one card opens, one comment posts, one confetti on done. No voiceover. Render through Remotion title card + outro.

### Wed 06-03, 1:30pm ET — Bluesky (single, scope discipline)
- [ ] Post

> 22 cycles in, what scope discipline actually means: every cycle ships a finite list. The list closes. We name what we cut, in the cycle, in the changelog. The features that don't make it don't get a *"coming soon"* — they get cut, named, and the manifesto stays load-bearing.
>
> tasks-nu-hazel.vercel.app/changelog

---

## Thursday 2026-06-04

### Thu 06-04, 9:00am ET — X (thread, 5 posts) — student template, finals week
- [ ] Post 1/5
- [ ] Post 2/5
- [ ] Post 3/5
- [ ] Post 4/5
- [ ] Post 5/5

**Post 1/5:**

> It's finals week somewhere. The student in front of a 14-week paper at 4am doesn't need a Gantt chart. She needs a list, a deadline, and four buckets her brain can still navigate. The final-paper-sprint template is built for that exact moment.

**Post 2/5:**

> Lane labels read *Reading / Drafting / Edits / Submitted.* Not *To do / Doing / Review / Done.* Same structure, words a student actually uses at 4am. The vocabulary tax is what other tools charge — we don't.

**Post 3/5:**

> Open the template at tasks-nu-hazel.vercel.app/templates/final-paper-sprint, hit *Remix in a new workspace*, you get a fresh workspace named *"Final paper sprint · my remix,"* owned by you, slugged uniquely, all tasks pre-applied. Three minutes to the first card moved.

**Post 4/5:**

> Free Pro for `.edu` accounts — the entire feature set, no card, no upsell. Auto-applied at signup, 120-day grant. We don't charge students. We don't ask them to remember to renew. Pro lands automatically when they hit the signup screen with their school email.

**Post 5/5:**

> Three editing guests are free on every workspace. The lab partner fits. The advisor fits. The roommate who's reading drafts at midnight fits. The math doesn't punish collaboration. tasks-nu-hazel.vercel.app/templates.

### Thu 06-04, 9:20am ET — Bluesky (single, calendar view)
- [ ] Post

> The calendar view in Tasks isn't a Google Calendar embed. It's the same tasks as the board, the list, the timeline — just laid out by date. Same DOM nodes, same data, different geometry. Switching costs you nothing. tasks-nu-hazel.vercel.app/app/calendar.

---

## Friday 2026-06-05 — IH cross-post (cycle 20 — publishable workspaces)

### Fri 06-05, 9:00am ET — Indie Hackers (cross-post cycle 20)
- [ ] Post

**Title:**

> Every shared workspace is a marketing asset — what publishable workspaces look like in practice

**Body:**

> We've been shipping a small productivity tool [tasks-nu-hazel.vercel.app] in weekly cycles. Cycle 20 shipped publishable workspaces — `/p/{slug}` public URLs branded by domain pack — and the architecture turned out cleaner than I expected. More importantly, it changed how I think about the marketing surface area of a multi-tenant product.
>
> The setup: the app already had four "domain packs" — wedding, freelance, student, marketing. Each one reskins the same task data with a different visual register (serif blush florals for wedding; mono code-on-paper for freelance; marker-on-corkboard sticky notes for student; Stripe-Press editorial for marketing). All four lived inside the app shell, behind auth.
>
> The cycle 20 thesis: every shared workspace should be a marketing asset. So we shipped public read-only `/p/{slug}` routes that render the same workspace, themed by domain pack, with no app shell — no SiteNav, no SiteFooter, no auth wall. The page belongs to the domain theme. The wedding workspace reads like a save-the-date page. The freelance workspace reads like a GitHub spec. The student workspace reads like a photographed bulletin board. The marketing workspace reads like Stripe Press.
>
> What this gives you commercially:
>
> 1. **Every customer who shares their work shares the brand.** When a wedding planner sends the couple a link to the workspace, the couple lands on a page that *looks like a wedding planner sent it* — not on a generic SaaS chrome. The brand absorbs into the use case.
>
> 2. **Each public workspace ends with a CTA back to the matching template.** Wedding `/p/{slug}` ends with *"Made with Tasks · pick this template free"* pointing to `/templates/wedding-3-month-countdown`. The viral loop closes — the public page is both a referral and a template-discovery surface.
>
> 3. **OG cards per published workspace.** The unfurl in Slack, iMessage, X is workspace-specific — workspace name, task count, domain-pack chip, URL. Single visual treatment across all four domains (themes are for the page, not the unfurl). The link previews itself, branded.
>
> Architecture: one nullable `publishedAt` timestamp on the workspace. Null = private. Non-null = public at the slug. The existing `slug` column doubles as the public URL identifier — no separate `publicSlug`. Two server actions (`publishWorkspaceAction`, `unpublishWorkspaceAction`) revalidate the route on flip. The four theme components share zero direct visual code; they all receive the same `{ workspace, tasks }` props and render their own `<main>`.
>
> Sprint parallel-agent throughput on the cycle: 22 dispatched, 22 complete, 0 broken builds. Four theme agents shipped four radically different visual treatments on first attempt, voice-matched.
>
> The lesson I'd hand to anyone building a multi-tenant product: ask what your customers *do with their workspaces after they make them.* If the answer is *"share them with people who don't have an account yet,"* the public-render path is your most important marketing surface. Charge for the app, market with the publish.
>
> Full cycle 20 narrative — the schema call, the dispatcher pattern, the four theme agents, the OG card route — is at tasks-nu-hazel.vercel.app/changelog.
>
> What's the equivalent in your product? What does a customer's workspace *become* after they share it?

### Fri 06-05, 10:00am ET — Sidebar.io / Refind (resubmit /principles)
- [ ] Submit

URL: `tasks-nu-hazel.vercel.app/principles`
Title: *Eight features we'll never ship — a productivity app's published refusal list.*

### Fri 06-05, 12:00pm ET — Bluesky (closing post for Reddit Ad cycle)
- [ ] Post

> Per-workspace pricing on a wedding workspace: the bride, the groom, both moms, the MOH, the DJ, the florist — one number. Inviting the right people doesn't cost extra. The whole pitch sits on one math fact.
>
> tasks-nu-hazel.vercel.app/pricing

---

## Saturday 2026-06-06 — REST

(rest day — no posts)

---

## Sunday 2026-06-07 — LIGHT

### Sun 06-07, 9:00am ET — Bluesky (pull-quote slide)
- [ ] Post

> "The quietest thing a productivity app can do is not become the project."
>
> — from /about
>
> tasks-nu-hazel.vercel.app/about

---

## Quick-reference ledger — Week 4

| Day | Posts |
|---|---|
| Mon 06-01 | X 5-thread (templates); Reddit Ads launch (paid brief) |
| Tue 06-02 | X 6-thread (cycle 15 CSV import); r/SaaS pricing post; Bluesky Studio single |
| Wed 06-03 | YouTube Short (60s board view); Bluesky scope-discipline single |
| Thu 06-04 | X 5-thread (final-paper-sprint); Bluesky calendar single |
| Fri 06-05 | IH cycle 20 cross-post; Sidebar.io/Refind resubmit; Bluesky Reddit-Ads close |
| Sat 06-06 | REST |
| Sun 06-07 | Bluesky pull-quote (LIGHT) |

**Total post count week 4:** X 11 (5-thread + 6-thread) · Bluesky 4 · YouTube 1 · IH 1 · r/SaaS 1 · Sidebar.io/Refind 1 · Reddit Ads 1 (paid brief, not a post body).
