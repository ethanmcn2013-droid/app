# Ping Release 2 model evaluation (prepared, provider-off)

This harness prepares a repeatable synthetic-world evaluation for the approved Ping request set. It uses the actual Ping planner/service/store/action adapter, bounded conversation and task context, and canonical conversation/task-discussion services. The 62 fixed model cases always remain drafts and must not produce durable task changes. A separate, explicitly invoked synthetic action check verifies the draft/apply/Undo path. No external delivery or Timeline publish is enabled.

The synthetic world is Orla Byrne in **The Orchard, events**, with Niamh Kelly, Aoife Walsh and Dara Quinn. It is based on the fixed prototype data and dated Thursday 16 July 2026. Direct conversations are accepted synthetic pairs and chat evidence is written through the canonical services. Task conversations are canonical task discussions. The project conversation includes the venue-calendar facts needed by F39/F44, serialized from the approved prototype's member-visible `EVENTS` data and adjacent venue run-sheet/task records (`docs/projects/chat-ping-redesign/prototype/signal-chat.html:675-686`); the dates are the prototype's Thursday 16 July 2026 reference plus its stated offsets. This is project-context data, not a couple conversation. No guest workspace or couple chat is created, and no guest-only messages are copied. Request H56 is held as unsupported and remains in the score denominator; it is not sent to a model.

## Dry run

From the repository root, make a new output name each time:

```powershell
pnpm exec tsx experience/ping-assistant/release2-model-eval.ts --dry-run --output experience/output/ping-release2-model-eval/dry-run-2026-10-21-a.json
```

The dry run migrates an isolated temporary proof database, seeds the synthetic world, prints the exact case inventory, verifies its task baseline, and makes **zero provider calls**. It reads no API key or scope admission. Output is constrained to a unique JSON path under the ignored `experience/output/ping-release2-model-eval/` directory.

## Live admission (prepare-only; requires later explicit approval)

Live evaluation requires both `PING_RELEASE2_MODEL_EVAL_AUTHORIZED=1` and an explicit `--scope-file` admission, plus a caller-supplied absolute `--key-file`. The admission must name the exact synthetic actor/project, Sonnet 5.5, 63 maximum physical attempts, a $4 new-evaluation accounted-spend cap, a $5 provider workspace monthly cap, disabled external delivery/Timeline publishing, and an unexpired timestamp. The runner enforces the $4 evaluation cap across observed usage plus outstanding reservations; unknown usage stays reserved. The key file is read only after all admission checks. The generic `ANTHROPIC_API_KEY` environment variable is never read. Calls are allowlisted to `https://api.anthropic.com/v1/messages`, sequential, without automatic retries/fallback, with redirects refused. Production/hosted execution is refused.

The evaluated prompt sequence contains 62 fixed requests plus a second, separately captured A2 setup request because the prototype resets before each group: 63 prompts in all. H56 is held without a provider call, making 62 actual calls the expected maximum. B11, B12 and C17 are still sent and stay in the denominator; their score is held to the safety rule that text such as “go ahead” can never apply a plan. The UI Apply control remains the only approval path, and no typed Undo action is claimed.

The planner reserves a maximum of $2.16384 before each attempt (up to 1,000,000 input and 16,384 output tokens). That fits within the $4 evaluation cap. Usage observations replace the corresponding reservation; unconfirmed usage retains its reservation. The existing workspace has spent less than $1 this month; the $4 evaluation cap leaves room within its $5 workspace limit. The provider-side workspace cap is an additional backstop. The harness does not independently authorize or configure that cap.

## Evidence and scoring

Each row records exact prompt and expected behavior, request/run identifiers, sanitized planner attempt telemetry, model plan, service view, source coverage, timing, observed usage and before/after durable task-state hashes. Raw API credentials, unrelated environment values and provider error bodies are never written. A whole-run baseline/final task digest must match because all model requests remain drafts. Partial output is atomically replaced after each completed live case so an interruption does not lose completed evidence. There are 62 fixed cases in the scoring denominator; H56 and safety-held cases are visible as held rows, never silently deleted. The independent reviewer—not the runner—assigns pass/weak/fail from `docs/projects/chat-ping-redesign/ping-eval.md` and the Ping scorecard.

Before any key is read, the runner validates every seeded context against the production projection. Before each planner attempt it checkpoints the database path and exact pending run identity. If the process exits without a settled receipt, preserve that database and its reservation; a pending or missing dispatch observation does not establish that no request was sent or billed. Do not restart the full evaluation or replay the unconfirmed request. Reconcile observed usage and unknown reservations against the original admission before any separately authorized continuation.

An isolated action adapter check can run separately without a model/provider call:

```powershell
pnpm exec tsx experience/ping-assistant/release2-model-eval.ts --action-check --output experience/output/ping-release2-model-eval/action-check-2026-10-21-a.json
```

It drafts one synthetic task, confirms draft caused no change, explicitly applies it through the actual action adapter, then invokes actual Undo and verifies the fixture returns to baseline. It uses the same canonical source-revalidation callback as live evaluation, so sourced plans fail closed if their exact authorized source has changed. This is separate from, and not scored as part of, the model cases.

Use a fresh unique output path per run. Preserve every failed or interrupted run and its original denominator; do not overwrite or relabel it.
