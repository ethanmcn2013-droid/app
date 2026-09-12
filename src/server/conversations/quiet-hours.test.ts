import assert from "node:assert/strict";
import test from "node:test";
import { resolveDeliveryEligibility, type QuietHoursInput } from "./quiet-hours";

const minute = (hour: number, value = 0) => hour * 60 + value;
const at = (iso: string) => Date.parse(iso);
const decide = (input: Partial<QuietHoursInput> = {}) => resolveDeliveryEligibility({
  timeZone: "UTC",
  startMinute: minute(22),
  endMinute: minute(7),
  nowMs: at("2026-09-12T23:00:00.000Z"),
  ...input,
});

test("quiet intervals are half-open for same-day and overnight schedules", () => {
  const sameDay = { startMinute: minute(9), endMinute: minute(17) };
  assert.deepEqual(decide({ ...sameDay, nowMs: at("2026-09-12T08:59:59.999Z") }), { ok: true, eligible: true, nextEligibleAtMs: null });
  assert.deepEqual(decide({ ...sameDay, nowMs: at("2026-09-12T09:00:00.000Z") }), { ok: true, eligible: false, nextEligibleAtMs: at("2026-09-12T17:00:00.000Z") });
  assert.deepEqual(decide({ ...sameDay, nowMs: at("2026-09-12T16:59:59.999Z") }), { ok: true, eligible: false, nextEligibleAtMs: at("2026-09-12T17:00:00.000Z") });
  assert.deepEqual(decide({ ...sameDay, nowMs: at("2026-09-12T17:00:00.000Z") }), { ok: true, eligible: true, nextEligibleAtMs: null });

  assert.deepEqual(decide({ nowMs: at("2026-09-12T21:59:59.999Z") }), { ok: true, eligible: true, nextEligibleAtMs: null });
  assert.deepEqual(decide({ nowMs: at("2026-09-12T22:00:00.000Z") }), { ok: true, eligible: false, nextEligibleAtMs: at("2026-09-13T07:00:00.000Z") });
  assert.deepEqual(decide({ nowMs: at("2026-09-13T06:59:59.999Z") }), { ok: true, eligible: false, nextEligibleAtMs: at("2026-09-13T07:00:00.000Z") });
  assert.deepEqual(decide({ nowMs: at("2026-09-13T07:00:00.000Z") }), { ok: true, eligible: true, nextEligibleAtMs: null });
});

test("null or equal bounds explicitly disable quiet hours", () => {
  assert.deepEqual(decide({ startMinute: null, endMinute: null }), { ok: true, eligible: true, nextEligibleAtMs: null });
  assert.deepEqual(decide({ startMinute: minute(9), endMinute: minute(9) }), { ok: true, eligible: true, nextEligibleAtMs: null });
});

test("invalid zones, instants, and partial or malformed bounds fail closed", () => {
  assert.deepEqual(decide({ timeZone: "" }), { ok: false, code: "invalid_time_zone" });
  assert.deepEqual(decide({ timeZone: "Europe/Not_A_Zone" }), { ok: false, code: "invalid_time_zone" });
  assert.deepEqual(decide({ nowMs: Number.NaN }), { ok: false, code: "invalid_instant" });
  assert.deepEqual(decide({ nowMs: Number.POSITIVE_INFINITY }), { ok: false, code: "invalid_instant" });
  for (const [startMinute, endMinute] of [[null, 60], [60, null], [-1, 60], [60, 1_440], [1.5, 60]]) {
    assert.deepEqual(decide({ startMinute, endMinute }), { ok: false, code: "invalid_quiet_hours" });
  }
  // Quiet hours being disabled never turns an invalid/implicit zone into UTC.
  assert.deepEqual(decide({ timeZone: "", startMinute: null, endMinute: null }), { ok: false, code: "invalid_time_zone" });
});

test("Europe/Dublin spring-forward quiet end is the exact local 07:00 instant", () => {
  const expected = 1_774_764_000_000; // 2026-03-29 07:00 IST / 06:00Z
  assert.deepEqual(decide({ timeZone: "Europe/Dublin", nowMs: 1_774_737_000_000 }), { ok: true, eligible: false, nextEligibleAtMs: expected });
  assert.deepEqual(decide({ timeZone: "Europe/Dublin", nowMs: 1_774_744_200_000 }), { ok: true, eligible: false, nextEligibleAtMs: expected });
});

test("Europe/Dublin autumn fallback quiet end is the exact local 07:00 instant", () => {
  const expected = 1_792_911_600_000; // 2026-10-25 07:00 GMT / 07:00Z
  assert.deepEqual(decide({ timeZone: "Europe/Dublin", nowMs: 1_792_877_400_000 }), { ok: true, eligible: false, nextEligibleAtMs: expected });
  assert.deepEqual(decide({ timeZone: "Europe/Dublin", nowMs: 1_792_884_600_000 }), { ok: true, eligible: false, nextEligibleAtMs: expected });
});

test("skipped and repeated Dublin end minutes resolve to the first future eligible instant", () => {
  const bounds = { timeZone: "Europe/Dublin", startMinute: minute(22), endMinute: minute(1, 30) };
  // 01:30 local does not exist on spring-forward day; 02:00 local is the first eligible minute.
  assert.deepEqual(decide({ ...bounds, nowMs: at("2026-03-28T22:30:00.000Z") }), {
    ok: true, eligible: false, nextEligibleAtMs: at("2026-03-29T01:00:00.000Z"),
  });
  // In the repeated hour, choose the matching 01:30 occurrence still ahead of now.
  assert.deepEqual(decide({ ...bounds, nowMs: at("2026-10-25T01:10:00.000Z") }), {
    ok: true, eligible: false, nextEligibleAtMs: at("2026-10-25T01:30:00.000Z"),
  });
});
