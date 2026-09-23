import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inspect } from "node:util";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { notes } from "./db/notes-schema";
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
