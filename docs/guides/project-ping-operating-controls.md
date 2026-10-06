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

### Warning: uncertain does not mean undone

A timeout, browser close, local Cancel, HTTP abort, missing response or absent receipt alone does not prove that execution did not begin. Do not press Finish or Execute again, create a replacement identity, delete receipt data or restart a process just to clear an uncertain state. Reconcile the original authorized command. If its physical operation is still running, wait for it to settle before treating any lane as available.

## What the pause covers

The source checks the admission control before new Prepare/Begin, before feeding pending audio, before provider send or interpretation, and after awaited authorization/scope work immediately before an executor invocation latch. A pending not-yet-invoked lane may be closed and cannot resume after re-enable. A request that crossed the actual invocation latch is not rolled back by a later pause; the original remains recoverable.

The pause does not remove current authentication, Project membership, archive/deletion fences or receipt authorization. Status, original receipt, owner Cancel and canonical refresh still require their normal checks. A pause never turns a denial or failed refresh into an empty successful response.

## Privacy and evidence

The local control proof uses synthetic rows and injected test callbacks. Keep raw audio, transcript, task titles, tokens, command hashes, actor/session identifiers, provider events, bound SQL and credentials out of operational logs and public issue text. Operational events use fixed stage/outcome/version fields and bounded numeric usage only. Review actual rendered log output with synthetic sentinel values; checking only the fields passed to a logger is insufficient.

This control is not a billing cap. Before any real provider use, separately verify the current account's access, region, processing/retention and deletion terms, credential custody, actual billed usage and a real spend stop. No API entitlement, retention promise or dollar cost follows from a subscription label or synthetic call counter.

## When to stop and escalate

Keep new work paused and use the existing private Delivery Project if any of the following occurs:

- a new request succeeds while the control is paused;
- a closed original resumes after re-enable;
- a request after invocation is reported as undone without original evidence;
- committed receipt history disappears during pause or current Tasks refresh;
- access denial is bypassed or content/credentials appear in operational output;
- a physical provider/executor call remains active after its local timeout.

The founder is the operating owner until a named receiver accepts the handoff. This local pause does not supply staffed incident response. A production operator switch, fleet-wide propagation, live credential disable, provider spend stop, real-user support process, rollback rehearsal and stabilized operating ownership remain separate work and gates.
