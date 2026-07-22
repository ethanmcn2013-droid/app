import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSelectionBelongsToNote,
  createApprovedTasksPayload,
  createAttemptedVersion,
  createRemoteConflict,
  createVersionConflict,
  nextUpdatedAt,
  normalizeOptionalWorkspaceId,
  presentNoteBody,
  reconcileStableCapture,
  validateApprovedBody,
  validateExpectedUpdatedAt,
  validateNoteBody,
  validateSourceSelection,
  validateStableNoteId,
} from "./notes-hybrid";

const NOTE_ID = "n_0123456789abcdef0123456789abcdef";

describe("stable hybrid note ids", () => {
  it("accepts exactly n_ followed by 32 lowercase hex characters", () => {
    assert.equal(validateStableNoteId(NOTE_ID), NOTE_ID);
  });

  it("rejects random, shortened, uppercase, and padded ids", () => {
    for (const id of [
      "n_1",
      "N_0123456789abcdef0123456789abcdef",
      "n_0123456789ABCDEF0123456789ABCDEF",
      `${NOTE_ID}0`,
      ` ${NOTE_ID}`,
      "550e8400-e29b-41d4-a716-446655440000",
    ]) {
      assert.throws(() => validateStableNoteId(id));
    }
  });
});

describe("exact private body preservation", () => {
  it("uses trimming only to determine emptiness", () => {
    const body = "  Florist confirms pink, not red.  \n\n  Private context. \t";
    assert.equal(validateNoteBody(body), body);
    assert.deepEqual(createAttemptedVersion(body, 42), {
      body,
      updatedAt: 42,
    });
  });

  it("rejects blank and oversized bodies without normalizing accepted text", () => {
    assert.throws(() => validateNoteBody(" \n\t "), /empty/);
    assert.throws(() => validateNoteBody("x".repeat(10_001)), /10,000/);
  });
});

describe("idempotent capture reconciliation", () => {
  it("matches only the exact body and normalized destination", () => {
    assert.equal(
      reconcileStableCapture(
        { body: "  exact \n", workspaceId: "ws_1" },
        { body: "  exact \n", workspaceId: "ws_1" },
      ),
      "match",
    );
    assert.equal(
      reconcileStableCapture(
        { body: "exact\n", workspaceId: "ws_1" },
        { body: "exact", workspaceId: "ws_1" },
      ),
      "mismatch",
    );
    assert.equal(
      reconcileStableCapture(
        { body: "exact", workspaceId: null },
        { body: "exact", workspaceId: "ws_1" },
      ),
      "mismatch",
    );
  });

  it("normalizes only workspace identifiers", () => {
    assert.equal(normalizeOptionalWorkspaceId("  ws_1  "), "ws_1");
    assert.equal(normalizeOptionalWorkspaceId(" \t "), null);
    assert.equal(normalizeOptionalWorkspaceId(null), null);
  });
});

describe("approved extraction privacy contract", () => {
  it("preserves selected and approved whitespace exactly", () => {
    const noteBody = "Private context\n  Call Maeve by Friday.  \nMore context";
    const selection = "  Call Maeve by Friday.  ";
    const approved = "  Call Maeve before Friday.  ";
    assert.equal(validateSourceSelection(selection), selection);
    assert.doesNotThrow(() => assertSelectionBelongsToNote(noteBody, selection));
    assert.equal(validateApprovedBody(approved), approved);

    const payload = createApprovedTasksPayload({
      noteId: NOTE_ID,
      approvedBody: approved,
      workspaceId: " ws_venue ",
    });
    assert.deepEqual(payload, {
      noteId: NOTE_ID,
      body: approved,
      workspaceId: "ws_venue",
    });
  });

  it("allows only noteId, approved body, and workspaceId in the payload", () => {
    const rawBody = "PRIVATE supplier concern that must never cross";
    const sourceSelection = "PRIVATE original selection";
    const payload = createApprovedTasksPayload({
      noteId: NOTE_ID,
      approvedBody: "Call the supplier before Friday",
      workspaceId: "ws_1",
    });
    assert.deepEqual(Object.keys(payload).sort(), ["body", "noteId", "workspaceId"]);
    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes(rawBody), false);
    assert.equal(serialized.includes(sourceSelection), false);
    assert.equal("sourceSelection" in payload, false);
  });

  it("rejects missing selections, stale selections, and invalid approved text", () => {
    assert.throws(() => validateSourceSelection("  "), /Select wording/);
    assert.throws(
      () => assertSelectionBelongsToNote("Current note", "Old wording"),
      /no longer present/,
    );
    assert.throws(() => validateApprovedBody("\n\t"), /empty/);
    assert.throws(() => validateApprovedBody("x".repeat(281)), /280/);
  });
});

describe("version and stream presentation helpers", () => {
  it("retains exact attempted versions and advances timestamps monotonically", () => {
    const attempted = createAttemptedVersion(" exact attempt \n", 1_000);
    assert.deepEqual(attempted, { body: " exact attempt \n", updatedAt: 1_000 });
    assert.equal(nextUpdatedAt(999, 1_000), 1_001);
    assert.equal(nextUpdatedAt(2_000.9, 1_000), 2_000);
    assert.throws(() => validateExpectedUpdatedAt(-1));
    assert.throws(() => validateExpectedUpdatedAt(1.5));
  });

  it("returns exact attempted and remote conflict outcomes", () => {
    const remote = {
      id: NOTE_ID,
      body: " Remote device wording. \n",
      updatedAt: 1_250,
    };
    assert.deepEqual(
      createVersionConflict(" Local unsaved wording.  \n", 1_000, remote),
      {
        status: "conflict",
        attempted: {
          body: " Local unsaved wording.  \n",
          updatedAt: 1_000,
        },
        remote,
      },
    );
    assert.deepEqual(createRemoteConflict(remote), {
      status: "conflict",
      remote,
    });
  });

  it("derives restrained title and preview copy without mutating the source", () => {
    const body = "Venue walkthrough\nRain room   confirmed\nCall florist";
    assert.deepEqual(presentNoteBody(body), {
      title: "Venue walkthrough",
      preview: "Rain room confirmed Call florist",
    });
    assert.equal(body, "Venue walkthrough\nRain room   confirmed\nCall florist");
    assert.deepEqual(presentNoteBody("  \n private context"), {
      title: "Untitled note",
      preview: "private context",
    });
    assert.deepEqual(presentNoteBody("x".repeat(100)), {
      title: `${"x".repeat(87)}…`,
      preview: "",
    });
  });
});
