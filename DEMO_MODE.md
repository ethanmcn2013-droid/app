# Demo / Review Mode — Signal Tasks

Tasks ships the suite-wide **access-mode** layer so the product can be publicly
viewed, shared, and reviewed during development without weakening production
auth. Suite-level rationale: `studio/docs/DEMO_REVIEW_MODE.md`.

## Four modes

`SIGNAL_ACCESS_MODE` (server) + `NEXT_PUBLIC_SIGNAL_ACCESS_MODE` (client):

| Mode | Auth | Data |
|------|------|------|
| `production` | Real Clerk session required | Real Turso DB, per-workspace |
| `development` | Keyless dev bypass (existing) | Real DB / legacy seed identity |
| `demo` | **No login wall** | **In-memory seed only** |
| `review` | Same as demo | Same as demo |

Default when unset: `production` under `NODE_ENV=production`, else `development`.

## Safety invariant

Demo/review never query the real DB. `getCurrentUser()`/`getActiveWorkspace()`
resolve to the synthetic `DEMO_USER_ID` / `DEMO_WORKSPACE_ID`, and the read
queries (`getTasks`, `getActiveDomain`, `isFirstRun`, `listMyWorkspaces`, plus
the app-shell workspace lookup) short-circuit to `src/server/demo/tasks-demo.ts`
before any `db` call. No real tenant data is reachable on the demo path.

The demo board is a wedding venue's real Saturday — calm coordination, not a
software sprint board.

## Enable / disable

```bash
cp .env.example .env.local   # set both vars to demo (or review)
npm run dev
```
Preview deploy: set both env vars to `demo`/`review` on the preview env. Keep
the Clerk keys present (Clerk's middleware needs them); demo requires no valid
session and no Turso DB. To restore production auth, set both back to
`production` (or unset — production is the default in a prod build).

## Review routes

- `/app` → `/app/tasks` (seeded venue board)
- `/app/tasks/list`, `/app/tasks/timeline`, `/app/tasks/calendar`, and
  `/app/inbox` use the same seed
- `/app/timeline` is the separate Timeline product owner workspace
- `/app/signal` is the Signal briefing product
- `/` marketing homepage; `/for/*` audience pages (already public)
- `/sign-in` and `/sign-up`, inert auth review cards; no Clerk session
- `/invite/review-valid`, `/invite/review-expired`, invite states
- `/redeem/REVIEW-SUCCESS`, `/redeem/REVIEW-EXPIRED`, redemption states
- `/share/review-the-orchard`, read-only shared board

Suite hub: `https://signalstudio.ie/review`.

## Read-only behavior

- Task mutations return a fresh copy of the deterministic demo board without
  querying or changing Turso. Subtasks, conversations, attachments, and overdue
  work return empty fixtures.
- Cross-workspace search filters the in-memory demo board. Workspace selection
  is an inert success, and attachments never write to local disk.
- The venue-redemption success route renders its sponsor welcome from the demo
  fixture, without reading or stamping entitlement records.
