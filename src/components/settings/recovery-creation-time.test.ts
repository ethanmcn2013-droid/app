import assert from "node:assert/strict";
import { test } from "node:test";
import { recoveryCreationTime } from "./recovery-creation-time";

test("precise localized long English labels retain distinct same-day times and explicit UTC", () => {
  const first = recoveryCreationTime("2027-09-30T08:05:09Z");
  const later = recoveryCreationTime("2027-09-30T08:05:10Z");
  assert.equal(first.label, "30 September 2027 at 08:05:09 UTC");
  assert.equal(later.label, "30 September 2027 at 08:05:10 UTC");
  assert.equal(first.dateTime, "2027-09-30T08:05:09.000Z");
  assert.deepEqual(recoveryCreationTime("2027-09-30T10:05:09+02:00"), first);
});

test("nonzero source precision survives without inventing millisecond precision for whole seconds", () => {
  assert.equal(recoveryCreationTime("2027-09-30T08:05:09.123Z").label, "30 September 2027 at 08:05:09.123 UTC");
  assert.doesNotMatch(recoveryCreationTime("2027-09-30T08:05:09.000Z").label, /\.000/);
});

test("same-time records honestly retain the same timestamp; their row reference must distinguish them", () => {
  assert.deepEqual(recoveryCreationTime("2027-09-30T08:05:09Z"), recoveryCreationTime("2027-09-30T08:05:09.000Z"));
  assert.deepEqual(recoveryCreationTime("invalid"), { label: "Creation time unavailable" });
});

test("host time zone cannot change a creation instant's day or clock label", () => {
  const before = process.env.TZ;
  try {
    for (const zone of ["UTC", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      process.env.TZ = zone;
      assert.equal(recoveryCreationTime("2027-09-30T00:01:02Z").label, "30 September 2027 at 00:01:02 UTC");
    }
  } finally {
    if (before === undefined) delete process.env.TZ; else process.env.TZ = before;
  }
});
