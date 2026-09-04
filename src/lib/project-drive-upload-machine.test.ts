import test from "node:test";
import assert from "node:assert/strict";
import { createDriveUploadAttempt, type DriveUploadPorts, type DriveUploadView } from "./project-drive-upload-machine";

const file = new File(["hello"], "contract.txt", { type: "text/plain" });
function harness(overrides: Partial<DriveUploadPorts> = {}) {
  const calls: string[] = [];
  const states: DriveUploadView[] = [];
  const ports: DriveUploadPorts = {
    create: async (task, input) => { calls.push(`create:${task}:${input.resourceId}`); return { kind: "drive-session", resourceId: input.resourceId, sessionUrl: "https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture", startOffset: 0 }; },
    upload: async ({ onProgress }) => { calls.push("upload"); onProgress?.(5, 5); return { kind: "complete", fileId: "file" }; },
    finalize: async (id) => { calls.push("finalize"); return { resourceId: id, fileId: "file", webViewLink: "https://drive.google.com/file/d/file/view", outcome: "finalized" }; },
    native: async () => { calls.push("native"); }, ...overrides,
  };
  const attempt = createDriveUploadAttempt("task-a", "stable-id", file, ports, state => states.push(state));
  return { attempt, calls, states, ports };
}
test("direct Drive path confirms before success and never sends native bytes", async () => {
  const h = harness(); await h.attempt.run();
  assert.deepEqual(h.calls, ["create:task-a:stable-id", "upload", "finalize"]);
  assert.equal(h.attempt.snapshot().phase, "complete");
  assert.equal(h.states.at(-2)?.phase, "confirming");
  assert.equal(h.states.at(-2)?.confirmedBytes, file.size);
});
test("fallback requires an explicit user choice and native completion is labelled", async () => {
  const h = harness({ create: async () => ({ kind: "signal-native", reason: "member-access-incomplete" }) });
  await h.attempt.run(); assert.equal(h.attempt.snapshot().phase, "fallback"); assert.deepEqual(h.calls, []);
  await h.attempt.useNative(); assert.deepEqual(h.calls, ["native"]);
  assert.match(h.attempt.snapshot().message, /Signal Studio/);
});
test("ambiguous byte transfer retries the same claim; no native fallback", async () => {
  const h = harness({ upload: async () => ({ kind: "paused", reason: "ambiguous", nextOffset: null }) });
  await h.attempt.run(); await h.attempt.useNative(); await h.attempt.run();
  assert.deepEqual(h.calls, ["create:task-a:stable-id", "create:task-a:stable-id"]);
  assert.equal(h.attempt.snapshot().phase, "paused");
});
test("a lost create reply cannot turn a later fallback into a second upload", async () => {
  let count = 0;
  const h = harness({ create: async () => { if (++count === 1) throw Error("secret provider body"); return { kind: "signal-native", reason: "storage-unavailable" }; } });
  await h.attempt.run(); await h.attempt.run(); await h.attempt.useNative();
  assert.equal(h.attempt.snapshot().phase, "paused"); assert.deepEqual(h.calls, []);
  assert.doesNotMatch(JSON.stringify(h.states), /secret/);
});
test("lost finalize response is recovered by the server's adopted result", async () => {
  const h = harness({ finalize: async () => { throw Error("lost reply"); } });
  await h.attempt.run(); assert.equal(h.attempt.snapshot().phase, "paused");
  h.ports.create = async () => ({ kind: "complete", resourceId: "stable-id", fileId: "file", webViewLink: "", outcome: "existing" });
  await h.attempt.run(); assert.equal(h.attempt.snapshot().phase, "complete");
  assert.equal(h.calls.filter(c => c === "upload").length, 1);
  assert.ok(!h.calls.includes("native"));
});
test("stop during session mint prevents bytes and keeps the delegated claim retryable", async () => {
  let resolve!: (value: Awaited<ReturnType<DriveUploadPorts["create"]>>) => void;
  const h = harness({ create: () => new Promise(r => { resolve = r; }) });
  const pending = h.attempt.run(); h.attempt.cancel();
  resolve({ kind: "drive-session", resourceId: "stable-id", sessionUrl: "fixture", startOffset: 0 });
  await pending;
  assert.equal(h.attempt.snapshot().phase, "paused"); assert.deepEqual(h.calls, []);
});
test("double retry is serialized; disposal prevents later UI delivery", async () => {
  let resolve!: (value: Awaited<ReturnType<DriveUploadPorts["upload"]>>) => void;
  const h = harness({ upload: () => new Promise(r => { resolve = r; }) });
  const first = h.attempt.run(); await Promise.resolve(); await h.attempt.run();
  h.attempt.dispose(); const count = h.states.length;
  resolve({ kind: "paused", reason: "aborted", nextOffset: 0 }); await first;
  assert.equal(h.calls.length, 1); assert.equal(h.states.length, count);
});
test("expired or malformed sessions never silently remint in the browser", async () => {
  for (const upload of [async () => ({ kind: "expired" as const }), async () => { throw Error("malformed"); }]) {
    const h = harness({ upload }); await h.attempt.run(); await h.attempt.useNative();
    assert.equal(h.attempt.snapshot().phase, "paused"); assert.equal(h.calls.length, 1);
  }
});
test("cancel before fallback sends nothing; an uncertain native result is not retried", async () => {
  const create: DriveUploadPorts["create"] = async () => ({ kind: "signal-native", reason: "quota-full" });
  const cancelled = harness({ create }); await cancelled.attempt.run(); cancelled.attempt.cancel(); await cancelled.attempt.useNative(); assert.deepEqual(cancelled.calls, []);
  const failed = harness({ create, native: async () => { throw Error("unknown"); } });
  await failed.attempt.run(); await failed.attempt.useNative(); await failed.attempt.run();
  assert.equal(failed.attempt.snapshot().phase, "native-uncertain");
});
