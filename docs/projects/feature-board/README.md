# Feature board — proposal

**Status:** proposal, awaiting operator decision
**Raised:** 2026-08-27

## What this is

An operator report proposing a live feature board for Signal Studio, built
as a machine-checked registry rather than a hand-maintained page. The report
carries a working 48-entry prototype seeded from a scan of this repo.

Source: `ceo-report.html`. Published as an artifact styled with the vendored
Signal DS token values, per the guide convention in `CLAUDE.md`.

## The three findings that opened it

Each one is a file in this repo, not an opinion.

1. **Nudges are live and were believed unbuilt.**
   `src/lib/nudges/generate-nudges.ts` holds seven rules and runs server-side
   on `/app/inbox` and `/app/my-tasks`. No dispatch entry names it and no test
   file covers the generator — which is how it went invisible.

2. **The marketing site sells presence the app does not have.**
   `src/components/marketing/features.tsx` promises cursors, card locking and
   typing indicators. `CursorsLayer` is imported only by
   `src/components/showcase/cinematic-demo.tsx`, which is imported only by the
   marketing hero. Realtime itself is real but deliberately off in production
   — see the comment in `src/app/api/events/route.ts`.

3. **Dependencies are half-shipped.**
   `blockedBy` is in the schema, feeds the analytics provider and drives the
   briefing's `dependency-stall` trigger.
   `src/components/app/blockers/blocker-badge.tsx` has no importer.

## Proposed shape

- `content/features/<id>.md` — one file per feature, the single registry.
- `scripts/check-features.mjs` — five gate rules (route truth, orphan check,
  dispatch binding, marketing truth, 90-day staleness), wired into the `test`
  chain beside the nine existing `check-*` gates.
- `/app/features` — the board, generated from the registry at build, deep
  linking into demo mode.
- Consumers: the board, marketing features, pricing gates, the dispatch, and
  the Signal HQ sync table in `AGENTS.md`.

Nothing here is built yet. This directory holds the argument and the
prototype only.

## Evidence

Captured from the prototype in Chromium at 2x, after the final code state.

| Capture | What it shows |
|---|---|
| `evidence/board-desktop-light.png` | Full board, 1280x900, light |
| `evidence/board-desktop-dark.png` | Full board, 1280x900, dark |
| `evidence/board-cut-lane-receipt-open.png` | Cut lane filtered, one receipt open |
| `evidence/board-mobile-390.png` | 390x844, zero horizontal overflow |
