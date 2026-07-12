import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePeriodInput, normalizeWorkspaceNames } from "./input";

test("scenario B: six pasted class names become six distinct workspace inputs", () => {
  const result = normalizeWorkspaceNames(
    "6th Year Geography\n5th Year History\nTransition Year\n2nd Year English\n1st Year Science\nLeaving Cert Politics",
  );
  assert.equal(result.names.length, 6);
  assert.equal(result.duplicates.length, 0);
});

test("scenario C: modules dedupe case-insensitively without merging subjects", () => {
  const result = normalizeWorkspaceNames([
    "Psychology",
    "Law",
    "Marketing",
    "Statistics",
    "psychology",
  ]);
  assert.deepEqual(result.names, ["Psychology", "Law", "Marketing", "Statistics"]);
  assert.deepEqual(result.duplicates, ["psychology"]);
});

test("runtime v2 requires a finite planning horizon", () => {
  assert.throws(
    () => normalizePeriodInput({ name: "Active work", contextType: "general", timezone: "UTC" }, { requireFinite: true }),
    /require a start date and an end date/,
  );
  const period = normalizePeriodInput(
    {
      name: "2026–27",
      contextType: "school_year",
      startDate: "2026-08-24",
      endDate: "2027-06-30",
      timezone: "Europe/Dublin",
    },
    { requireFinite: true },
  );
  assert.equal(period.startDate, "2026-08-24");
  assert.equal(period.endDate, "2027-06-30");
});

test("invalid IANA timezone and reversed dates fail before persistence", () => {
  assert.throws(
    () => normalizePeriodInput({ name: "Term", contextType: "semester", startDate: "2026-09-01", endDate: "2026-01-01", timezone: "Europe/Dublin" }, { requireFinite: true }),
    /End date/,
  );
  assert.throws(
    () => normalizePeriodInput({ name: "Term", contextType: "semester", startDate: "2026-01-01", endDate: "2026-06-01", timezone: "Dublin-ish" }, { requireFinite: true }),
    /IANA timezone/,
  );
});
