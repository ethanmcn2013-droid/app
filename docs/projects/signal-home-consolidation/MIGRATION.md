# Migration — Signal → Home consolidation

## Old behaviour
- Four products presented everywhere: Notes, Tasks, Timeline, Signal.
- `/app` redirected to `/app/your-work` (planning flag) or `/app/tasks`.
- `/app/signal` rendered the Signal brief (quiet ledger; flag-gated
  analytics path), with `/app/signal/onboarding` and
  `/app/signal/settings/notifications`.
- Suite pills, mobile nav, command palette, marketing nav, pricing,
  sitemap all enumerated four products. Studio `/signal` was a product
  marketing page (sitemap priority 0.9, CTA → waitlist).

## New behaviour
- Three products; Home at `/app/home` is the authenticated front door
  (Today's Signal ≤3 items, Coming up, Needs review).
- Full Briefing (the former Signal brief, unchanged internally) at
  `/app/home/briefing` (+ `/onboarding`, `/settings/notifications`).
- `/app` → `/app/home` (suite-context param branch preserved).
- Studio `/signal` → 301 `/features/daily-briefing`.

## Route compatibility

| Old | New | Behaviour |
|---|---|---|
| `/app` | `/app/home` | server redirect (temporary, route-internal) |
| `/app/signal` | `/app/home/briefing` | permanent redirect, query preserved |
| `/app/signal/onboarding` | `/app/home/briefing/onboarding` | permanent redirect, query preserved |
| `/app/signal/settings/notifications` | `/app/home/briefing/settings/notifications` | permanent redirect, query preserved |
| studio `/signal` | studio `/features/daily-briefing` | 301, canonical on target, sitemap swapped |
| `/app/your-work`, `/app/my-tasks`, `/app/inbox` | unchanged | still reachable; no longer the default |

No redirect loops: every legacy path maps to a distinct new path that
renders directly. Redirect tests live beside the route contract tests.

## Data compatibility
- No schema changes in either repo. `dailySignalCadence` (briefing
  email cadence), signal module tables/queries, and
  `venue_usage.signal_actions` keep their names.
- No persisted "last visited product" state exists; nothing to migrate.
- Notification/email deep links that pointed at `/app/signal` resolve
  through the permanent redirects.

## Entitlement compatibility
- Tier-based model only; no Signal SKU, gate, or selectable product
  entitlement exists (D7). No licence records change. Nothing is
  newly granted or revoked by the consolidation.

## Rollback approach
- Single squash-revert per repo branch. No data migrations, no
  destructive renames; the old routes are redirects, so reverting
  restores them as rendered pages with zero data work.

## Deferred cleanup (post-verification)
- Removing the legacy redirect routes (keep ≥1 release).
- Retiring `ProductId "signal"` from types once no consumer needs the
  legacy mapping (not before launch).
- Studio HQ deep internals that narrate the four-product era in
  historical records (kept: history is not rewritten).
