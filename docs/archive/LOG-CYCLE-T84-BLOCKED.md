# log-cycle T·84 — BLOCKED on missing env vars

Date: 2026-06-09
Agent: Claude Code (Opus 4.7)

## Command attempted

```
node scripts/log-cycle.mjs \
  --cycle 84 \
  --title "single-key X mark-done, From Notes provenance, brand-voice 404s, recurrence toast" \
  --date 2026-06-09 \
  --description "Six friction points removed in one pass. Single-key X toggles complete on the focused card; a From Notes chip surfaces task.sourceNoteId provenance in the detail-panel header; Notes-extract 404s rewritten in BRAND.md §3 voice; the composer no longer silently no-ops on unsupported recurrence (quiet toast on both shapes); the dead sidebar collapse chevron is gone; and /app/hero-compare plus both A/B hero variants are deleted."
```

## Exact error

```
TURSO_DATABASE_URL not set — check .env.local
```

(Surfaced by running `npx tsx scripts/log-cycle.ts` directly; the
`.mjs` wrapper exited 1 with no captured output under this shell.)

## What's missing

`scripts/log-cycle.ts` calls `dotenv` against `.env.local` and `.env`
in the tasks repo root, then reads:

- `TURSO_DATABASE_URL` — required; the libsql endpoint for the shared
  roadmap Turso DB
- `TURSO_AUTH_TOKEN` — required for any non-public DB; not validated
  with an explicit error but the libsql client will reject writes
  without it
- `PORTFOLIO_OWNER_USER_ID` — optional; defaults to the literal
  string `"portfolio"`

Neither `.env` nor `.env.local` exist in `tasks/` root, and neither
var is set in the current shell environment.

## What the operator needs to do

Set the two vars in the shell before re-running, OR drop a
`.env.local` in `C:\Users\ethan\signal-studio-workspace\tasks\` with:

```
TURSO_DATABASE_URL=libsql://<roadmap-db-host>
TURSO_AUTH_TOKEN=<token>
```

Then re-run the `node scripts/log-cycle.mjs ...` command above. The
script is idempotent on workspace-row insert and auto-suffixes the
task id if `tasks-c84` already exists, so a re-run is safe.

This file is informational and can be deleted once the ritual is
re-run successfully.
