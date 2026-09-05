/**
 * Unified export integration test · Signal Studio GDPR Art. 20.
 *
 * Tests `exportUnifiedAccountDataWith` — the injectable form of the
 * orchestrator — using a real in-memory Tasks libSQL DB (same pattern as
 * account-export.test.ts) and lightweight in-process stubs for the three
 * module export functions. No Turso credentials or network access required.
 *
 * Invariants verified:
 *   1. Unified export includes all four top-level sections (tasks, notes,
 *      timeline, signal) with correct shapes.
 *   2. An unavailable module retains a stable status and safe reason;
 *      the orchestrator never exports its diagnostic metadata.
 *   3. A module stub that throws degrades to { available: false } rather than
 *      propagating the error to the caller.
 *   4. Tasks attachment storedPath never appears in the unified JSON
 *      (existing export guarantee held through the wrapper).
 *   5. Export of an unprovisioned Tasks user returns null user, no error.
 *   6. Google Drive's journal survives the unified wrapper only through its
 *      plain-language, credential-free activity projection.
 *
 * Run: node --import tsx --test src/server/account-unified-export.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { exportUnifiedAccountDataWith } from "./account-unified-export";
import { freshMemoryDb } from "./db/memory-test-db";

// ── Stub factories ────────────────────────────────────────────────────────────

const NOTES_OK = {
  available: true as const,
  notes: [{ id: "n-1" }],
  noteTaskSendOutbox: [],
  calendarConnections: [],
  spawnedCalendarEvents: [],
  preferences: null,
};
const TIMELINE_OK = {
  available: true as const,
  workspaces: [],
  projects: [],
  tasks: [],
  subtasks: [],
  activity: [],
  comments: [],
  projectSources: [],
  nodeOverlays: [],
  publications: [],
  publicationItems: [],
  audienceShares: [],
};
const SIGNAL_OK = {
  available: true as const,
  account: null,
  phrasingRotations: [],
  briefingFeedback: [],
  surfacedItems: [],
  analyticsViewPreferences: [],
  emailSubscription: null,
};

const okOpts = {
  exportNotes: async (_id: string) => NOTES_OK,
  exportTimeline: async (_id: string) => TIMELINE_OK,
  exportSignal: async (_id: string) => SIGNAL_OK,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function seedTasksUser(client: import("@libsql/client").Client) {
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials)
      VALUES ('u-target', 'clerk_target', 'fixture-target-color', 'TT');
    INSERT INTO workspaces (id, slug, name, owner_user_id)
      VALUES ('ws-a', 'ws-a', 'A', 'u-target');
    INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('ws-a', 'u-target', 'owner');
    INSERT INTO tasks (id, workspace_id, title, lane, priority)
      VALUES ('task-a1', 'ws-a', 'A task', 'todo', 'med');
    INSERT INTO attachments (id, workspace_id, task_id, uploader_user_id,
        filename, stored_path, mime_type, size_bytes)
      VALUES ('att-1', 'ws-a', 'task-a1', 'u-target',
        'file.png', '.data/uploads/SECRET.png', 'image/png', 3);
    INSERT INTO project_drive_operations (
        id, workspace_id, operation_kind, status, dedupe_key,
        attempt_count, created_at, updated_at)
      VALUES ('drive-op-a', 'ws-a', 'project_delete', 'pending',
        '${"a".repeat(64)}', 0, 1756800000, 1756800000);
  `);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("unified export includes all four sections with correct shapes", async () => {
  const { client, db } = await freshMemoryDb();
  try {
    await seedTasksUser(client);

    const result = await exportUnifiedAccountDataWith(
      db,
      "clerk_target",
      okOpts,
    );

    assert.equal(result.product, "signal");
    assert.ok(result.exportedAt, "exportedAt must be present");
    assert.equal(result.clerkId, "clerk_target");

    // Tasks section ran against the in-memory DB.
    assert.ok(result.tasks, "tasks section missing");
    assert.equal(result.tasks.product, "tasks");
    assert.ok(result.tasks.user, "tasks.user missing");
    assert.deepEqual(
      result.tasks.ownedWorkspaces?.googleDriveActivity.map((activity) => ({
        id: activity.id,
        action: activity.action,
        progress: activity.progress,
      })),
      [
        {
          id: "drive-op-a",
          action: "Remove the Google Drive setup",
          progress: "Waiting",
        },
      ],
    );

    // Module sections from stubs.
    assert.equal((result.notes as { available: boolean }).available, true);
    assert.equal((result.timeline as { available: boolean }).available, true);
    assert.equal((result.signal as { available: boolean }).available, true);
  } finally {
    client.close();
  }
});

test("tasks storedPath never appears in the unified export JSON", async () => {
  const { client, db } = await freshMemoryDb();
  try {
    await seedTasksUser(client);

    const result = await exportUnifiedAccountDataWith(
      db,
      "clerk_target",
      okOpts,
    );
    const json = JSON.stringify(result);
    assert.ok(
      !json.includes("SECRET"),
      "attachment storedPath leaked into the unified export",
    );
    assert.equal(json.includes("projectDriveActivity"), false);
    assert.equal(json.includes("Project Drive"), false);
    assert.equal(json.includes("googleDriveActivity"), true);
  } finally {
    client.close();
  }
});

test("a module returning { available: false } is preserved without throwing", async () => {
  const { client, db } = await freshMemoryDb();
  try {
    const result = await exportUnifiedAccountDataWith(db, "clerk_target", {
      exportNotes: async (_id) => ({
        available: false as const,
        reason: "NOTES_DATABASE_URL is not set",
      }),
      exportTimeline: async (_id) => TIMELINE_OK,
      exportSignal: async (_id) => SIGNAL_OK,
    });

    const notes = result.notes as { available: boolean; reason?: string };
    assert.equal(notes.available, false);
    assert.ok(notes.reason, "reason must be present on unavailable section");
    // Other sections still present.
    assert.ok(result.tasks);
    assert.equal((result.timeline as { available: boolean }).available, true);
  } finally {
    client.close();
  }
});

test("a module that throws degrades to { available: false } without propagating", async () => {
  const { client, db } = await freshMemoryDb();
  try {
    const result = await exportUnifiedAccountDataWith(db, "clerk_target", {
      exportNotes: async (_id) => NOTES_OK,
      exportTimeline: async (_id) => {
        throw new Error("TIMELINE_AUTH_TOKEN required for remote Turso DB");
      },
      exportSignal: async (_id) => SIGNAL_OK,
    });

    const timeline = result.timeline as { available: boolean; reason?: string };
    assert.equal(timeline.available, false);
    assert.equal(timeline.reason, "Timeline export is unavailable. Try again later.");
    assert.doesNotMatch(JSON.stringify(result), /TIMELINE_AUTH_TOKEN/);
    // Notes and Signal still succeeded.
    assert.equal((result.notes as { available: boolean }).available, true);
    assert.equal((result.signal as { available: boolean }).available, true);
  } finally {
    client.close();
  }
});

test("export of an unprovisioned Tasks user returns null user, not an error", async () => {
  const { client, db } = await freshMemoryDb();
  try {
    const result = await exportUnifiedAccountDataWith(
      db,
      "clerk_nobody",
      okOpts,
    );
    assert.equal(result.product, "signal");
    assert.equal(result.tasks.user, null);
  } finally {
    client.close();
  }
});

test("all three modules unavailable still returns a complete top-level shape", async () => {
  const { client, db } = await freshMemoryDb();
  try {
    const result = await exportUnifiedAccountDataWith(db, "clerk_target", {
      exportNotes: async (_id) => ({ available: false as const, reason: "no notes db" }),
      exportTimeline: async (_id) => ({ available: false as const, reason: "no timeline db" }),
      exportSignal: async (_id) => ({ available: false as const, reason: "no signal db" }),
    });

    assert.equal(result.product, "signal");
    assert.ok(result.exportedAt);
    assert.ok(result.tasks);
    assert.equal((result.notes as { available: boolean }).available, false);
    assert.equal((result.timeline as { available: boolean }).available, false);
    assert.equal((result.signal as { available: boolean }).available, false);
  } finally {
    client.close();
  }
});
