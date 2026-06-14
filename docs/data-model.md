# Tasks · data model

Where each kind of data lives, why it lives there, and what changes when the user asks for it back.

Last revised: 2026-06-13. (Persistence migrated to Turso/libSQL — durability section below corrected; the prior SQLite-on-Vercel-ephemeral warning is retired.)

## What we store and where

| Kind of data | Where it lives | Why there |
|---|---|---|
| User account (email, name, avatar) | Clerk | Auth provider; we never see passwords. Synced to our `users` table by webhook. |
| Workspace + membership | Turso/libSQL `workspaces` / `workspace_members` | Per-tenant boundary. Pricing keys off this. |
| Tasks · comments · activities | Turso/libSQL `tasks` / `comments` / `activities` | The product. Everything else is supporting cast. |
| File attachments (metadata) | Turso/libSQL `attachments` | One row per upload; bytes live elsewhere (next row). |
| File attachments (bytes) | Local disk under `<repo>/.data/uploads/<workspaceId>/<taskId>/<id>-<sanitized-filename>` | Outside `public/` so the static handler never streams them. Future: Vercel Blob or S3. |
| Payment methods + subscriptions | Stripe | They're certified for this; we're not. We see only `entitlements` rows synced from webhooks. |
| Entitlements (which tier this user has on this workspace) | Turso/libSQL `entitlements` | Highest non-expired row wins per `(userId, workspaceId)`. Resolution is in `getEffectiveTier`. |
| Comp / promo codes | Turso/libSQL `comp_codes` + `entitlements` | Mint once, redeem decrements quantity, inserts entitlement. |
| Share-link tokens + visit log | Turso/libSQL `share_links` / `share_link_visits` | Read-only public access by token. Visit counter for analytics + sparkline. |
| Notifications + prefs | Turso/libSQL `notifications` / `notification_prefs` | Anti-notification stance: only @mentions + direct blocks land here. Daily digest is the only broadcast channel. |
| Stripe webhook idempotency | Turso/libSQL `processed_webhooks` | Prevents double-grant on Stripe re-deliveries. |
| GTM roadmap state | Turso/libSQL `roadmap_items` / `blockers` / `action_items` | Operator surface at `/roadmap`. Source-of-truth markdown is in `docs/gtm-plan.md`; the parser keeps the table in sync. |
| Errors + traces | Sentry | Configured via `instrumentation.ts` + `instrumentation-client.ts`. PII redaction on the way (action item AI-sec-pii-logging). |
| Analytics events | PostHog | Single `signup_completed` event today; more as the funnel matures. Cookie-less mode preferred. |
| Transactional email | Resend | Daily digest, weekly digest, share-link invites, student-code redemption. |

## What we do NOT store

- **Card numbers.** Stripe does. We have a `customerId` and a Stripe-issued reference; that's it.
- **Plain-text passwords.** Clerk hashes; we never receive.
- **OAuth tokens for third parties.** No Google/Slack/Notion sync — by design (the `/principles` refusal list keeps it that way).
- **Behavioral surveillance.** No fingerprinting. PostHog runs cookieless when configured. No session replay tooling at launch (Hotjar/Clarity/FullStory all flagged action items, all marked deferred).

## Data flow on signup

1. User hits `/sign-up`. Clerk handles the form.
2. Clerk fires `user.created` webhook → `/api/webhooks/clerk` (Svix-signed).
3. Webhook handler: `INSERT INTO users (id, clerk_id, email, name, color, initials)`. If first-time, also creates a default workspace + workspace_members row.
4. PostHog `signup_completed` event fires from the welcome page.
5. `/welcome` runs through onboarding; user enters `/app/board`.

Total round-trip: <500ms in steady-state. Workspace seed runs on first request hit.

## Data flow on purchase

1. User hits a `<TierCta>` on `/pricing`. Server action creates a Stripe Checkout session.
2. User completes Stripe Checkout off-domain.
3. Stripe redirects back to `/welcome?paid=1`.
4. Stripe also fires `checkout.session.completed` webhook → `/api/webhooks/stripe`.
5. Handler verifies Stripe sig, checks `processed_webhooks` for idempotency, then `INSERT INTO entitlements`.
6. `getEffectiveTier(userId, workspaceId)` now returns the new tier. The page revalidates.

## Data flow on attachment upload

1. User drops a file on the detail panel. Optimistic placeholder appears immediately.
2. Client calls `uploadAttachmentAction(taskId, formData)` (server action).
3. Action validates: 25 MB cap, mime blocklist, workspace ownership of the task.
4. File written to `<repo>/.data/uploads/<workspaceId>/<taskId>/<id>-<safe-filename>`. `attachments` row inserts.
5. `recordActivity('attach', { filename, sizeBytes, attachmentId })`. `emitTasksChanged()`. `revalidatePath('/app','layout')`.
6. Download path: `GET /api/attachments/[id]` re-checks auth + workspace, streams via `fs.createReadStream` + `Readable.toWeb`. 404 (not 403) on mismatch — opacity is the right default.

## Backups + retention

**Production runs on Turso/libSQL** (the dedicated `tasks` database via `TASKS_DATABASE_URL` + `TASKS_AUTH_TOKEN`). The runtime client (`src/server/db/index.ts`) **fails closed** on every Vercel deploy — production *and* preview — if `TASKS_DATABASE_URL` is absent, so there is no silent fallback to the local `file:tasks.db`. The committed `tasks.db` and the `file:` URL are now **dev-only, zero-config** conveniences. **Production user data is durable; it is not lost on instance recycle.** The old `AI-data-postgres-decision` P0 is closed — superseded by the Turso migration rather than a Postgres swap.

Durability today:
- Turso persists data outside the Vercel runtime; instance recycles do not touch it.
- Point-in-time recovery via Turso's platform.

Still owed (not blocking):
- A documented restore drill (`AI-data-backups`).
- Confirm the Turso backup/retention window matches the 30-day intent below.

## GDPR — your rights

- **Export** — `/api/me/export` (action item AI-data-gdpr-export) returns a tarball of your tasks/comments/attachments + JSON metadata.
- **Deletion** — delete from settings → cascades through `workspaces` (if owner), `tasks`, `comments`, `attachments` (rows + bytes), `activities`, `entitlements`. Stripe subscription cancelled in the same transaction.
- **Correction** — edit your tasks directly in-product. Email hello@<domain> for account-level corrections.

Data subject access requests: respond within 30 days of `hello@<domain>` mail.

## Where we are vs where we're going

Today's stack (Turso/libSQL + Drizzle) is durable and enough for an indie product at launch traffic. The persistence question is settled — Turso, not Postgres. The one change that still matters once usage grows:

1. **S3 / Vercel Blob for attachments.** Attachment *bytes* still live on local disk (see the attachments-bytes row above), which doesn't survive Vercel's multi-replica model. The seam is `uploadsRoot()` + the streaming read in the API route. This is the remaining durability gap — the row data is safe on Turso, the uploaded files are not.

Other tooling (BigQuery, Mixpanel, dedicated CDN, customer data platform) is explicitly deferred — see `decisions.md`.
