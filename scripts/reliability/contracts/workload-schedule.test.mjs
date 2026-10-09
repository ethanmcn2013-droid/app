import test from "node:test";
import assert from "node:assert/strict";
import { buildMixedWorkloadSchedule, estimateMixedRequestCount, WORKLOAD } from "./workload-schedule.mjs";

test("builds the planned deterministic three-repeat ten-session workload under the request cap", () => {
  const schedule = buildMixedWorkloadSchedule();
  assert.equal(schedule.repetitions, 3);
  assert.deepEqual(schedule.sessions, { chat: 4, browsing: 4, hidden: 2 });
  assert.equal(schedule.nominalRequests, estimateMixedRequestCount());
  assert.ok(schedule.nominalRequests <= WORKLOAD.totalRequestCap);
  assert.equal(schedule.nominalRequestsPerSecond.toFixed(2), "4.53");
  assert.ok(schedule.events.some((event) => event.phase === "warmup"));
  assert.ok(schedule.events.some((event) => event.phase === "measured"));
  assert.equal(schedule.events.some((event) => event.sessionId.startsWith("hidden-")), false);
});

test("is stable across runs and refuses a cap below planned load", () => {
  const first = buildMixedWorkloadSchedule();
  const second = buildMixedWorkloadSchedule();
  assert.deepEqual(first.events, second.events);
  assert.throws(() => buildMixedWorkloadSchedule({ requestCap: first.nominalRequests - 1 }), /exceeds cap/);
});
