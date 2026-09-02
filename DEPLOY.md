# Signal Studio app · deploy notes

Current as of the 2026-08-09 Wave 0 deployment rebaseline. The `app` GitHub
repo deploys through Vercel's existing `app` project and serves
`app.signalstudio.ie`. A merge is not a deployment receipt: wait for the new
production deployment to become READY and for the canonical alias to resolve
to its deployment ID. The canonical
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

# Stripe (runtime variable names; visible commercial terms live in Studio)
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
NEXT_PUBLIC_APP_URL=https://app.signalstudio.ie
NEXT_PUBLIC_SITE_URL=https://app.signalstudio.ie
NEXT_PUBLIC_STUDIO_URL=https://signalstudio.ie

# Project Drive (optional capability; all are required before enabling it)
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://app.signalstudio.ie/api/connections/google/callback
OAUTH_STATE_SECRET=<independent random value, at least 32 bytes>
PROVIDER_TOKEN_KEY=<base64-encoded 32-byte key>
PROVIDER_TOKEN_KEY_VERSION=1
```

### Google Drive connection contract

Register this production callback **exactly** on the dedicated Google OAuth
client, then set the identical value in Production:

```
https://app.signalstudio.ie/api/connections/google/callback
```

Preview must use its own stable HTTPS Preview origin in
`GOOGLE_OAUTH_REDIRECT_URI`, and that exact callback must also be registered on
the client. The server refuses a different path, query, fragment, credentials,
plain HTTP outside `localhost`, or a callback synthesized from another public
URL variable. Successful and failed callbacks return to the origin encoded by
this validated variable; an incoming `Host` header cannot steer the redirect.
For local development, `http://localhost:<port>/api/connections/google/callback`
is allowed and must likewise match the Google client registration.

The client requests exactly
`https://www.googleapis.com/auth/drive.file` — never add identity, full-Drive,
readonly, or incremental scopes. `GOOGLE_OAUTH_CLIENT_SECRET`,
`OAUTH_STATE_SECRET`, and `PROVIDER_TOKEN_KEY` are sensitive server values and
must not use the `NEXT_PUBLIC_` prefix. Generate the state secret separately
from the token-encryption key so compromise or rotation of one cannot silently
become compromise of both:

```bash
node -p "require('crypto').randomBytes(32).toString('base64url')" # OAUTH_STATE_SECRET
node -p "require('crypto').randomBytes(32).toString('base64')"    # PROVIDER_TOKEN_KEY
```

The callback creates or reuses only an app-marked, unshared `Signal Studio`
folder. Board folders and member permissions are WP-5 lifecycle work; do not
create permissions on the root as an operator workaround.

**`PROVIDER_TOKEN_KEY` encrypts stored provider refresh tokens.** Project
Drive holds a long-lived Google credential per connected account, and this
is the key that seals it before it touches the database (`secret-box.ts`,
AES-256-GCM). Generate it once:

```bash
node -p "require('crypto').randomBytes(32).toString('base64')"
```

Set it in all three Vercel environments and mark it sensitive. **Then leave
it alone.** Everything sealed with this key can only be read with this key,
so changing it forces every customer who has connected their Drive to
reconnect. That is survivable but visible, and not something to do by
accident.

Rotating it deliberately, when the time comes, is a three-step move rather
than a swap — the envelope carries its key version precisely so there is no
flag day:

1. Add the new key as `PROVIDER_TOKEN_KEY`, bump
   `PROVIDER_TOKEN_KEY_VERSION`, and move the old one into
   `PROVIDER_TOKEN_KEY_RETIRED` as `{"1":"<old base64>"}`. New rows seal
   with the new key; old rows still open.
2. Re-seal the existing rows. `versionOf()` finds the ones still on the old
   version without decrypting everything to look.
3. Only once none remain, drop `PROVIDER_TOKEN_KEY_RETIRED`. Dropping it
   early produces rows that fail with `unknown-key-version` — recoverable
   only by putting the old key back.

**`BLOB_READ_WRITE_TOKEN` is required for attachments** and is listed in
`RECOMMENDED_IN_PRODUCTION` in `src/env.ts`, so its absence warns at boot.
Without it, `chooseBackend()` returns `vercel-no-token` and every upload throws
at the moment a customer tries one — serverless disk is ephemeral, so there is
no fallback on Vercel. To confirm the store actually works, rather than merely
that a variable is set:

```bash
vercel env pull .env.production --environment=production
node scripts/verify-blob-store.mjs .env.production
rm .env.production        # it holds live credentials
```

It writes one clearly-named scratch object, reads it back through the download
route's own call, confirms an anonymous request is refused, and deletes it. No
database row is created.

Optional, provision deliberately (see INFRASTRUCTURE.md before adding):
`ANTHROPIC_API_KEY` (+ `TASKS_AI_*` tuning), `SENTRY_DSN` /
`NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_ENVIRONMENT`, `POSTHOG_API_KEY` /
`NEXT_PUBLIC_POSTHOG_HOST`, `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN`,
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

The environment names above mirror the current checkout implementation in
`src/server/stripe.ts`; they are not permission to invent or restate public
prices. Visible plan names, amounts, cadence, eligibility, duration, renewal,
and editor limits come from Studio's canonical commercial-terms source. If
code, Stripe, and that source disagree, stop the release and reconcile them.
`docs/STRIPE_SETUP.md` is the provider runbook.

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

### Module-database boundary

`pnpm db:migrate` and the continuous `db-migration-drift` workflow cover the
Tasks database only. Notes, Timeline, and the legacy-named Signal database
(Home briefing capability and preferences) retain their tracked baselines in
`drizzle-notes/`, `drizzle-timeline/`, and `drizzle-signal/`. A SQL file in the
repository is not proof that a module database was changed in production.
Any module write requires a fresh backup, isolated-copy dry run, applied-file
hash, postcondition evidence, and second-run/no-op evidence in the release
receipt. Never carry a dated "pending migration" claim in this runbook after
its production state can change independently.

## 5. Cron

`vercel.json` declares the daily digest cron (`0 9 * * *` against
`/api/cron/digest?send=1`). Confirm it appears in Vercel → Settings →
Cron Jobs after the first deploy.

## 6. Smoke test (production, from a phone in incognito)

- [ ] `/` renders
- [ ] Sign-in works → `/app/home` renders, then `/app/tasks` board renders
- [ ] Each product renders: `/app/notes`, `/app/tasks`, `/app/timeline`
- [ ] Home renders Today's Signal and `/app/home/briefing` renders the Full Briefing
- [ ] Legacy `/app/signal` redirects to `/app/home/briefing` and is never emitted by new UI
- [ ] Check off a task → completion animation fires
- [ ] Share link → another tab/incognito visits → renders read-only
- [ ] A safe test-environment pricing CTA preserves its selected plan through
  checkout and the expected entitlement is granted; never use test-card data
  against the live production account
- [ ] Daily digest cron fires (`curl -H "Authorization: Bearer $CRON_SECRET"
  $URL/api/cron/digest?send=1`) → email lands
- [ ] Clerk + Stripe webhooks show recent deliveries in their dashboards
