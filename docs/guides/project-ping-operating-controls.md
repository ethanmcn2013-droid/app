# Project Ping operating controls

This guide covers the narrow **new-work pause** used by Project Ping. The pause prevents new requests from entering the feature while keeping authorized checks for an existing original command available. It does not undo a committed task change, guarantee that an already-started provider request stopped, or provide a production-wide kill switch.

## Before using the control

Project Ping is an internal construction until its separate access, privacy, provider, pilot and release gates are accepted. The default is unavailable. Do not enable it against production data, a hosted database or an unverified provider. Use only the marked disposable local fixture for the operating-control proof.

The current isolated runtime still needs its existing explicit fixture opt-in and marked temporary database. The separate `PING_NEW_WORK_PAUSED` value has these meanings within the process that reads it:

| Value | Admission behavior |
| --- | --- |
| Unset or exactly `0` | New work may enter if every existing runtime, authentication and isolation check also succeeds. |
| Exactly `1` | Pause new work. |
| Any other value, or a control callback that throws | Fail closed and pause new work. |

The shared runtime checks admission again at sensitive boundaries. This is a per-process source control; changing one process does not prove every running process or deployment received the setting. No protected deployment control, credential disable path, provider billing stop or fleet propagation is claimed by this guide.

## Pause and recover

1. Set the new-work control to pause and record the exact source revision and setting state in the private execution record. Do not record a secret, token, task content or customer identifier.
2. Confirm on the disposable fixture that a new typed request or voice Begin is refused before it creates an original, opens a provider transport or requests microphone permission.
3. Check any existing original only with its authenticated recovery action. A confirmed `not_invoked` result means that original will not later be resumed. An already-invoked original remains pending until the real call settles; after settlement, read its same receipt and current canonical Tasks view.
4. If the receipt is committed but refresh is unavailable, preserve the receipt and retry only the bounded authenticated current-state read. Do not submit a new command to reproduce the change.
5. If status or receipt access is denied, retain that as an access-denied result. Do not use another actor, token, Project or identity to get around the denial.
6. Keep new work paused while the failure is understood and the affected exact-source checks pass. Re-enable only after the operator has verified the repair in the disposable fixture. Re-enabling permits fresh requests only; it does not revive a capture closed by the pause.

### If original recovery is no longer available

Custody lanes and their read counters are held in the running process. A process exit can make a lane token unavailable even when a durable task write or receipt exists; a restart does not prove whether a physical operation committed. Preserve the existing durable store and the private original evidence. Do not delete or replace the database, recreate a command, remint a token, replay execution, or use a different actor or Project to manufacture access. If the same authorized original cannot be recovered, record the outcome as unresolved; keep a verified denial as access-denied.

Each lane allows at most 24 authorized receipt/reconciliation reads and three canonical refreshes. When a limit is exhausted, stop trying that lane. The lack of another read is not proof of absence, no effect, rollback or successful refresh. Leave admission paused and transfer the original evidence to the named authorized operator for same-original investigation through an existing approved path. This does not create a new recovery endpoint or guarantee crash recovery. Do not bypass current authentication or membership checks.

For an incident record, capture only: exact source revision; target class (disposable fixture or approved environment); pause setting state; fixed failure stage/outcome; whether invocation and physical work are known, unknown or settled; whether receipt and current projection are confirmed; private evidence reference; responsible operator; accepting receiver if one exists; and next review time. Keep command tokens, task content, transcripts, actor/session identifiers, command hashes, SQL bindings and credentials out of logs and broadly shared records.

### Warning: uncertain does not mean undone

A timeout, browser close, local Cancel, HTTP abort, missing response or absent receipt alone does not prove that execution did not begin. Do not press Finish or Execute again, create a replacement identity, delete receipt data or restart a process just to clear an uncertain state. Reconcile the original authorized command. If its physical operation is still running, wait for it to settle before treating any lane as available.

## What the pause covers

The source checks the admission control before new Prepare/Begin, before feeding pending audio, before provider send or interpretation, and after awaited authorization/scope work immediately before an executor invocation latch. A pending not-yet-invoked lane may be closed and cannot resume after re-enable. A request that crossed the actual invocation latch is not rolled back by a later pause; the original remains recoverable.

The pause does not remove current authentication, Project membership, archive/deletion fences or receipt authorization. Status, original receipt, owner Cancel and canonical refresh still require their normal checks. A pause never turns a denial or failed refresh into an empty successful response.

## Existing proof map and commands

This map points to existing focused checks; it is not a claim that they passed on a future candidate. Re-run the appropriate command against the exact candidate and retain that run's output. Programme release gates remain separate.

