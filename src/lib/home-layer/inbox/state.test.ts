/**
 * InboxEvent · the two independent axes, and source-action receipts.
 *
 * Assertions I6–I8 and I14–I16 of
 * `docs/projects/home-operating-layer/contracts/INBOX_EVENT.md` §18.
 *
 * THIS FILE IS EXPECTED TO FAIL AT `78021c5`. There is no state machine: the
 * only Inbox state in the product is a localStorage set of dismissed nudge ids
 * (`src/components/app/inbox/inbox-app.tsx:207-217`), and `notifications.read_at`
 * has no writer anywhere (`src/server/db/queries.ts:574` reads it;
 * `audit/B-domain-permissions.md:333-337` records that nothing writes it).
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/inbox/state.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import { READ_REASONS_ALLOWED, READ_REASONS_REFUSED } from "./contract";
import {
  applyReceipt,
  arrivalState,
  markRead,
  reconcile,
  setDisposition,
} from "./state";

const NOW = Date.parse("2026-08-12T10:00:00.000Z");
const LATER = NOW + 3_600_000;

function arrival() {
  return arrivalState("ie-1", "u-ben", NOW);
}

function unwrap<T extends { ok: boolean }>(result: T) {
  assert.equal(
    result.ok,
    true,
    `expected ok, got ${JSON.stringify(result)}`,
  );
  return (result as unknown as { ok: true; state: ReturnType<typeof arrival> })
    .state;
}

// ── I6 · marking read is an allowlist ───────────────────────────────────────

test("I6 · the allowlist is exactly two reasons", () => {
  assert.deepEqual(READ_REASONS_ALLOWED, ["detail-open", "explicit-mark-read"]);
});

test("I6 · an explicit detail open may mark read", () => {
  const state = unwrap(markRead(arrival(), "detail-open", NOW));
  assert.equal(state.visibility, "read");
  assert.equal(state.readReason, "detail-open");
  assert.equal(state.readAt, NOW);
});

test("I6 · hover, prefetch, viewport and auto-selection are refused BY NAME", () => {
  // D-INBOX-09. An allowlist, not a denylist, because a denylist silently
  // admits the next interaction someone invents. The live pressure is real:
  // Inbox rows call `useTaskPanel()` (`audit/C-design-interaction.md:522-523`),
  // a panel that opens on selection.
  for (const reason of READ_REASONS_REFUSED) {
    const result = markRead(arrival(), reason, NOW);
    assert.equal(result.ok, false, `${reason} must be refused`);
    assert.equal(
      typeof (result as { ok: false; refusal: string }).refusal,
      "string",
      `${reason} must be refused with a typed code, not silently ignored`,
    );
  }
  // The specific ones the contract names.
  for (const reason of ["hover", "prefetch", "viewport", "auto-select"]) {
    assert.ok(
      (READ_REASONS_REFUSED as readonly string[]).includes(reason),
      `${reason} must be named in the refusal list`,
    );
  }
});

test("I6 · an unknown reason is refused, not admitted", () => {
  const result = markRead(arrival(), "some-future-interaction", NOW);
  assert.equal(result.ok, false);
});

// ── I7 · reading never resolves ─────────────────────────────────────────────

test("I7 · marking read leaves disposition, snooze and receipts untouched", () => {
  const before = arrival();
  const after = unwrap(markRead(before, "detail-open", NOW));

  assert.equal(after.disposition, before.disposition);
  assert.equal(after.disposition, "open");
  assert.equal(after.dispositionAt, before.dispositionAt);
  assert.equal(after.dispositionReason, before.dispositionReason);
  assert.equal(after.snoozedUntil, before.snoozedUntil);
  assert.equal(after.resolvingAttemptId, null);
});

test("I7 · read + open is a first-class state", () => {
  const state = unwrap(markRead(arrival(), "explicit-mark-read", NOW));
  assert.equal(state.visibility, "read");
  assert.equal(state.disposition, "open");
});

test("I7 · resolving does not mark read", () => {
  // §8.1. Acknowledging without opening leaves `new`, because the person
  // genuinely did not look. Visibility is a record of exposure, not a tidy-up.
  const state = unwrap(setDisposition(arrival(), "acknowledged", "user", LATER));
  assert.equal(state.disposition, "acknowledged");
  assert.equal(state.visibility, "new");
  assert.equal(state.readAt, null);
});

// ── I8 · visibility is monotonic ────────────────────────────────────────────

test("I8 · there is no read -> new transition", () => {
  const read = unwrap(markRead(arrival(), "detail-open", NOW));
  for (const reason of READ_REASONS_ALLOWED) {
    const again = markRead(read, reason, LATER);
    if (again.ok) {
      // Re-marking an already-read item is a no-op, never a downgrade, and
      // never a re-stamp of readAt.
      assert.equal((again as { ok: true; state: typeof read }).state.visibility, "read");
      assert.equal((again as { ok: true; state: typeof read }).state.readAt, NOW);
    }
  }
  assert.equal(
    typeof (markRead as unknown as { markUnread?: unknown }).markUnread,
    "undefined",
    "no mark-unread affordance may exist",
  );
});

test("I8 · reopen is the truthful control, and it lives on the other axis", () => {
  // §8.2. The intent behind "mark unread" is served by reopen, which changes
  // disposition without falsifying the exposure record.
  const read = unwrap(markRead(arrival(), "detail-open", NOW));
  const cleared = unwrap(setDisposition(read, "cleared", "user", LATER));
  const reopened = unwrap(setDisposition(cleared, "open", "user", LATER + 1_000));

  assert.equal(reopened.disposition, "open");
  assert.equal(reopened.visibility, "read", "reopening must not un-read it");
});

test("I8 · the system may not reopen; only the person may", () => {
  // D-INBOX-10. `reconciliation` and `source-receipt` are machine causes.
  const cleared = unwrap(setDisposition(arrival(), "cleared", "user", NOW));
  for (const cause of ["reconciliation", "source-receipt", "arrival"]) {
    const result = setDisposition(cleared, "open", cause, LATER);
    assert.equal(result.ok, false, `${cause} must not reopen a cleared event`);
  }
});

test("I8 · every disposition change records its cause", () => {
  const result = setDisposition(arrival(), "cleared", undefined as unknown as string, NOW);
  assert.equal(result.ok, false, "a disposition with no reason is not writable");
});

// ── I14 · refused and undetermined leave disposition unchanged ──────────────

test("I14 · a refused source action changes nothing", () => {
  const before = arrival();
  const after = unwrap(
    applyReceipt(before, {
      attemptId: "at-1",
      action: "approve",
      idempotencyKey: "idem-1",
      outcome: "refused",
      refusalCode: "not-authorized",
      sourceRevisionAfter: null,
      settledAt: LATER,
    }, LATER),
  );

  assert.equal(after.disposition, "open");
  assert.equal(after.resolvingAttemptId, null);
});

test("I14 · an undetermined outcome is neither success nor failure", () => {
  // §9.2. Rendering it as success is the defect Charter rule 11 exists to
  // prevent; rendering it as failure invites a duplicate action. The estate's
  // live hazard: `moveTaskAction` returns without erroring when the row is not
  // in the cookie's workspace (`src/server/actions/tasks.ts:118-122`), and
  // `selectWorkspaceAction` returns `{ ok: true }` on refusal
  // (`src/server/actions/cross-workspace.ts:191`).
  const after = unwrap(
    applyReceipt(arrival(), {
      attemptId: "at-2",
      action: "approve",
      idempotencyKey: "idem-2",
      outcome: "undetermined",
      refusalCode: null,
      sourceRevisionAfter: null,
      settledAt: null,
    }, LATER),
  );

  assert.equal(after.disposition, "open");
  assert.notEqual(after.disposition, "acknowledged");
});

test("I14 · a committed receipt is the only thing that acknowledges", () => {
  const after = unwrap(
    applyReceipt(arrival(), {
      attemptId: "at-3",
      action: "approve",
      idempotencyKey: "idem-3",
      outcome: "committed",
      refusalCode: null,
      sourceRevisionAfter: "rev-4",
      settledAt: LATER,
    }, LATER),
  );

  assert.equal(after.disposition, "acknowledged");
  assert.equal(after.dispositionReason, "source-receipt");
  assert.equal(after.resolvingAttemptId, "at-3");
  assert.equal(after.visibility, "new", "a receipt must not mark read");
});

// ── I15 · a committed receipt without a revision is not a receipt ───────────

test("I15 · committed without sourceRevisionAfter is rejected", () => {
  // §9.1. Without a post-commit revision the state row records that something
  // succeeded but not which version of the source resolved it, so
  // reconciliation later has nothing to compare against.
  const result = applyReceipt(arrival(), {
    attemptId: "at-4",
    action: "approve",
    idempotencyKey: "idem-4",
    outcome: "committed",
    refusalCode: null,
    sourceRevisionAfter: null,
    settledAt: LATER,
  }, LATER);

  assert.equal(result.ok, false);
});

test("I15 · a bare boolean is not accepted as a receipt", () => {
  const result = applyReceipt(arrival(), true as unknown as never, LATER);
  assert.equal(result.ok, false);
});

test("I15 · refused without a code is rejected", () => {
  const result = applyReceipt(arrival(), {
    attemptId: "at-5",
    action: "approve",
    idempotencyKey: "idem-5",
    outcome: "refused",
    refusalCode: null,
    sourceRevisionAfter: null,
    settledAt: LATER,
  }, LATER);

  assert.equal(result.ok, false, "a refusal the UI cannot name is not a refusal");
});

// ── I16 · reconciliation moves only toward the source's answer ──────────────

test("I16 · reconciliation may move open -> acknowledged", () => {
  const after = unwrap(reconcile(arrival(), "resolved", LATER));
  assert.equal(after.disposition, "acknowledged");
  assert.equal(after.dispositionReason, "reconciliation");
});

test("I16 · reconciliation may never move acknowledged -> open", () => {
  const acked = unwrap(setDisposition(arrival(), "acknowledged", "user", NOW));
  const result = reconcile(acked, "unresolved", LATER);
  if (result.ok) {
    assert.equal(
      (result as { ok: true; state: typeof acked }).state.disposition,
      "acknowledged",
      "an unresolved source answer must not undo a resolution the person chose",
    );
  }
});

test("I16 · reconciliation never writes visibility", () => {
  const after = unwrap(reconcile(arrival(), "resolved", LATER));
  assert.equal(after.visibility, "new");
  assert.equal(after.readAt, null);
});

test("I16 · reconciliation never clears", () => {
  for (const answer of ["resolved", "unresolved", "unavailable", "undetermined"]) {
    const result = reconcile(arrival(), answer, LATER);
    if (result.ok) {
      assert.notEqual(
        (result as { ok: true; state: ReturnType<typeof arrival> }).state.disposition,
        "cleared",
        "clearing is personal; a machine may not decide a person lost interest",
      );
    }
  }
});

test("I16 · an unavailable source answer does not acknowledge", () => {
  // §11.4. An unavailable source is not a resolved ask.
  const result = reconcile(arrival(), "unavailable", LATER);
  if (result.ok) {
    assert.equal(
      (result as { ok: true; state: ReturnType<typeof arrival> }).state.disposition,
      "open",
    );
  }
});
