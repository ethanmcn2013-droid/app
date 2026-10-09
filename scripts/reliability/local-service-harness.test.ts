import assert from "node:assert/strict";
import test from "node:test";
import { assertLocalServiceUrl } from "./local-service-harness";
import { runLocalServiceHarness } from "./local-service-run";

test("local persisted service probe guards before writes and reconciles actual writes, faults and restart reads", async () => {
  const { receipt } = await runLocalServiceHarness("smoke", 2);
  assert.equal(receipt.reconciliation.ok, true);
  assert.equal(receipt.probe.attempts, 32);
  assert.deepEqual(receipt.counts, { projects: 2, tasks: 10, messages: 30, resources: 5 });
  assert.equal(receipt.freshProcessRead.taskRelationship, true);
  assert.equal(receipt.faults.membershipRevocationDenied, true);
});

test("local service target refuses remote, authority and query-bearing bindings", () => {
  for (const url of ["libsql://remote.example/tasks.db", "file://host/tasks.db", "file:C:/local/tasks.db?auth=secret"]) assert.throws(() => assertLocalServiceUrl(url), /target_refused/);
});
