import test from "node:test";
import assert from "node:assert/strict";
import { createDriveRecoveryController, type DriveUploadRecoveryResult } from "./project-drive-upload-recovery";

const own = { id: "claim", taskId: "task-a", addedByUserId: "uploader", storage: "google_drive", accessState: "pending" };

test("only original-uploader, exact-task, unmounted pending claims are checked, once each", async () => {
  const calls: unknown[] = [];
  const controller = createDriveRecoveryController("task-a", {
    recover: async (...args) => { calls.push(args); return "complete"; },
    refresh: async () => { calls.push("refresh"); }, changed: () => {},
  });
  await controller.check([own, own, { ...own, id: "foreign", taskId: "task-b" },
    { ...own, id: "another-uploader", addedByUserId: "other" }, { ...own, id: "mounted" },
    { ...own, id: "native", storage: "signal" }, { ...own, id: "done", accessState: "ok" }], "uploader", ["mounted"]);
  assert.deepEqual(calls, [["task-a", "claim"], "refresh"]);
});

for (const result of ["complete", "pending", "unavailable", "disabled", "review"] as DriveUploadRecoveryResult[]) {
  test(`${result} always re-reads canonical Resources and only reports sanitized state`, async () => {
    const events: unknown[] = [];
    const controller = createDriveRecoveryController("task-a", {
      recover: async () => result, refresh: async () => { events.push("list"); }, changed: state => events.push(state),
    });
    await controller.check([own], "uploader", []);
    assert.deepEqual(events, ["checking", "list", ["complete", "pending"].includes(result) ? result : "unavailable"]);
  });
}

test("double click is serialized and a failed canonical read cannot be presented as completion", async () => {
  let release!: () => void; let calls = 0; const states: unknown[] = [];
  const hold = new Promise<void>(resolve => { release = resolve; });
  const controller = createDriveRecoveryController("task-a", {
    recover: async () => { calls++; await hold; return "complete"; },
    refresh: async () => { throw Error("PRIVATE database detail"); }, changed: state => states.push(state),
  });
  const first = controller.check([own], "uploader", []);
  await controller.check([own], "uploader", []); release(); await first;
  assert.equal(calls, 1); assert.deepEqual(states, ["checking", "unavailable"]);
});

test("task disposal stops later claims, refresh and stale UI updates", async () => {
  const calls: unknown[] = [];
  const controller = createDriveRecoveryController("task-a", {
    recover: async () => { calls.push("probe"); controller.dispose(); return "complete"; },
    refresh: async () => { calls.push("refresh"); }, changed: state => calls.push(state),
  });
  await controller.check([own, { ...own, id: "second" }], "uploader", []);
  assert.deepEqual(calls, ["checking", "probe"]);
});

test("a lost response re-reads saved rows without a second probe or fallback", async () => {
  const calls: unknown[] = [];
  const controller = createDriveRecoveryController("task-a", {
    recover: async () => { calls.push("probe"); throw Error("PRIVATE session URL"); },
    refresh: async () => { calls.push("refresh"); }, changed: state => calls.push(state),
  });
  await controller.check([own], "uploader", []);
  assert.deepEqual(calls, ["checking", "probe", "refresh", "unavailable"]);
});
