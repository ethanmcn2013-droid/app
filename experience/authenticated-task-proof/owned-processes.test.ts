import assert from "node:assert/strict";
import test from "node:test";
import { captureOwnedProcesses } from "./owned-processes";

test("read-only native custody resolves this source-test process by PID and creation time", { skip: process.platform !== "win32" }, async () => {
  const records = await captureOwnedProcesses(process.pid);
  const root = records.find(record => record.pid === process.pid);
  assert(root); assert.match(root.name, /^node(?:\.exe)?$/i); assert(Number.isFinite(Date.parse(root.created)));
  assert.equal(new Set(records.map(record => `${record.pid}:${record.created}`)).size, records.length);
  for (const record of records.filter(record => record.pid !== process.pid)) assert(records.some(parent => parent.pid === record.parentPid));
});
