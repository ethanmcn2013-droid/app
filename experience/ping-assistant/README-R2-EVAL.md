# Ping Release 2 model evaluation (prepared, provider-off)

This harness prepares a repeatable synthetic-world evaluation for the approved Ping request set. It uses the actual Ping planner/service/store/action adapter, bounded conversation and task context, and canonical conversation/task-discussion services. The 62 fixed model cases always remain drafts and must not produce durable task changes. A separate, explicitly invoked synthetic action check verifies the draft/apply/Undo path. No external delivery or Timeline publish is enabled.

## Grouped execution and restart safety

Live model work is split into one short-lived process per fixed group, A through I. Every invocation creates a fresh disposable database and closes it at exit; B includes the separate `B-SETUP-A2` prompt to establish its waiting plan. H56 remains in the fixed denominator as a no-call guest boundary. The full run is capped at **63 physical calls across the chain**, including setup, not 63 per process. A group is admitted as a prior only when its output is complete, all physical attempts are settled with observed usage, the full ordered prompt/expectation/held inventory matches, the exact scope and source fingerprint matches, and every earlier group's artifact hash verifies. That SHA-256 fingerprint covers this runner, the fixed fixture and scoring inputs, and the transitive planner, authorization, context, state-binding, time-resolution, and write-path modules used by evaluation. Any missing, reordered, modified, incomplete, pending, or usage-unknown group stops before the API key is read. There are no automatic retries or fallback models.

Group A starts a new chain. To execute B through I, pass the immediately preceding completed report with `--prior-results`; the report links to its own prior report by SHA-256 so the runner checks the entire prefix back to A. Each group's reported call count and spend are cumulative across that chain. Example shape (paths must be unique and remain under the ignored output directory):

```powershell
node --import tsx --import ./src/test/register-server-only.mjs experience/ping-assistant/release2-model-eval.ts --group A --scope-file <approved-scope.json> --key-file <private-key-file> --output experience/output/ping-release2-model-eval/new-A.json
node --import tsx --import ./src/test/register-server-only.mjs experience/ping-assistant/release2-model-eval.ts --group B --prior-results experience/output/ping-release2-model-eval/new-A.json --scope-file <same-approved-scope.json> --key-file <private-key-file> --output experience/output/ping-release2-model-eval/new-B.json
```

Repeat for the next letter, always using the preceding report and the exact same scope file. Do not start another group when the preceding run is missing `finishedAt`, has `pendingAttempt` or a blocked continuation, has an unobserved usage record, or failed its final draft-state check. Never replay a pending request. The saved round-3 run ended with an unconfirmed F33 attempt and is deliberately not a valid chain input; its earlier rows remain preserved as evidence and are not regraded or silently continued.

The synthetic world is Orla Byrne in **The Orchard, events**, with Niamh Kelly, Aoife Walsh and Dara Quinn. It is based on the fixed prototype data and dated Thursday 16 July 2026. Direct conversations are accepted synthetic pairs and chat evidence is written through the canonical services. Task conversations are canonical task discussions. The project conversation includes the venue-calendar facts needed by F39/F44, serialized from the approved prototype's member-visible `EVENTS` data and adjacent venue run-sheet/task records (`docs/projects/chat-ping-redesign/prototype/signal-chat.html:675-686`); the dates are the prototype's Thursday 16 July 2026 reference plus its stated offsets. This is project-context data, not a couple conversation. No guest workspace or couple chat is created, and no guest-only messages are copied. Request H56 is held as unsupported and remains in the score denominator; it is not sent to a model.

## Dry run

From the repository root, make a new output name each time:

```powershell
node --import tsx --import ./src/test/register-server-only.mjs experience/ping-assistant/release2-model-eval.ts --dry-run --output experience/output/ping-release2-model-eval/dry-run-2026-10-21-a.json
```

The dry run migrates an isolated temporary proof database, seeds the synthetic world, prints the exact case inventory, verifies its task baseline, and makes **zero provider calls**. It reads no API key or scope admission. Add `--group A` to inspect one group's exact inventory, or pass a completed prior report with `--group <next-letter> --prior-results <report>` to check chain admission. Output is constrained to a unique JSON path under the ignored `experience/output/ping-release2-model-eval/` directory.

## Live admission (prepare-only; requires later explicit approval)

No new live admission or provider call is authorized by this preparation. The prior `$4` evaluation / `$5` workspace admission applies only to the preserved earlier evidence. A future grouped run needs a newly approved admission with version 2, exact synthetic actor/project, Sonnet 5.5, 63 maximum physical attempts, a **$5 new-evaluation accounted-spend cap**, a **$10 provider workspace monthly cap**, external delivery and Timeline publishing disabled, and an unexpired timestamp. Approval, credential availability, and the provider-side cap must be confirmed separately before any live use. Each group uses the same exact admission file; its SHA-256 is bound into the chain. The runner enforces the evaluation/workspace cap against cumulative observed usage and current outstanding reservations. The key file is read only after every chain and scope check. The generic `ANTHROPIC_API_KEY` environment variable is never read. Calls are allowlisted to `https://api.anthropic.com/v1/messages`, sequential, without automatic retries/fallback, with redirects refused. Production/hosted execution is refused.

The evaluated prompt sequence contains 62 fixed requests plus a second, separately captured A2 setup request because the prototype resets before group B: 63 prompts in all. H56 is held without a provider call, making 62 actual calls the expected maximum. B11, B12 and C17 are still sent and stay in the denominator; their score is held to the safety rule that text such as “go ahead” can never apply a plan. The UI Apply control remains the only approval path, and no typed Undo action is claimed.

The planner reserves a maximum of $2.16384 before each attempt (up to 1,000,000 input and 16,384 output tokens). Grouped runs carry observed spend forward and leave unconfirmed usage reserved; a chain cannot proceed while that reservation is unresolved. The runner does not establish current provider workspace spend or configure the provider-side cap.

## Evidence and scoring

Each row records exact prompt and expected behavior, request/run identifiers, sanitized planner attempt telemetry, model plan, service view, source coverage, timing, observed usage and before/after durable task-state hashes. Raw API credentials, unrelated environment values and provider error bodies are never written. A group baseline/final task digest must match because all model requests remain drafts. Partial output is atomically replaced after each completed live case so an interruption does not lose completed evidence. There are 62 fixed cases in the scoring denominator; H56 and safety-held cases are visible as held rows, never silently deleted. The independent reviewer—not the runner—assigns pass/weak/fail from `docs/projects/chat-ping-redesign/ping-eval.md` and the Ping scorecard.

Before any key is read, the runner validates every seeded context against the production projection. Before each planner attempt it checkpoints the database path and exact pending run identity. If the process exits without a settled receipt, preserve that database and its reservation; a pending or missing dispatch observation does not establish that no request was sent or billed. Do not restart the full evaluation or replay the unconfirmed request. Reconcile observed usage and unknown reservations against the original admission before any separately authorized continuation.

An isolated action adapter check can run separately without a model/provider call:

```powershell
pnpm exec tsx experience/ping-assistant/release2-model-eval.ts --action-check --output experience/output/ping-release2-model-eval/action-check-2026-10-21-a.json
```

It drafts one synthetic task, confirms draft caused no change, explicitly applies it through the actual action adapter, then invokes actual Undo and verifies the fixture returns to baseline. It uses the same canonical source-revalidation callback as live evaluation, so sourced plans fail closed if their exact authorized source has changed. This is separate from, and not scored as part of, the model cases.

Use a fresh unique output path per run. Preserve every failed or interrupted run and its original denominator; do not overwrite or relabel it.
