# Signal Studio app · deploy notes

Current as of the 2026-07-31 data-layer reset. The app deploys from this
repo to the Vercel project serving `app.signalstudio.ie`. The canonical
infrastructure map (every service, account, env var, and rotation step)
lives in `studio/docs/INFRASTRUCTURE.md`; this file is the app-side
summary.

## 1. Environment variables

One convention everywhere: `<MODULE>_DATABASE_URL` + `<MODULE>_AUTH_TOKEN`.
No vendor names in variables, no aliases.

```
# Required in production (boot fails without them — src/env.ts)
TASKS_DATABASE_URL=libsql://tasks-prod-....turso.io
TASKS_AUTH_TOKEN=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Module databases (features degrade without them)
NOTES_DATABASE_URL=libsql://notes-prod-....turso.io
NOTES_AUTH_TOKEN=...
TIMELINE_DATABASE_URL=libsql://timeline-prod-....turso.io
TIMELINE_AUTH_TOKEN=...
SIGNAL_DATABASE_URL=libsql://signal-prod-....turso.io
SIGNAL_AUTH_TOKEN=...
ENTITLEMENTS_DATABASE_URL=libsql://entitlements-prod-....turso.io
ENTITLEMENTS_AUTH_TOKEN=...

# Clerk webhook
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# Stripe (five prices, one per tier — no aliases)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_WORKSPACE_MONTHLY=price_...
STRIPE_PRICE_WORKSPACE_ANNUAL=price_...
STRIPE_PRICE_STUDIO_MONTHLY=price_...
STRIPE_PRICE_WEDDING_ONETIME=price_...
STRIPE_PRICE_EVENT_ONETIME=price_...

# Resend
RESEND_API_KEY=re_...
RESEND_FROM=Signal Tasks <hello@signalstudio.ie>

# Cron + cross-app secrets
CRON_SECRET=<random 32-byte hex>
STUDIO_CRON_PING_URL=https://signalstudio.ie/api/internal/cron-ping
STUDIO_CRON_PING_SECRET=<shared with studio's CRON_PING_SECRET>
NOTES_TO_TASKS_SECRET=<random>
PARTNER_STATS_SECRET=<shared with studio>

# Public URLs
NEXT_PUBLIC_SITE_URL=https://app.signalstudio.ie
NEXT_PUBLIC_STUDIO_URL=https://signalstudio.ie
```

Optional, provision deliberately (see INFRASTRUCTURE.md before adding):
`ANTHROPIC_API_KEY` (+ `TASKS_AI_*` tuning), `SENTRY_DSN` /
`NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_ENVIRONMENT`, `POSTHOG_API_KEY` /
`NEXT_PUBLIC_POSTHOG_HOST`, `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN`, `BLOB_READ_WRITE_TOKEN` (required if task
attachments should work in production — serverless disk is ephemeral),
`RESEND_BCC_DEV`, `OUTBOX_DELIVERY_SECRET` / `SUITE_OUTBOX_CONSUMERS_JSON`,
`NOTES_TO_TIMELINE_SECRET`, `NOTES_CAPTURE_INBOUND_SECRET`,
`ADMIN_USER_IDS`, `SIGNAL_ALLOWLIST`, access-mode and feature flags.

## 2. Webhook endpoints

- **Clerk** — Dashboard → Webhooks:
  `https://app.signalstudio.ie/api/webhooks/clerk`
  Events: `user.created`, `user.updated`, `user.deleted`.
  Signing secret → `CLERK_WEBHOOK_SIGNING_SECRET`.
- **Stripe** — Dashboard → Developers → Webhooks:
  `https://app.signalstudio.ie/api/webhooks/stripe`
  Events: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`.
  Signing secret → `STRIPE_WEBHOOK_SECRET`.

## 3. Stripe products

Five prices, one env var each (section 1). Tier vocabulary:
Workspace (monthly + annual), Studio (monthly), Wedding (one-time),
Event (one-time). Prices are set in the Stripe dashboard; copy each
Price ID into the matching env var. `docs/STRIPE_SETUP.md` holds the
detailed runbook.

## 4. Database release gate

Never paste an individual `drizzle/*.sql` file into production and never run
`drizzle-kit migrate` directly. The historical 0000–0013 chain contains
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

A fresh database (created from the 0014 baseline + forwards) takes the same
`db:migrate` path with a fresh execution receipt for the new database
identity. The module databases (notes / timeline / signal) are created from
their tracked baselines in `drizzle-notes/`, `drizzle-timeline/`,
`drizzle-signal/`. See `drizzle/MIGRATIONS.md` for the full contract.

### Pending module migration: notes 0001

`drizzle-notes/0001_notes_reviewed_at.sql` adds one nullable column and one
index to `notes`, for the Review queue (N·25, 2026-08-05):

```sql
ALTER TABLE `notes` ADD `reviewed_at` integer;
CREATE INDEX `notes_user_reviewed_idx` ON `notes` (`user_id`,`reviewed_at`,`created_at`);
```

It is additive and backward compatible: every existing row reads as "not yet
reviewed", which is true, and the previous release keeps working against the
new schema.

**Deploy order does not matter.** The app probes for the column once per
process (`notesReviewStateReady()` in
`src/modules/notes/server/actions/notes.ts`) and projects a literal NULL when
it is absent. Shipping the code first is safe: the notebook, search, capture,
editing, Turn into task and Sent all work, every note simply reads as "not
yet reviewed", and the only thing that fails is the one action that writes
the column — which reports itself and rolls back on screen.

Until the migration is applied, therefore:

- Review lists every note and the queue never empties.
- "Keep in Notes" says the decision was not saved, and means it.

Applying it switches Review on with no further deploy. There is no
receipt-backed runner for the module databases yet — `pnpm db:migrate` covers
the Tasks database only — so apply it by hand against `NOTES_DATABASE_URL`
with `turso db shell`, after a backup, and record the applied hash beside the
release. Building that runner for the module databases is open work; the
probe above is what makes its absence survivable rather than blocking.

## 5. Cron

`vercel.json` declares the daily digest cron (`0 9 * * *` against
`/api/cron/digest?send=1`). Confirm it appears in Vercel → Settings →
Cron Jobs after the first deploy.

## 6. Smoke test (production, from a phone in incognito)

- [ ] `/` renders
- [ ] Sign-in works → `/app/tasks` board renders
- [ ] Each module renders: `/app/notes`, `/app/timeline`, `/app/signal`
- [ ] Check off a task → completion animation fires
- [ ] Share link → another tab/incognito visits → renders read-only
- [ ] Pricing CTA → Stripe Checkout (test card `4242 4242 4242 4242`) →
  entitlement granted
- [ ] Daily digest cron fires (`curl -H "Authorization: Bearer $CRON_SECRET"
  $URL/api/cron/digest?send=1`) → email lands
- [ ] Clerk + Stripe webhooks show recent deliveries in their dashboards
