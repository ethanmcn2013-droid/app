import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
import { freshFileDb } from "./db/memory-test-db";
import { approvedBodySha256 } from "./notes-extract-idempotency";

type Receiver = typeof import("@/app/api/notes-extract/v2/route");
type Fixture = Awaited<ReturnType<typeof fixture>>;
const SUBJECT_A = "user_notes_a";
const SUBJECT_B = "user_notes_b";
const LOCAL_A = "legacy-local-a";
// A local id can equal somebody ELSE's immutable subject. Never authorize that alias.
const LOCAL_B = SUBJECT_A;
const SECRET = "synthetic-notes-identity-secret-not-an-operational-credential";

class TestResponse extends Response {
  static json(value: unknown, init?: ResponseInit) {
    return new TestResponse(JSON.stringify(value), init);
  }
}

function receiver(relative: string, database: Fixture["db"]): Receiver {
  const file = new URL(relative, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const require = createRequire(file);
  const loaded = { exports: {} };
  const boundaries: Record<string, unknown> = {
    "@/server/db": { db: database },
    "next/server": { NextResponse: TestResponse },
  };
  new Function("require", "module", "exports", compiled)(
    (name: string) => Object.hasOwn(boundaries, name) ? boundaries[name] : require(name),
    loaded, loaded.exports,
  );
  return loaded.exports as Receiver;
}

async function fixture() {
  const f = await freshFileDb();
  await f.client.execute("PRAGMA foreign_keys = ON");
  await f.client.executeMultiple(`
    INSERT INTO users (id, clerk_id, email, color, initials) VALUES
      ('${LOCAL_A}', '${SUBJECT_A}', 'same@example.invalid', 'blue', 'AA'),
      ('${LOCAL_B}', '${SUBJECT_B}', 'same@example.invalid', 'blue', 'BB');
    INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES
      ('project-a', 'project-a', 'Private project A', '${LOCAL_A}'),
      ('project-b', 'project-b', 'Private project B', '${LOCAL_B}');
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('project-a', '${LOCAL_A}', 'owner'), ('project-b', '${LOCAL_B}', 'owner');
  `);
  return f;
}

function request(version: 1 | 2, subject: string, workspaceId: string, noteId: string, body = "  Confirm café supplies.  \n") {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    v: version, iss: "signal-notes", aud: "signal-tasks.notes-extract",
    sub: subject, workspaceId, noteId, iat: now, exp: now + 120,
    jti: randomUUID(), traceId: randomUUID(),
    ...(version === 2 ? { approvedBodySha256: approvedBodySha256(body) } : {}),
  };
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const assertion = encoded + "." + createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return new Request("https://fixture.invalid/api/notes-extract" + (version === 2 ? "/v2" : ""), {
    method: "POST", headers: { authorization: `Bearer ${assertion}`, "content-type": "application/json" },
    body: JSON.stringify({ noteId, workspaceId, body }),
  });
}

async function configured<T>(fn: () => Promise<T>): Promise<T> {
  const previousSecret = process.env.NOTES_TO_TASKS_SECRET;
  const previousOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NOTES_TO_TASKS_SECRET = SECRET;
  process.env.NEXT_PUBLIC_SITE_URL = "https://fixture.invalid";
  try { return await fn(); }
  finally {
    if (previousSecret === undefined) delete process.env.NOTES_TO_TASKS_SECRET;
    else process.env.NOTES_TO_TASKS_SECRET = previousSecret;
    if (previousOrigin === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousOrigin;
  }
}

for (const version of [1, 2] as const) {
  test(`signed Notes v${version} maps immutable subject, preserves receipt and refuses removed membership`, async () => configured(async () => {
    const f = await fixture();
    try {
      const route = receiver(`../app/api/notes-extract/${version === 2 ? "v2/" : ""}route.ts`, f.db);
      const noteId = `note-${version}`;
      const first = await route.POST(request(version, SUBJECT_A, "project-a", noteId));
      assert.equal(first.status, 200, "a current legacy local-id membership must be usable");
      const receipt = await first.json();
      assert.equal(receipt.created, true);
      const rows = await f.client.execute("SELECT source_note_id, source_note_extract_body FROM tasks");
      assert.equal(rows.rows.length, 1);
      assert.equal(rows.rows[0].source_note_id, `${SUBJECT_A}:${noteId}`);
      if (version === 2) assert.equal(rows.rows[0].source_note_extract_body, "  Confirm café supplies.  \n");

      // Discard the first acknowledgement and submit a freshly signed retry.
      const retry = await route.POST(request(version, SUBJECT_A, "project-a", noteId));
      assert.equal(retry.status, 200);
      const repeated = await retry.json();
      assert.equal(repeated.taskId, receipt.taskId);
      assert.equal(repeated.created, false);

      await f.client.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id=?", args: ["project-a", LOCAL_A] });
      const denied = await route.POST(request(version, SUBJECT_A, "project-a", noteId));
      assert.equal(denied.status, 401);
      assert.deepEqual(await denied.json(), { error: "Unauthorized" });
      assert.equal(Number((await f.client.execute("SELECT count(*) n FROM tasks")).rows[0].n), 1);
      assert.equal((await f.client.execute("PRAGMA foreign_key_check")).rows.length, 0);
    } finally { f.cleanup(); }
  }));

  test(`signed Notes v${version} rejects local-id collision, unknown subject and foreign project`, async () => configured(async () => {
    const f = await fixture();
    try {
      const route = receiver(`../app/api/notes-extract/${version === 2 ? "v2/" : ""}route.ts`, f.db);
      for (const [subject, project] of [[SUBJECT_A, "project-b"], [SUBJECT_B, "project-a"], [LOCAL_A, "project-a"], ["unknown-subject", "project-a"]]) {
        const response = await route.POST(request(version, subject, project, randomUUID()));
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), { error: "Unauthorized" });
      }
      assert.equal(Number((await f.client.execute("SELECT count(*) n FROM tasks")).rows[0].n), 0);
      const ownB = await route.POST(request(version, SUBJECT_B, "project-b", randomUUID()));
      assert.equal(ownB.status, 200, "the other actor's own legacy mapping still works");
      assert.equal((await f.client.execute("PRAGMA foreign_key_check")).rows.length, 0);
    } finally { f.cleanup(); }
  }));
}

test("signed Notes v2 retains exact body/workspace checks before metadata and preserves normal identity", async () => configured(async () => {
  const f = await fixture();
  try {
    // A fresh-provisioned identity is the same in both columns; keep that ordinary case.
    await f.client.execute({ sql: "UPDATE users SET clerk_id=? WHERE id=?", args: [LOCAL_A, LOCAL_A] });
    const route = receiver("../app/api/notes-extract/v2/route.ts", f.db);
    const first = await route.POST(request(2, LOCAL_A, "project-a", "exact"));
    assert.equal(first.status, 200);
    const drift = await route.POST(request(2, LOCAL_A, "project-a", "exact", "Changed approved wording"));
    assert.equal(drift.status, 409);
    for (const changed of [{ workspaceId: "project-b" }, { body: "tampered" }]) {
      const original = request(2, LOCAL_A, "project-a", "exact");
      const payload = await original.json();
      const response = await route.POST(new Request(original.url, { method: "POST", headers: original.headers, body: JSON.stringify({ ...payload, ...changed }) }));
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "Unauthorized" });
    }
    assert.equal(Number((await f.client.execute("SELECT count(*) n FROM tasks")).rows[0].n), 1);
  } finally { f.cleanup(); }
}));
