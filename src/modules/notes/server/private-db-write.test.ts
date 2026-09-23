import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inspect } from "node:util";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { noteTaskSendOutbox, notes } from "./db/notes-schema";
import { privateNotesDbWrite } from "./private-db-write";

const privateBody = "Synthetic private capture canary: exact café\nsecond line";
const baseline = readFileSync("drizzle-notes/0000_notes_baseline.sql", "utf8");
const reviewedAtForward = readFileSync("drizzle-notes/0001_notes_reviewed_at.sql", "utf8");

function noteRow(id: string) {
  return { id, userId: "synthetic_owner", body: privateBody, createdAt: 1, updatedAt: 1 };
}

test("a baseline Notes DB failure cannot put private insert params in the action error", async () => {
  const client = createClient({ url: "file::memory:" });
  try {
    await client.executeMultiple(baseline);
    const db = drizzle(client);
    const write = () => db.insert(notes).values(noteRow("n_synthetic_capture"));

    let raw: unknown;
    try { await write(); } catch (error) { raw = error; }
    assert.ok(raw instanceof Error);
    assert.match(inspect(raw), /Synthetic private capture canary/);
    assert.match(inspect(raw), /reviewed_at/);

    await assert.rejects(privateNotesDbWrite(async () => write(), "capture"), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "That did not save. Your exact words are still here.");
      assert.equal("cause" in error, false);
      assert.equal(inspect(error).includes(privateBody), false);
      assert.equal(inspect(error).includes("Synthetic private capture canary"), false);
      return true;
    });
  } finally {
    client.close();
  }
});

test("the forward Notes schema still saves exact bytes, and an edit failure stays recoverable", async () => {
  const client = createClient({ url: "file::memory:" });
  try {
    await client.executeMultiple(baseline);
    await client.executeMultiple(reviewedAtForward);
    const db = drizzle(client);
    const inserted = await privateNotesDbWrite(
      async () => db.insert(notes).values(noteRow("n_synthetic_reviewed")).returning({ body: notes.body }),
      "capture",
    );
    assert.equal(inserted[0].body, privateBody);
    await assert.rejects(privateNotesDbWrite(async () => {
      throw new Error(`Failed query params: ${privateBody}`);
    }, "edit"), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "That edit could not be saved.");
      assert.equal(inspect(error).includes("Synthetic private capture canary"), false);
      return true;
    });
  } finally {
    client.close();
  }
});

test("a failed approved-send reservation hides both private fields and leaves retry available", async () => {
  const client = createClient({ url: "file::memory:" });
  try {
    await client.executeMultiple(baseline);
    await client.executeMultiple(reviewedAtForward);
    const db = drizzle(client);
    await db.insert(notes).values(noteRow("n_synthetic_send"));
    await client.execute("CREATE TRIGGER synthetic_outbox_failure BEFORE INSERT ON note_task_send_outbox BEGIN SELECT RAISE(FAIL, 'synthetic reservation failure'); END");
    const write = () => db.insert(noteTaskSendOutbox).values({
      operationId: "synthetic_send",
      noteId: "n_synthetic_send",
      userId: "synthetic_owner",
      sourceSelection: privateBody,
      approvedBody: privateBody,
      approvedBodySha256: "a".repeat(64),
      workspaceId: "synthetic_project",
      baseUpdatedAt: 1,
      reservedUpdatedAt: 2,
    });
    let raw: unknown;
    try { await write(); } catch (error) { raw = error; }
    assert.ok(raw instanceof Error);
    assert.match(inspect(raw), /Synthetic private capture canary/);
    await assert.rejects(privateNotesDbWrite(async () => write(), "send"), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "That Tasks send could not be stored. Retry the same approved wording.");
      assert.equal("cause" in error, false);
      assert.equal(inspect(error).includes("Synthetic private capture canary"), false);
      return true;
    });
    assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM note_task_send_outbox")).rows[0].n), 0);
    await client.execute("DROP TRIGGER synthetic_outbox_failure");
    await privateNotesDbWrite(async () => write(), "send");
    assert.equal((await client.execute("SELECT approved_body FROM note_task_send_outbox")).rows[0].approved_body, privateBody);
    await assert.rejects(privateNotesDbWrite(async () => {
      throw new Error(`Failed query params: ${privateBody}`);
    }, "extract"), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "That action draft could not be saved.");
      assert.equal(inspect(error).includes("Synthetic private capture canary"), false);
      return true;
    });
  } finally {
    client.close();
  }
});
