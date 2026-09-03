/**
 * Unified erasure integration test · Signal Studio GDPR right-to-erasure.
 *
 * Tests `deleteUnifiedAccountDataWith` — the injectable form of the
 * orchestrator — using a real transaction-capable temporary Tasks libSQL DB
 * and lightweight in-process stubs for module erasers and token revocation.
 * No Turso credentials or network access required.
 *
 * Invariants verified:
 *   1. Tasks rows are fully erased after a successful run (zero residual rows).
 *   2. Bystander rows in the Tasks DB are untouched.
 *   3. Google tokens returned by Notes and Tasks erasure are deduplicated and
 *      forwarded to the revocation function (not silently dropped).
 *   4. A per-module failure does not abort the rest: Tasks is still erased,
 *      every module is attempted, and the unified erasure rejects before
 *      Clerk deletion can run.
 *   5. Erasure is idempotent: a second call on the same clerkId is a no-op.
 *   6. Erasing an unprovisioned user is a no-op (no throw, no writes).
 *   7. Tasks consumes only the target's Google Drive operation evidence;
 *      another Project's repair journal survives the unified orchestration.
 *
 * Run: node --import tsx --test src/server/account-unified-erasure.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Client } from "@libsql/client";
import {
  deleteUnifiedAccountDataWith,
  UnifiedAccountErasureError,
} from "./account-unified-erasure";
import { freshFileDb } from "./db/memory-test-db";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function count(client: Client, where: string): Promise<number> {
  const rs = await client.execute(`SELECT COUNT(*) AS c FROM ${where}`);
  return Number(rs.rows[0]!.c);
}

async function seedTwo(client: Client) {
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials)
      VALUES ('u-target',    'clerk_target',    'fixture-target-color', 'TT'),
             ('u-bystander', 'clerk_bystander', 'fixture-bystander-color', 'BB');
    INSERT INTO workspaces (id, slug, name, owner_user_id)
      VALUES ('ws-a', 'ws-a', 'A', 'u-target'),
             ('ws-b', 'ws-b', 'B', 'u-bystander');
    INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('ws-a', 'u-target',    'owner'),
             ('ws-b', 'u-bystander', 'owner');
    INSERT INTO tasks (id, workspace_id, title, lane, priority)
      VALUES ('task-a1', 'ws-a', 'A task', 'todo', 'med');
    INSERT INTO notification_prefs (user_id)
      VALUES ('u-target'), ('u-bystander');
    INSERT INTO user_preferences (user_id)
      VALUES ('u-target'), ('u-bystander');
    INSERT INTO project_drive_operations (
        id, workspace_id, operation_kind, status, dedupe_key,
        attempt_count, created_at, updated_at, completed_at)
      VALUES
        ('drive-op-target', 'ws-a', 'project_delete', 'cancelled',
          '${"a".repeat(64)}', 0, 1756800000, 1756800001, 1756800001),
        ('drive-op-bystander', 'ws-b', 'project_delete', 'pending',
          '${"b".repeat(64)}', 0, 1756800000, 1756800000, NULL);
  `);
}

/** Stub opts where all modules succeed and no tokens are revoked. */
function okOpts(revokedTokens: string[] = []) {
  return {
    eraseNotes: async (_id: string) =>
      ({ ok: true as const, refreshTokens: [] }),
    eraseTimeline: async (_id: string) => ({ ok: true as const }),
    eraseSignal: async (_id: string) => ({ ok: true as const }),
    revokeTokens: async (tokens: string[]) => {
      revokedTokens.push(...tokens);
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("unified erasure removes all Tasks rows, leaves bystander intact", async () => {
  const { client, db, cleanup } = await freshFileDb();
  try {
    await seedTwo(client);
    await deleteUnifiedAccountDataWith(db, "clerk_target", okOpts());

    // Target gone.
    assert.equal(await count(client, "users WHERE id='u-target'"), 0);
    assert.equal(await count(client, "workspaces WHERE id='ws-a'"), 0);
    assert.equal(await count(client, "tasks WHERE workspace_id='ws-a'"), 0);
    assert.equal(await count(client, "notification_prefs WHERE user_id='u-target'"), 0);
    assert.equal(await count(client, "user_preferences WHERE user_id='u-target'"), 0);
    assert.equal(
      await count(
        client,
        "project_drive_operations WHERE id='drive-op-target'",
      ),
      0,
    );

    // Bystander intact.
    assert.equal(await count(client, "users WHERE id='u-bystander'"), 1);
    assert.equal(await count(client, "workspaces WHERE id='ws-b'"), 1);
    assert.equal(await count(client, "notification_prefs WHERE user_id='u-bystander'"), 1);
    assert.equal(
      await count(
        client,
        "project_drive_operations WHERE id='drive-op-bystander'",
      ),
      1,
    );
  } finally {
    cleanup();
  }
});

test("Google tokens from Notes and Tasks are deduplicated for revocation", async () => {
  const { db, cleanup } = await freshFileDb();
  const revokedTokens: string[] = [];
  try {
    const opts = {
      eraseNotes: async (_id: string) => ({
        ok: true as const,
        refreshTokens: ["tok-google-1", "tok-google-2"],
      }),
      eraseTimeline: async (_id: string) => ({ ok: true as const }),
      eraseSignal: async (_id: string) => ({ ok: true as const }),
      eraseTasks: async () => ({
        googleRefreshTokens: ["tok-google-1", "tok-drive-1"],
      }),
      revokeTokens: async (tokens: string[]) => {
        revokedTokens.push(...tokens);
      },
    };

    await deleteUnifiedAccountDataWith(db, "clerk_target", opts);

    assert.deepEqual(revokedTokens, [
      "tok-google-1",
      "tok-google-2",
      "tok-drive-1",
    ]);
  } finally {
    cleanup();
  }
});

test("a running project deletion defers Tasks erasure without trapping either fence", async () => {
  const { client, db, cleanup } = await freshFileDb();
  const revokedTokens: string[] = [];
  try {
    await seedTwo(client);
    // Reproduce the project-delete-wins side of the lifecycle race. The real
    // Tasks eraser must retain this running tombstone and yield before fencing.
    await client.execute(`
      UPDATE project_drive_operations
      SET status='running', attempt_count=1, last_attempt_at=1756800001,
          lease_expires_at=2756800001, updated_at=1756800001,
          completed_at=NULL
      WHERE id='drive-op-target'
    `);

    await assert.rejects(
      deleteUnifiedAccountDataWith(db, "clerk_target", {
        eraseNotes: async () => ({
          ok: true as const,
          refreshTokens: ["notes-token-already-detached"],
        }),
        eraseTimeline: async () => ({ ok: true as const }),
        eraseSignal: async () => ({ ok: true as const }),
        revokeTokens: async (tokens) => {
          revokedTokens.push(...tokens);
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof UnifiedAccountErasureError);
        assert.deepEqual(error.failedModules, ["Tasks"]);
        return true;
      },
    );

    assert.deepEqual(revokedTokens, ["notes-token-already-detached"]);
    assert.equal(await count(client, "users WHERE id='u-target'"), 1);
    assert.equal(
      await count(
        client,
        "project_drive_operations WHERE id='drive-op-target' AND status='running'",
      ),
      1,
    );
    assert.equal(
      await count(
        client,
        "meta WHERE key='google-drive:account-erasure:user:u-target'",
      ),
      0,
      "account erasure must yield before installing a fence behind the winning deletion",
    );
  } finally {
    cleanup();
  }
});

test("multiple module failures still attempt Tasks, then reject with every failure", async () => {
  const { client, db, cleanup } = await freshFileDb();
  const attempted: string[] = [];
  try {
    await seedTwo(client);

    const opts = {
      eraseNotes: async (_id: string) => {
        attempted.push("Notes");
        return {
          ok: false as const,
          error: "NOTES_DATABASE_URL not set",
          refreshTokens: [] as string[],
        };
      },
      eraseTimeline: async (_id: string) => {
        attempted.push("Timeline");
        return {
          ok: false as const,
          error: "TIMELINE_AUTH_TOKEN required",
        };
      },
      eraseSignal: async (_id: string) => {
        attempted.push("Signal");
        return { ok: true as const };
      },
      revokeTokens: async (_tokens: string[]) => {},
    };

    await assert.rejects(
      deleteUnifiedAccountDataWith(db, "clerk_target", opts),
      (error: unknown) => {
        assert.ok(error instanceof UnifiedAccountErasureError);
        assert.deepEqual(error.failedModules, ["Notes", "Timeline"]);
        assert.equal(
          error.message,
          "Unified account erasure incomplete: Notes, Timeline",
        );
        return true;
      },
    );

    assert.deepEqual(attempted.sort(), ["Notes", "Signal", "Timeline"]);
    assert.equal(
      await count(client, "users WHERE id='u-target'"),
      0,
      "the real Tasks eraser must still run after module failures",
    );
    assert.equal(await count(client, "users WHERE id='u-bystander'"), 1);
  } finally {
    cleanup();
  }
});

test("a thrown module failure still attempts the remaining modules and Tasks", async () => {
  const { client, db, cleanup } = await freshFileDb();
  const attempted: string[] = [];
  try {
    await seedTwo(client);

    const opts = {
      eraseNotes: (_id: string) => {
        attempted.push("Notes");
        throw new Error("network timeout with provider body");
      },
      eraseTimeline: async (_id: string) => {
        attempted.push("Timeline");
        return { ok: true as const };
      },
      eraseSignal: async (_id: string) => {
        attempted.push("Signal");
        return { ok: true as const };
      },
      eraseTasks: async () => {
        attempted.push("Tasks");
        return { googleRefreshTokens: [] };
      },
      revokeTokens: async (_tokens: string[]) => {},
    };

    await assert.rejects(
      deleteUnifiedAccountDataWith(db, "clerk_target", opts),
      (error: unknown) => {
        assert.ok(error instanceof UnifiedAccountErasureError);
        assert.deepEqual(error.failedModules, ["Notes"]);
        assert.doesNotMatch(error.message, /network timeout|provider body/);
        return true;
      },
    );
    assert.deepEqual(attempted.sort(), ["Notes", "Signal", "Tasks", "Timeline"]);
  } finally {
    cleanup();
  }
});

test("unified erasure is idempotent on re-run", async () => {
  const { client, db, cleanup } = await freshFileDb();
  try {
    await seedTwo(client);
    await deleteUnifiedAccountDataWith(db, "clerk_target", okOpts());
    // Second run must not throw.
    await deleteUnifiedAccountDataWith(db, "clerk_target", okOpts());
    // Bystander still intact after two runs.
    assert.equal(await count(client, "users WHERE id='u-bystander'"), 1);
  } finally {
    cleanup();
  }
});

test("erasing an unprovisioned Tasks user is a no-op (no throw, no writes)", async () => {
  const { client, db, cleanup } = await freshFileDb();
  try {
    await client.execute(
      "INSERT INTO users (id, clerk_id, color, initials) VALUES ('u-x', 'clerk_x', '#1', 'XX')",
    );
    // Must not throw.
    await deleteUnifiedAccountDataWith(db, "clerk_does_not_exist", okOpts());
    // The real user is untouched.
    assert.equal(await count(client, "users"), 1);
  } finally {
    cleanup();
  }
});

test("tokens returned by a failed Notes erasure are revoked before rejection", async () => {
  const { db, cleanup } = await freshFileDb();
  const revokedTokens: string[] = [];
  try {
    const opts = {
      eraseNotes: async (_id: string) => ({
        ok: false as const,
        error: "db error",
        refreshTokens: ["detached-notes-token"],
      }),
      eraseTimeline: async (_id: string) => ({ ok: true as const }),
      eraseSignal: async (_id: string) => ({ ok: true as const }),
      revokeTokens: async (tokens: string[]) => {
        revokedTokens.push(...tokens);
      },
    };

    await assert.rejects(
      deleteUnifiedAccountDataWith(db, "clerk_target", opts),
      (error: unknown) => {
        assert.ok(error instanceof UnifiedAccountErasureError);
        assert.deepEqual(error.failedModules, ["Notes"]);
        return true;
      },
    );

    // When erasure fails, the tokens in the failure result are still
    // forwarded (they were collected before the delete attempt and returned
    // in the ok:false shape so the caller can still revoke them).
    // This matches the Notes eraseForUser contract: tokens are collected
    // first, so even a partial DB failure may return collected tokens.
    // The orchestrator forwards whatever refreshTokens is present.
    assert.ok(
      revokedTokens.includes("detached-notes-token"),
      "tokens collected before a failed erasure should still be revoked",
    );
  } finally {
    cleanup();
  }
});

test("partial success deduplicates detached Notes and Tasks tokens before failing closed", async () => {
  const { db, cleanup } = await freshFileDb();
  const revokedBatches: string[][] = [];
  try {
    const opts = {
      eraseNotes: async (_id: string) => ({
        ok: true as const,
        refreshTokens: ["shared-token", "notes-token", "shared-token"],
      }),
      eraseTimeline: async (_id: string) => ({
        ok: false as const,
        error: "timeline unavailable",
      }),
      eraseSignal: async (_id: string) => {
        throw new Error("signal unavailable");
      },
      eraseTasks: async () => ({
        googleRefreshTokens: ["shared-token", "tasks-token"],
      }),
      revokeTokens: async (tokens: string[]) => {
        revokedBatches.push(tokens);
      },
    };

    await assert.rejects(
      deleteUnifiedAccountDataWith(db, "clerk_target", opts),
      (error: unknown) => {
        assert.ok(error instanceof UnifiedAccountErasureError);
        assert.deepEqual(error.failedModules, ["Timeline", "Signal"]);
        return true;
      },
    );

    assert.deepEqual(revokedBatches, [
      ["shared-token", "notes-token", "tasks-token"],
    ]);
  } finally {
    cleanup();
  }
});

test("module and Tasks failures aggregate after every eraser and token revocation attempt", async () => {
  const { db, cleanup } = await freshFileDb();
  const attempted: string[] = [];
  const revokedTokens: string[] = [];
  try {
    await assert.rejects(
      deleteUnifiedAccountDataWith(db, "clerk_target", {
        eraseNotes: async () => {
          attempted.push("Notes");
          return {
            ok: false as const,
            error: "notes failed with a secret provider body",
            refreshTokens: ["detached-notes-token", "detached-notes-token"],
          };
        },
        eraseTimeline: async () => {
          attempted.push("Timeline");
          throw new Error("timeline provider body");
        },
        eraseSignal: async () => {
          attempted.push("Signal");
          return { ok: false as const, error: "signal provider body" };
        },
        eraseTasks: async () => {
          attempted.push("Tasks");
          throw new Error("Tasks erasure failed");
        },
        revokeTokens: async (tokens) => {
          revokedTokens.push(...tokens);
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof UnifiedAccountErasureError);
        assert.deepEqual(error.failedModules, [
          "Notes",
          "Timeline",
          "Signal",
          "Tasks",
        ]);
        assert.deepEqual(
          error.errors.map((failure: Error) => failure.message),
          [
            "Notes erasure failed",
            "Timeline erasure failed",
            "Signal erasure failed",
            "Tasks erasure failed",
          ],
        );
        assert.doesNotMatch(error.message, /secret|provider body/);
        assert.doesNotMatch(
          error.errors.map((failure: Error) => failure.message).join(" "),
          /secret|provider body|detached-notes-token/,
        );
        return true;
      },
    );

    assert.deepEqual(attempted.sort(), ["Notes", "Signal", "Tasks", "Timeline"]);
    assert.deepEqual(revokedTokens, ["detached-notes-token"]);
  } finally {
    cleanup();
  }
});
