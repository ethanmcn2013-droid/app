# Corrected Release 2 model cohort — group A partial review

Reviewer: Codex independent reviewer (`/root/r2_independent_review`). Date: 21 October 2026. Read-only; no provider calls, credentials, or data mutations by this review.

Artifact reviewed: `experience/output/ping-release2-model-eval/grouped-qualified-oct21-A.json`.

## A1 — pass

Fixed request: “add a task for aoife to restock the bar fridge by saturday”. The draft contains one `create_tasks` step titled “Restock the bar fridge”, assigned to Aoife Walsh, due Saturday. The fixture date is Thursday 16 July 2026, so this resolves to Saturday 18 July as expected. The UI-facing run says “Draft prepared. No actions were executed.” Before/after active and all-row task hashes are identical. Provider attempt settled with HTTP 200 and `end_turn`; estimated cost is $0.040184. Observed planning time is 5.141 seconds and total local wall time 5.187 seconds.

## A2 — pass

Fixed request: “remind me to call the florist tomorrow at 10”. The draft contains one “Call the florist” task, assigned to self (Orla), due tomorrow at 10:00. This matches the 16 July 2026 fixture clock. The run remains draft-only; before/after task hashes are identical. Provider attempt settled with HTTP 200 and `end_turn`; estimated cost is $0.040246. Observed planning time is 4.480 seconds and total local wall time 4.562 seconds.

## Scope and status

These are two independent passes in the corrected cohort. They do not change the preserved earlier 23/7/2 score. Group A is incomplete: A3 has an initial pending marker and a separate reconciliation assessment at `grouped-A3-reconciliation-review.md`; A4–A6 have not been run. No group or overall acceptance score is issued. Both passing model calls are much slower than the desired sub-second target.