| Failure class | Existing focused evidence | Command |
| --- | --- | --- |
| Wrong target, stale selection or extra authority | `src/server/ping/command-service.persistence.test.ts` (stale readset, missing/foreign selection, config drift); `src/server/ping/typed-session.test.ts` (forged identity/session and stale preimage) | `pnpm test:ping`; `pnpm test:ping-typed` |
| Partial input, unsupported suffix or extra effect | `src/lib/ping/input-protocol.test.ts` (unflushed tail, wrong item/finality and conflicting completion); `src/lib/ping/typed-command.test.ts` (unknown suffix, mixed/destructive clause and duplicate effect) | `pnpm test:ping-input`; `pnpm test:ping-typed` |
| Duplicate, replay, lost response or unknown outcome | `src/server/ping/command-service.persistence.test.ts`, `src/server/ping/bridge-independent.persistence.test.ts`, and `src/server/ping/typed-session.test.ts` (original-intent recovery without a second execution) | `pnpm test:ping`; `pnpm test:ping-bridge`; `pnpm test:ping-typed` |
| Revoked access or false completion | `src/server/ping/bridge.persistence.test.ts` (revocation and projection divergence); `src/server/ping/typed-session.test.ts` (fresh-scope refusal and relevant divergence) | `pnpm test:ping-bridge`; `pnpm test:ping-typed` |
| Cancel before/after invocation and unresolved physical work | `src/lib/ping/input-protocol.test.ts`, `src/server/ping/bridge-independent.persistence.test.ts`, and `src/server/ping/typed-session.test.ts` | `pnpm test:ping-input`; `pnpm test:ping-bridge`; `pnpm test:ping-typed` |

For the integrated isolated receiving flows, reuse [`experience/ping-voice-tasks/README.md`](../../experience/ping-voice-tasks/README.md) and the existing `pnpm test:ping-voice:tasks-browser` command. The typed mounted-flow command is `pnpm test:ping-typed:browser`. These synthetic fixtures do not replace real authentication, provider, pilot or release acceptance.

## Privacy and evidence

The local control proof uses synthetic rows and injected test callbacks. Keep raw audio, transcript, task titles, tokens, command hashes, actor/session identifiers, provider events, bound SQL and credentials out of operational logs and public issue text. Operational events use fixed stage/outcome/version fields and bounded numeric usage only. Review actual rendered log output with synthetic sentinel values; checking only the fields passed to a logger is insufficient.

This control is not a billing cap. Before any real provider use, separately verify the current account's access, region, processing/retention and deletion terms, credential custody, actual billed usage and a real spend stop. No API entitlement, retention promise or dollar cost follows from a subscription label or synthetic call counter.

## Privacy requests and rollback limits

This operating guide is not a privacy-request intake channel. Route a request through the currently approved privacy process to its authorized owner. Assess separately: application-store data and any approved deletion action; provider-side content, retention and deletion, which remain unverified until the provider's own terms and evidence support the claim; and the minimum execution/evidence record that must be preserved under the applicable retention decision. A local transcript wipe or missing application row does not prove provider deletion. Do not erase receipts, original evidence or a database to make an unresolved case appear complete; restrict access and let the authorized privacy owner decide the evidence-preservation path.

Ping provides no general undo or rollback for a committed task change. A later pause prevents eligible new work but cannot reverse an already committed mutation or guarantee cancellation of a physical call. Preserve its receipt and report current Tasks projection. Any corrective change must use the normal authorized Tasks path as a separate action with its own review and evidence; never dispatch an automatic inverse or label it rollback.

## Proposed synthetic tabletop (not performed)

Use only the marked disposable fixture, synthetic identities and injected callbacks. Do not use live provider credentials, customer data, production storage or billable services. Walk through these bounded scenarios without adding a retry path:

1. Hold an executor after its invocation latch, pause new work, verify a fresh request is refused and the original remains pending; release the held call, then recover only its same receipt and canonical projection. Confirm no second invocation occurs.
2. Simulate loss of the process-local lane or exhaustion of its read/refresh budget. Preserve the durable fixture and original evidence; record unresolved or access-denied; hand off to the named operator. Confirm no restart, database replacement, new token or replay is used to clear the state.
3. Revoke current membership before receipt recovery. Verify the denial stays a denial, and do not change actor or Project. Record who owns the next authorized action.
4. Introduce a synthetic privacy request while the outcome is unresolved. Route it to the approved privacy owner and separately note application-store, provider-deletion and evidence-preservation decisions; leave any unavailable provider evidence pending.

Record the tabletop as proposed until an operator actually performs it. Its private result should contain source revision, scenario, injected condition, fixed outcome, invocation certainty, synthetic call/receipt counts, projection state, evidence reference, operator and next review only. This guide supplies no staffed incident response, production fleet control, credential shutdown, verified spend stop or general rollback.

## When to stop and escalate

Keep new work paused and use the existing private Delivery Project if any of the following occurs:

- a new request succeeds while the control is paused;
- a closed original resumes after re-enable;
- a request after invocation is reported as undone without original evidence;
- committed receipt history disappears during pause or current Tasks refresh;
- access denial is bypassed or content/credentials appear in operational output;
- a physical provider/executor call remains active after its local timeout.

The founder is the operating owner until a named receiver accepts the handoff. This local pause does not supply staffed incident response. External pilot/G4 acceptance, a production operator switch, fleet-wide propagation, live credential disable, provider spend stop, real-user support, rollback rehearsal and multi-week stabilized operating evidence remain pending under the approved plan.
