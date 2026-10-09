import assert from "node:assert/strict";
import { test } from "node:test";
import { createTaskDetailReadHttp } from "./detail-read-http";

const origin = "https://signal.example";

function request(body: unknown, headers: Record<string, string> = {}, url = `${origin}/api/tasks/detail-read`) {
  return new Request(url, {
    method: "POST",
    headers: {
      origin,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("exact section dispatch keeps each current action independent", async () => {
  const calls: string[] = [];
  const handle = createTaskDetailReadHttp({
    subtasks: async (id) => { calls.push(`subtasks:${id}`); return [{ id }]; },
    resources: async (id) => { calls.push(`resources:${id}`); return []; },
    conversation: async (id) => { calls.push(`conversation:${id}`); return { ok: false, code: "unauthenticated" }; },
  });
  const one = await handle(request({ section: "subtasks", taskId: "task-1" }));
  const two = await handle(request({ section: "conversation", taskId: "task-2" }));
  assert.equal(one.status, 200);
  assert.deepEqual(await one.json(), { value: [{ id: "task-1" }] });
  assert.deepEqual(await two.json(), { value: { ok: false, code: "unauthenticated" } });
  assert.deepEqual(calls, ["subtasks:task-1", "conversation:task-2"]);
  assert.equal(one.headers.get("cache-control"), "private, no-store, max-age=0");
  const oldWriterId = `task:external.${"x".repeat(130)}`;
  assert.equal((await handle(request({ section: "subtasks", taskId: oldWriterId }))).status, 200);
  assert.equal(calls.at(-1), `subtasks:${oldWriterId}`);
});

test("origin, fetch-site, body and identity forgery refuse before action invocation", async () => {
  let calls = 0;
  const read = async () => { calls++; return []; };
  const handle = createTaskDetailReadHttp({ subtasks: read, resources: read, conversation: read });
  const cases: Request[] = [
    request({ section: "subtasks", taskId: "task-1" }, { origin: "https://evil.example" }),
    request({ section: "subtasks", taskId: "task-1" }, { "sec-fetch-site": "cross-site" }),
    request({ section: "subtasks", taskId: "task-1", actorId: "forged" }),
    request({ section: "subtasks", taskId: "task-1", projectId: "forged" }),
    request({ section: "subtasks", taskId: "" }),
    request({ section: "subtasks", taskId: 123 }),
    request({ section: "other", taskId: "task-1" }),
    request({ section: "subtasks", taskId: "task-1" }, { "content-type": "text/plain" }),
    request({ section: "subtasks", taskId: "task-1" }, {}, `${origin}/api/tasks/detail-read?actor=forged`),
    request({ section: "subtasks", taskId: "task-1" }, { "content-length": "513" }),
    request({ section: "subtasks", taskId: "x".repeat(550) }),
  ];
  for (const input of cases) assert.notEqual((await handle(input)).status, 200);
  assert.equal(calls, 0);
});

test("action denial and failure remain distinct", async () => {
  const handle = createTaskDetailReadHttp({
    subtasks: async () => [],
    resources: async () => { throw new Error("private denial"); },
    conversation: async () => ({ ok: false, code: "unavailable" }),
  });
  const refused = await handle(request({ section: "resources", taskId: "task-1" }));
  assert.equal(refused.status, 500);
  assert.equal(await refused.text(), "");
  assert.deepEqual(await (await handle(request({ section: "conversation", taskId: "task-1" }))).json(),
    { value: { ok: false, code: "unavailable" } });
});
