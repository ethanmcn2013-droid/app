# Tasks · deploy notes

This file is the launch checklist. Read top-to-bottom; every section
is required for a public-traffic deployment.

## 1. Vercel project link

```bash
npm i -g vercel
vercel link
vercel git connect    # optional: auto-deploy on git push
```

Project settings → set `Framework Preset = Next.js`, `Build Command =
next build`, `Install Command = npm install` (default).

## 2. Required env vars

Set these in Vercel → Settings → Environment Variables. Mark each
for **Production + Preview**; the `NEXT_PUBLIC_*` ones also need to
reach the build step.

```
NEXT_PUBLIC_SITE_URL=https://tasks.app

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_TEAM_MONTHLY=price_...
STRIPE_PRICE_WEDDING_ONETIME=price_...

# Resend
RESEND_API_KEY=re_...
RESEND_FROM=Tasks <hello@tasks.app>

# Cron + Sentry
CRON_SECRET=<random 32-byte hex>
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production

# Database (Turso / libSQL)
TASKS_DATABASE_URL=libsql://...
TASKS_AUTH_TOKEN=...

# PostHog (onboarding funnel + signup_completed)
POSTHOG_API_KEY=phc_...
# Optional — default https://eu.i.posthog.com
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

## 3. Webhook endpoints

After deploy, register these URLs in each provider's dashboard:

- **Clerk** — Dashboard → Webhooks → Add Endpoint:
  `https://tasks.app/api/webhooks/clerk`
  Subscribe to: `user.created`, `user.updated`, `user.deleted`.
  Copy the signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`.
- **Stripe** — Dashboard → Developers → Webhooks → Add endpoint:
  `https://tasks.app/api/webhooks/stripe`
  Events: `checkout.session.completed`,
  `customer.subscription.updated`,
  `customer.subscription.deleted`.
  Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

## 4. Stripe products

In Stripe → Products, create three products / four prices:

| Product | Price | Billing | Maps to env var |
|---|---|---|---|
| Tasks Pro | $4.99 | monthly recurring | `STRIPE_PRICE_PRO_MONTHLY` |
| Tasks Team | $9.95 | monthly recurring | `STRIPE_PRICE_TEAM_MONTHLY` |
| Tasks Wedding | $79 | one-time | `STRIPE_PRICE_WEDDING_ONETIME` |

Copy each Price ID (starts `price_`) into the matching env var.

## 5. Resend domain

Resend → Domains → Add Domain. Add the four DNS records (DKIM,
SPF, DMARC, return-path) Resend prints.  Wait for verification.
Set `RESEND_FROM=Tasks <hello@your-verified-domain.com>`.

## 6. Cron

The `vercel.json` already declares the daily digest cron at
`0 9 * * *` against `/api/cron/digest?send=1`. Confirm it appears in
Vercel → Settings → Cron Jobs after the first deploy.

## 7. Custom domain

Vercel → Domains → Add. Point your registrar's nameservers at
Vercel (or add the `CNAME` they specify). Confirm
`NEXT_PUBLIC_SITE_URL` matches the apex (`https://tasks.app`).

## 8. Sentry

Sentry → Create Project → Next.js. Copy the DSN into both
`SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`. Set
`SENTRY_ENVIRONMENT=production`. Optionally set
`SENTRY_AUTH_TOKEN` to enable source-map upload during deploy.

## 8b. Database release gate

Never paste an individual `drizzle/*.sql` file into production and never run
`drizzle-kit migrate` directly. The historical 0000-0013 chain contains
already-applied, non-idempotent SQL.

Before application deploy, verify the source contract and target status:

```bash
pnpm db:contract
pnpm db:status -- \
  --environment=production \
  --confirm-production=tasks
```

For a normal forward migration, first take a verified backup and pass an
isolated-copy dry run. Put those hashes and the exact pending migration hashes
in a `tasks-migration-execution/1` receipt together with the target database
identity, environment, and current ledger hash, then run:

```bash
pnpm db:migrate -- \
  --environment=production \
  --confirm-production=tasks \
  --receipt=<execution-receipt.json>
```

For the one-time legacy production registration, use the checked-in
`drizzle/receipts/production-adoption-2026-07-15.json` with `pnpm db:adopt`.
Adoption verifies the existing schema and records the baseline; it does not
re-run historical SQL. A second run must report `no-op` before the database
gate is considered complete. See `drizzle/MIGRATIONS.md` for the full contract.

## 9. Smoke test (production, from a phone in incognito)

- [ ] `/` renders, demo plays
- [ ] `/pricing`, `/about`, `/students` unfurl with correct OG cards
  in iMessage/Slack
- [ ] Sign up flow works → lands in `/welcome`
- [ ] `/sign-up?use=wedding` → welcome pre-selects wedding segment
- [ ] Segmented onboarding (welcome → use case → context → starter) completes
- [ ] Pick a starter pack → board renders with seeded tasks + segment empty-state copy
- [ ] Settings → change coordination type (update only + re-seed paths)
- [ ] PostHog receives `signup_completed` and `onboarding_completed` (if key set)
- [ ] Check off a task → DopamineCheck animation fires
- [ ] Generate a magic link → another tab/incognito visits → renders
  read-only
- [ ] Pricing CTA → Stripe Checkout (use test card `4242 4242 4242
  4242`) → success → entitlement granted → `/app/board` renders
- [ ] Daily digest cron fires (manually trigger via `curl -H
  "Authorization: Bearer $CRON_SECRET" $URL/api/cron/digest?send=1`)
  → email lands in `RESEND_FROM`'s test inbox

## 10. Post-launch ad creative session

Once 1–9 pass on production, run a 60-min ScreenStudio session at
4K against the live URL. Capture these moments for ad creative:

1. View-morph (board → list → timeline) — your hero shot
2. Done Dopamine burst on a checkbox click
3. /about strikethrough animation through enterprise jargon
4. Domain toggle pill slide on the landing
5. Cmd+K palette opening
6. Welcome → starter pack → seeded board
7. NLP date parser preview pill sliding in
8. Magic-link copy → guest renders → progressive auth modal
9. Conversation feed live update with the @-mention badge

Crop into 9:16 portrait for social. The hero shot crops cleanly to
1:1 and 16:9.

## Backlog (post-v1.0)

- Source-map upload to Sentry on deploy
- Webhook idempotency table (`processed_webhooks`)
- Postgres adapter (currently SQLite-only)
- Real-time presence (Liveblocks/Yjs)
- AI-narrated weekly digest (currently rules-based daily only)
