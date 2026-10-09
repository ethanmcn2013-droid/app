import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { drizzle } from "drizzle-orm/libsql";
import { freshFileDb } from "@/server/db/memory-test-db";
import * as schema from "../../tasks-db/signal-tasks-db-schema";
import { readWorkspaceColumnConfig, readWorkspaceColumnConfigs } from "./column-config";

let fixture: Awaited<ReturnType<typeof freshFileDb>>;
let db: ReturnType<typeof drizzle<typeof schema>>;
before(async () => { fixture = await freshFileDb(); db = drizzle(fixture.client, { schema }); });
after(() => fixture?.cleanup());
test("missing stored config is valid default configuration", async () => {
  assert.deepEqual(await readWorkspaceColumnConfig(db, "missing"), { config: null, unreadable: false });
});
test("malformed, empty and foreign stored values are unreadable", async () => {
  for (const [id, value] of [["broken", "{broken"], ["empty", "{}"], ["foreign", '"foreign"']]) {
    await fixture.client.execute({ sql: "INSERT INTO meta(key,value,updated_at) VALUES (?,?,0)", args: [`board:${id}:columns`, value] });
    assert.deepEqual(await readWorkspaceColumnConfig(db, id), { config: null, unreadable: true });
  }
});
test("valid modern and legacy configurations retain canonical parsing", async () => {
  await fixture.client.execute({ sql: "INSERT INTO meta(key,value,updated_at) VALUES ('board:modern:columns',?,0),('board:legacy:columns',?,0)", args: [JSON.stringify({ custom: [{ key: "accepted", name: "Accepted" }], doneKeys: ["accepted"] }), JSON.stringify({ done: "Finished" })] });
  const modern = await readWorkspaceColumnConfig(db, "modern"), legacy = await readWorkspaceColumnConfig(db, "legacy");
  assert.equal(modern.unreadable, false); assert.deepEqual(modern.config?.doneKeys, ["accepted"]);
  assert.equal(legacy.unreadable, false); assert.equal(legacy.config?.system.done, "Finished");
});
test("database read failure is unreadable rather than a default", async () => {
  await fixture.client.execute("ALTER TABLE meta RENAME TO unavailable_meta");
  try { assert.deepEqual(await readWorkspaceColumnConfig(db, "missing"), { config: null, unreadable: true }); }
  finally { await fixture.client.execute("ALTER TABLE unavailable_meta RENAME TO meta"); }
});
test("batch config reader uses one query while preserving individual missing and malformed facts", async () => {
  const original = fixture.client.execute; let queries = 0;
  fixture.client.execute = async (...args: Parameters<typeof fixture.client.execute>) => { queries++; return original.apply(fixture.client, args); };
  try {
    const result = await readWorkspaceColumnConfigs(db, ["missing", "broken", "modern", ...Array.from({ length: 45 }, (_, index) => `empty-${index}`)]);
    assert.equal(queries, 1); assert.equal(result.size, 48);
    assert.deepEqual(result.get("missing"), { config: null, unreadable: false });
    assert.deepEqual(result.get("broken"), { config: null, unreadable: true });
    assert.deepEqual(result.get("modern")?.config?.doneKeys, ["accepted"]);
  } finally { fixture.client.execute = original; }
});
