# Stripe setup — cross-product checkout

Operator runbook for activating real paid checkouts via the
`signalstudio.ie/pricing` -> Tasks `/api/checkout` flow (E-7).

Current state (audited 2026-05-14): **no Stripe env vars set on
Tasks Vercel**. `createCheckoutSessionAction` therefore falls
through to the dev-fallback path, which grants the entitlement
locally without taking payment. Fine for dev; not the prod behaviour
you want once the umbrella pricing page is broadcast.

## 1 · Stripe dashboard

The public pricing page (signalstudio.ie/pricing) sells two tiers
self-serve: Workspace (monthly subscription) and Event (one-time).
Free and Student take no payment. Studio (operator tier) and Wedding
(venue-comp tier) are not on the public surface — both are granted
manually via `/api/internal/entitlements/grant` (Studio) or the comp-
code flow (Wedding), so neither needs a Stripe price.

In <https://dashboard.stripe.com>, create products + prices:

| Product       | Type           | Recurring | Currency | Amount   | Env var                            |
|---------------|----------------|-----------|----------|----------|------------------------------------|
| Workspace     | Subscription   | Monthly   | EUR      | €12.00   | `STRIPE_PRICE_WORKSPACE_MONTHLY`   |
| Event         | One-time       | —         | EUR      | €89.00   | `STRIPE_PRICE_EVENT_ONETIME`       |

(`STRIPE_PRICE_PRO_MONTHLY` is a legacy alias in code for
`STRIPE_PRICE_WORKSPACE_MONTHLY` — set the new name; the alias only
fires if the new one is unset.)

## 2 · Webhook

Create a webhook endpoint at:

```
https://tasks.signalstudio.ie/api/webhooks/stripe
```

Subscribe to these events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the signing secret — you'll need it in step 3.

## 3 · Env vars

Set on the **tasks** Vercel project, Production:

```
STRIPE_SECRET_KEY=sk_live_...                    # or sk_test_* in sandbox
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_WORKSPACE_MONTHLY=price_...
STRIPE_PRICE_EVENT_ONETIME=price_...
```

Preview environments can use Stripe test-mode keys (`sk_test_*` +
`whsec_test_*`) with separate price IDs — same env-var names, just
scoped to Preview rather than Production.

## 4 · Smoke test

After redeploy:

1. Visit <https://signalstudio.ie/pricing>.
2. Click **Start a workspace** (Workspace tier CTA).
3. Sign in if not already. Land on Stripe checkout. Pay with a real
   card or `4242 4242 4242 4242` in test mode.
4. Return to Tasks. Run `turso db shell ethanmcnamara-tasks` and:
   ```sql
   SELECT user_id, tier, source, started_at FROM entitlements
   ORDER BY started_at DESC LIMIT 1;
   ```
   New row should appear with `tier=workspace, source=purchase`.
5. Also check the shared DB:
   ```sql
   turso db shell signal-entitlements
   SELECT user_clerk_id, tier, source FROM entitlements
   ORDER BY created_at DESC LIMIT 1;
   ```
   The same grant should appear with `source=workspace_subscription`
   (vocab translation by `toSharedSource()` in `billing.ts`).
6. On any other product subdomain (roadmap / analytics / notes),
   the tier read via `resolveEntitlement()` should now return the
   new tier.

## 5 · Failure modes you'll see

- **Webhook signature mismatch**: usually means `STRIPE_WEBHOOK_SECRET`
  is unset OR the Stripe dashboard webhook URL doesn't match the
  redeploy target. Stripe's webhook dashboard surfaces the rejection.
- **Local row but no shared row**: the dual-write mirror failed.
  `E-3.3` reconcile cron (Tasks `/api/cron/digest`) picks it up next
  daily run.
- **No row at all**: `createCheckoutSessionAction` returned early on
  no-stripe-key; check that `STRIPE_SECRET_KEY` is actually set and
  redeploy.
