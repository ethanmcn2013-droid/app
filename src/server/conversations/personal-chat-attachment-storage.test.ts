import assert from "node:assert/strict";
import test from "node:test";
import { createPersonalAttachmentStorage, PersonalAttachmentWriteError } from "./personal-chat-attachment-storage";

function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
const bytes = new TextEncoder().encode("synthetic private bytes");
const key = "personal-chat/owner/synthetic.txt";

test("disk admission uses the original grant after mkdir and refuses aborted, expired or fenced writes", async () => {
  for (const cause of ["expired", "aborted", "fenced"] as const) {
    const entered = deferred(); const resume = deferred(); let time = 100; let writes = 0; let permitted = true;
    const abort = new AbortController();
    const storage = createPersonalAttachmentStorage({ env: () => ({}), root: () => "D:/synthetic-private-root", now: () => time,
      disk: { mkdir: async () => { entered.resolve(); await resume.promise; }, write: async () => { writes++; }, remove: async () => undefined } });
    const upload = storage.put(key, bytes, "text/plain", "disk", storage.identity("disk")!, { deadline: 200, signal: abort.signal, admit: async () => permitted });
    await entered.promise;
    if (cause === "expired") time = 201;
    if (cause === "aborted") abort.abort();
    if (cause === "fenced") permitted = false;
    resume.resolve();
    await assert.rejects(upload, error => error instanceof PersonalAttachmentWriteError && error.settled);
    assert.equal(writes, 0, cause);
  }
});

test("disk partial-write failure is terminal only after the awaited write settles", async () => {
  const entered = deferred(); const resume = deferred(); let done = false; let partial = false; let removed = false;
  const abort = new AbortController();
  const storage = createPersonalAttachmentStorage({ env: () => ({}), root: () => "D:/synthetic-private-root", now: () => 100,
    disk: { mkdir: async () => undefined, write: async () => { partial = true; entered.resolve(); await resume.promise; throw new Error("synthetic partial write"); }, remove: async () => { removed = true; partial = false; } } });
  const identity = storage.identity("disk")!;
  const upload = storage.put(key, bytes, "text/plain", "disk", identity, { deadline: 200, signal: abort.signal, admit: async () => true });
  const observed = upload.finally(() => { done = true; });
  await entered.promise; abort.abort(); await Promise.resolve();
  assert.equal(done, false); assert.equal(partial, true);
  resume.resolve();
  await assert.rejects(observed, error => error instanceof PersonalAttachmentWriteError && error.settled);
  await storage.remove("disk", key, identity); assert.equal(removed, true); assert.equal(partial, false);
});

test("Blob rejection retains uncertainty and explicit credential capture prevents ambient store switching", async () => {
  let credential = "synthetic-store-a-token"; let sinkCalls = 0; const used: string[] = [];
  const storage = createPersonalAttachmentStorage({ env: () => ({ BLOB_READ_WRITE_TOKEN: credential }), now: () => 100,
    blob: { put: async (_key, _bytes, _mime, _signal, token, admit) => { await admit(); sinkCalls++; used.push(token); throw new Error("synthetic network loss"); },
      remove: async (_key, token) => { used.push(token); }, open: async (_url, token) => { used.push(token); return null; } } });
  const identity = storage.identity("blob")!;
  const admission = { deadline: 200, signal: new AbortController().signal, admit: async () => true };
  await assert.rejects(storage.put(key, bytes, "text/plain", "blob", identity, admission), error => error instanceof PersonalAttachmentWriteError && !error.settled);
  assert.equal(sinkCalls, 1); assert.deepEqual(used, [credential]);
  credential = "synthetic-store-b-token";
  await assert.rejects(storage.put(key, bytes, "text/plain", "blob", identity, admission), error => error instanceof PersonalAttachmentWriteError && error.settled);
  await assert.rejects(storage.remove("blob", key, identity));
  await assert.rejects(storage.open!({ backend: "blob", store_identity: identity, stored_path: "https://synthetic.invalid/file" }));
  assert.equal(sinkCalls, 1); assert.equal(used.length, 1, "wrong-store delete/get must not be attempted");
  credential = "synthetic-store-a-token";
  await storage.remove("blob", key, identity);
  await storage.open!({ backend: "blob", store_identity: identity, stored_path: "https://synthetic.invalid/file" });
  assert.deepEqual(used, [credential, credential, credential]);
});

test("a credential switch during durable admission cannot write to either store", async () => {
  let credential = "synthetic-store-a-token"; let writes = 0;
  const storage = createPersonalAttachmentStorage({ env: () => ({ BLOB_READ_WRITE_TOKEN: credential }), now: () => 100,
    blob: { put: async () => { writes++; return "synthetic"; }, remove: async () => undefined, open: async () => null } });
  const identity = storage.identity("blob")!;
  await assert.rejects(storage.put(key, bytes, "text/plain", "blob", identity, { deadline: 200, signal: new AbortController().signal,
    admit: async () => { credential = "synthetic-store-b-token"; return true; } }), error => error instanceof PersonalAttachmentWriteError && error.settled);
  assert.equal(writes, 0);
});

test("disk root changes cannot turn an old receipt into a delete at a new root", async () => {
  let root = "D:/synthetic-root-a"; let deletes = 0;
  const storage = createPersonalAttachmentStorage({ env: () => ({}), root: () => root,
    disk: { mkdir: async () => undefined, write: async () => undefined, remove: async () => { deletes++; } } });
  const identity = storage.identity("disk")!; root = "D:/synthetic-root-b";
  await assert.rejects(storage.remove("disk", key, identity)); assert.equal(deletes, 0);
  root = "D:/synthetic-root-a"; await storage.remove("disk", key, identity); assert.equal(deletes, 1);
});
