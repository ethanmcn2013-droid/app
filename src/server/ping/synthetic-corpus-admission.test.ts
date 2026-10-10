import assert from "node:assert/strict";
import test from "node:test";
import { allowsPingSyntheticInterpretation, allowsPingSyntheticPcm } from "./synthetic-corpus-admission";

const pcm = new Uint8Array([0, 0, 1, 0, 2, 0, 3, 0]);
const context = { selectedTaskCount: 1, referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin",
  systemColumnKeys: ["todo", "doing", "review", "done"] };
const interpretation = { version: "ping.interpretation.v1", transcript: "Assign this task to me and move it to in progress.", ...context };

test("public fixture data cannot forge a corpus admission token", () => {
  for (const forged of [null, undefined, {}, Object.create(null), Object.freeze({})]) {
    assert.equal(allowsPingSyntheticPcm(forged, pcm, context), false);
    assert.equal(allowsPingSyntheticInterpretation(forged, interpretation), false);
  }
});

test("invalid bytes or interpretation remain denied even with a structurally plausible token", () => {
  const forged = Object.freeze({});
  assert.equal(allowsPingSyntheticPcm(forged, new Uint8Array(), context), false);
  assert.equal(allowsPingSyntheticPcm(forged, pcm, { ...context, selectedTaskCount: 99 }), false);
  assert.equal(allowsPingSyntheticInterpretation(forged, { ...interpretation, timeZone: "UTC" }), false);
});
