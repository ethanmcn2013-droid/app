# Tasks · decisions log

The technical and business decisions that locked in. Each entry: what we picked, what we considered, why it landed there, and what would change our mind.

Last revised: 2026-07-25.

---

## D1 · Database for production — Postgres (Neon), once SQLite-on-Vercel hurts

**Picked (planned, P0):** Neon Postgres with the existing Drizzle adapter swapped from `better-sqlite3` to `node-postgres`.

**Considered:** stay on SQLite (today's setup); Supabase; Vercel Postgres; Railway; Turso.

**Why Neon:** branching for previews, free tier covers single-instance launch traffic, pooler built in, generous PITR. Supabase is heavier (auth + storage + realtime we don't need — Clerk + Vercel Blob + SSE already cover those). Vercel Postgres is fine but locks in a vendor that's also our host. Turso is interesting but the multi-region story isn't load-bearing for a US-launched product.

**Today's reality (the urgent half):** SQLite on Vercel `/tmp` is per-instance ephemeral. Anyone signing up in production loses their data when the instance recycles. This is the reason `AI-data-postgres-decision` is P0 and gates real prod traffic.

**What changes our mind:** Neon free-tier limits trip before $1k MRR. Easier to migrate at MRR-1k than at MRR-50k.

---

## D2 · Analytics warehouse — none yet, PostHog as primary, BigQuery deferred

**Picked:** PostHog for product analytics. Vercel Web Analytics for traffic. No warehouse.

**Considered:** BigQuery, Snowflake, Mixpanel, Amplitude, Heap.

**Why nothing-warehouse:** at launch traffic (target: 1k signups by 07-05), PostHog's dashboards + Stripe's reports cover everything we'd query a warehouse for. BigQuery is overkill until we have ETL pipelines that can't run inline.

**What changes our mind:** $5k MRR or 10k MAU. By then the funnel breakdown questions get specific enough that warehouse SQL beats dashboard-clicking. At that point: BigQuery via Stripe-connector + PostHog export.

---

## D3 · Marketing analytics — GA4 + GTM alongside PostHog, not as primary

**Picked (planned, P0 if launch metrics matter):** GA4 with a GTM container. PostHog stays primary; GA4 is for SEO + paid attribution surfaces (Search Console, Reddit Ads, IG boost).

**Considered:** Plausible / Fathom (privacy-first), Vercel Web Analytics alone.

**Why dual:** PostHog for funnel/cohort analysis; GA4 because Search Console and Reddit Ads pixel through it without negotiating. Plausible was tempting (cookieless out of box) but the lack of Reddit/IG pixel parity costs more than the privacy upside saves us in indie context.

**What changes our mind:** if we never run paid (and stop pursuing organic SEO with Search Console signal), drop GA4 and run Plausible cookieless.

---

## D4 · Pricing model — per-workspace, not per-seat. Locked.

**Picked:** $9.95/workspace/month, $79/workspace one-time for Wedding, $4.99/mo Pro, $14.95/mo Studio, free baseline. No seat counts anywhere.

**Why:** pricing is the deck. The 80% who don't work in tech can't budget per-seat — the wedding planner doesn't add the florist if it costs $11 more. Per-workspace breaks the unit-economics small teams have been losing on for a decade. It also gates us out of the 50-person-eng-team market, which is correct — Linear has them.

**What changes our mind:** never. This is on the refusal list at `/principles`.

---

## D5 · Brand voice rules — published, enforced

**Picked:** dry, em-dash welcome, lowercase casual, no emojis, no "thrilled / excited / huge." Voice anchored to `/about` strikethrough manifesto.

**Why:** voice is the moat. It survives every other commodity (UI kit, framework, color palette) and travels with screenshots into HN/PH/IH comments. Generic AI-marketing voice is the default everyone defects to under deadline pressure; the rule keeps the wall up.

**Enforced via:** `AGENTS.md` refusal list, copy review during cycle close, voice-grep in CI (action item `AI-test-ci-pipeline`).

---

## D6 · No paid auto-poster — drafts only

**Picked:** all social posts are drafted in `docs/posts-week-N.md` and posted manually. Buffer / Hypefury MCPs exist but stay off the pipeline.

**Why:** brand voice is fragile under automation. A scheduled bot's first slip (a typo, a stale CTA, a posted-after-domain-swap-broke-the-link) costs more than the time it saved.

**What changes our mind:** the brand voice stops being load-bearing (i.e., it's commoditized — every tool sounds like this). Currently nobody we benchmark against does, so we keep the rule.

---

## D7 · Email — Resend for transactional, undecided for marketing

**Picked (transactional):** Resend.

**Picked (marketing newsletter):** undecided — Beehiiv vs Substack vs ConvertKit vs Resend Audiences. Action item `AI-newsletter-platform`.

**Why Resend:** built for developers, modern API, Vercel-native. Bounce/complaint webhooks are clean.

**What changes our mind on marketing:** the audience size after Show HN/PH (06-23). If it's >1k subscribers, Beehiiv (free up to 2.5k) beats ConvertKit (paid above 1k). If it's <500, just keep using Resend Audiences and skip the newsletter platform decision until growth justifies it.

---

## D8 · Auth — Clerk

**Picked:** Clerk via `src/proxy.ts` + `<ClerkProvider>` + `getCurrentUser()`/`getActiveWorkspace()`/`listMyWorkspaces()`.

**Considered:** Auth.js (NextAuth), Lucia, Supabase Auth, hand-rolled.

**Why Clerk:** SOC 2, MFA, OAuth providers all included; webhook contract is clean; pricing tier (free up to 10k MAU) covers launch. Auth.js is fine but the dashboard surface for managing real users matters more in solo-founder mode than the framework purity.

**What changes our mind:** Clerk price tier transitions get punitive. They don't until 10k MAU and we can swap before then.

---

## D9 · Product URL architecture — one marketing origin, one app origin

**Picked:** `signalstudio.ie` is the marketing origin and carries the four product homes at `/notes`, `/tasks`, `/timeline`, and `/signal`. `app.signalstudio.ie` is the only signed-in app origin and carries the stable module routes `/app/notes`, `/app/board`, `/app/plan`, and `/app/brief`.

**Why:** Signal Studio is one app with four products. Paths keep the marketing story coherent and discoverable; one app origin keeps authentication, navigation, and tenant context coherent. Product subdomains remain only where a public artifact or service contract needs a narrow boundary.

**Compatibility:** `tasks.signalstudio.ie` continues to serve Tasks embeds, published workspaces, invitations, webhooks, and service endpoints. `timeline.signalstudio.ie` continues to serve published and bearer-linked Timeline artifacts. Retired product roots permanently redirect to their canonical marketing page.

**What changes our mind:** a proven security or isolation requirement that cannot be satisfied by route-level boundaries. Any change requires a migration map, permanent redirects, auth callback review, and protection of existing public artifact URLs. Full contract: `docs/SUITE_URL_AND_NAMING_CONTRACT.md`.

---

## D10 · Hosting — Vercel, including the database file

**Picked:** Vercel for everything Next.js. SQLite committed in repo, copied to `/tmp` on cold start (current). Postgres provider plugged in once D1 lands.

**Why:** the dev/prod parity story is the cleanest. Functions + Cron + Edge are all under one billing surface.

**What changes our mind:** function cold-start hits the launch beat (Show HN / PH). Then move the heavy paths to Edge runtime or pre-render aggressively.

---

## D11 · Status page — BetterStack (planned)

**Picked (planned, P1):** BetterStack public status page. Free tier supports 5 monitors which is enough for the surfaces we care about (/, /app, /api/webhooks/stripe, /api/webhooks/clerk, /api/cron/digest).

**Considered:** Statuspage.io (Atlassian — too pricey for solo), Instatus (free tier doesn't include enough monitors), self-hosted (waste of weekend).

**Why BetterStack:** free tier honest, the on-call rotation features useful when there's a second person to rotate to.

---

## D12 · Internal tooling — dogfood Tasks itself

**Picked:** internal todos and product tracking live in Tasks itself, on a private workspace. The `/roadmap` page is the GTM operator surface. `docs/*.md` files are markdown-source-of-truth and read by both humans and the parser.

**Why:** if the founder doesn't ship his own todos in his own product, no one else will believe it ships theirs.

**What changes our mind:** never.

---

## D13 · Legal entity, banking, accounting — Stripe Atlas → Mercury → Wave

**Picked (planned, ordered):**
1. Form Delaware C-Corp via Stripe Atlas ($500 + state fees). Action item `AI-stripe-atlas`.
2. Open Mercury banking after Atlas hands off. Action item `AI-mercury-account`.
3. Wave for free bookkeeping until revenue justifies QuickBooks. Action item `AI-bookkeeping-software`.

**Why:** Atlas handles the formation paperwork, Stripe-issued EIN, and post-incorporation onboarding all in one. Mercury integrates with Stripe payouts in two clicks. Wave is free and good enough for sub-$10k MRR.

**What changes our mind on Wave:** revenue passes $10k/month. Then upgrade to QuickBooks Online or hire a bookkeeper directly.

---

## D14 · Internal CRM for press + leads — Attio

**Picked (planned, P2):** Attio. Action item `AI-attio-crm`.

**Considered:** Folk, HubSpot, spreadsheet (current).

**Why:** Attio's data model is the one closest to "tasks with structure" — it'll feel like the same product. HubSpot is overkill. Folk is fine but Attio's pricing and Notion-feel won out.

**What changes our mind:** press contacts cap at <30 by Show HN day. Then a spreadsheet still beats a CRM and we defer.

---

## D15 · Trademark — file `tasks·` wordmark, defer international

**Picked (planned, P2):** USPTO filing for the wordmark `tasks·` (Class 9 software, ~$350) via LegalZoom. International (Madrid Protocol) deferred until $50k ARR.

**Why:** "Tasks" alone is generic and won't get a registration. The wordmark with the trailing dot is what's protectable, and only inside the software class.

**What changes our mind:** an actual infringement issue surfaces (someone using `taskshq.com` or similar) before $50k ARR. Then file Madrid sooner.

---

## D16 · Background jobs — Vercel Cron at launch, Inngest if we need durability

**Picked:** Vercel Cron for the digest + weekly-digest jobs.

**Considered:** Inngest, Trigger.dev, Temporal.

**Why Vercel:** already on the bill. Inngest is well-loved but the durability + retry guarantees aren't worth the operational complexity at launch.

**What changes our mind:** the AI-nudge generation needs >60s execution time, or the daily digest needs guaranteed delivery with retries. Inngest then.

---

## D17 · Feature flags — none yet

**Picked:** ship without flags. `if (env.NEXT_PUBLIC_ENABLE_X)` for the rare gate.

**Considered:** PostHog feature flags, Statsig, GrowthBook, LaunchDarkly.

**Why nothing:** the codebase is small enough to delete a feature instead of flagging it. Flags add an axis of state to debug.

**What changes our mind:** we run our first real A/B test on `/pricing` (action item `AI-pricing-ab`). Then PostHog's flags + experimentation layer is the obvious pick — already in the bundle.
