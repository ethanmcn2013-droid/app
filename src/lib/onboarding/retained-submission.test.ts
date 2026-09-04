import test from "node:test";
import assert from "node:assert/strict";
import { createRetainedSubmission } from "./retained-submission";

const input = { workspaceId: "project-a", segment: "wedding", reseed: true };
const storage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
};

test("failure keeps the exact Project, request and choices; success releases them for an intentional new apply", async () => {
  let ids = 0;
  const controller = createRetainedSubmission<typeof input>(input.workspaceId, { newId: () => `request-${++ids}` });
  const calls: unknown[] = [];
  const fail = async (value: unknown) => { calls.push(value); throw new Error("response lost"); };
  await assert.rejects(controller.run(input, fail));
  await controller.run({ ...input, segment: "venue" }, async value => { calls.push(value); });
  assert.deepEqual(calls[0], calls[1]);
  await controller.run(input, async value => { calls.push(value); });
  assert.notDeepEqual(calls[1], calls[2]);
  assert.equal(ids, 2);
});

test("welcome reload recovers the saved submission before creating any new request", async () => {
  const saved = storage();
  const options = { newId: () => "first-request", storage: () => saved, storageKey: "actor:project-a" };
  const first = createRetainedSubmission<typeof input>(input.workspaceId, options);
  await assert.rejects(first.run(input, async () => { throw new Error("lost"); }));
  first.dispose();
  const reloaded = createRetainedSubmission<typeof input>(input.workspaceId, { ...options, newId: () => { throw new Error("must not mint"); } });
  await reloaded.run({ ...input, segment: "different" }, async value => {
    assert.equal(value.requestId, "first-request");
    assert.equal(value.segment, "wedding");
  });
  assert.equal(saved.getItem(options.storageKey), null);
});

test("concurrent clicks issue one call and do not report false completion", async () => {
  const controller = createRetainedSubmission<typeof input>(input.workspaceId);
  let release!: () => void;
  let calls = 0;
  const first = controller.run(input, async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); });
  assert.equal(await controller.run(input, async () => { calls++; }), false);
  release();
  assert.equal(await first, true);
  assert.equal(calls, 1);
});

test("changed Project is refused before dispatch; disposal never signals navigation success", async () => {
  const controller = createRetainedSubmission<typeof input>(input.workspaceId);
  let calls = 0;
  await assert.rejects(controller.run({ ...input, workspaceId: "project-b" }, async () => { calls++; }));
  assert.equal(calls, 0);
  assert.equal(await controller.run(input, async () => { controller.dispose(); }), false);
  assert.equal(await controller.run(input, async () => { calls++; }), false);
  assert.equal(calls, 0);
});

test("corrupt saved state or failed durable storage cannot dispatch a new starter", async () => {
  const saved = storage();
  saved.setItem("intent", "not-json");
  let calls = 0;
  const bad = createRetainedSubmission<typeof input>(input.workspaceId, { storage: () => saved, storageKey: "intent" });
  await assert.rejects(bad.run(input, async () => { calls++; }));
  const blocked = createRetainedSubmission<typeof input>(input.workspaceId, { storage: () => { throw new Error("storage blocked"); }, storageKey: "intent" });
  await assert.rejects(blocked.run(input, async () => { calls++; }));
  assert.equal(calls, 0);
});
