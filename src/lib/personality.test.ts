/**
 * Tests for personality.ts — greeting builder.
 *
 * Run: node --import tsx --test src/lib/personality.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGreeting, numWord } from "./personality";

// ── Hour band salutations ────────────────────────────────────────────────────

test("hour 5 → Morning salutation", () => {
  const result = buildGreeting({ name: null, hour: 5, dueToday: 0, overdue: 0, doneToday: 0 });
  assert.ok(result?.line.startsWith("Morning."));
});

test("hour 11 → Morning salutation", () => {
  const result = buildGreeting({ name: null, hour: 11, dueToday: 0, overdue: 0, doneToday: 0 });
  assert.ok(result?.line.startsWith("Morning."));
});

test("hour 12 → Afternoon salutation", () => {
  const result = buildGreeting({ name: null, hour: 12, dueToday: 0, overdue: 0, doneToday: 0 });
  assert.ok(result?.line.startsWith("Afternoon."));
});

test("hour 16 → Afternoon salutation", () => {
  const result = buildGreeting({ name: null, hour: 16, dueToday: 0, overdue: 0, doneToday: 0 });
  assert.ok(result?.line.startsWith("Afternoon."));
});

test("hour 17 → Evening salutation", () => {
  const result = buildGreeting({ name: null, hour: 17, dueToday: 0, overdue: 0, doneToday: 0 });
  assert.ok(result?.line.startsWith("Evening."));
});

test("hour 22 → Evening salutation", () => {
  const result = buildGreeting({ name: null, hour: 22, dueToday: 0, overdue: 0, doneToday: 0 });
  assert.ok(result?.line.startsWith("Evening."));
});

test("hour 23 → Hello salutation (no time word)", () => {
  const result = buildGreeting({ name: null, hour: 23, dueToday: 0, overdue: 0, doneToday: 0 });
  assert.ok(result?.line.startsWith("Hello."));
});

test("hour 0 → Hello salutation (midnight)", () => {
  const result = buildGreeting({ name: null, hour: 0, dueToday: 0, overdue: 0, doneToday: 0 });
  assert.ok(result?.line.startsWith("Hello."));
});

test("hour 4 → Hello salutation (early hours)", () => {
  const result = buildGreeting({ name: null, hour: 4, dueToday: 0, overdue: 0, doneToday: 0 });
  assert.ok(result?.line.startsWith("Hello."));
});

// ── Out-of-range returns null ─────────────────────────────────────────────────

test("hour -1 → null (out of range)", () => {
  const result = buildGreeting({ name: null, hour: -1, dueToday: 0, overdue: 0, doneToday: 0 });
  assert.equal(result, null);
});

test("hour 24 → null (out of range)", () => {
  const result = buildGreeting({ name: null, hour: 24, dueToday: 0, overdue: 0, doneToday: 0 });
  assert.equal(result, null);
});

// ── Name inclusion ────────────────────────────────────────────────────────────

test("name present → comma-name in opening", () => {
  const result = buildGreeting({ name: "Niamh", hour: 9, dueToday: 0, overdue: 0, doneToday: 0 });
  assert.ok(result?.line.startsWith("Morning, Niamh."));
});

test("name null → no comma-name", () => {
  const result = buildGreeting({ name: null, hour: 9, dueToday: 0, overdue: 0, doneToday: 0 });
  assert.ok(result?.line.startsWith("Morning."));
  assert.ok(!result?.line.includes(","));
});

// ── Substance sentence priority: overdue > dueToday > doneToday > zero ───────

test("overdue > 0 → overdue message takes priority over dueToday", () => {
  const result = buildGreeting({ name: null, hour: 9, dueToday: 3, overdue: 2, doneToday: 0 });
  assert.ok(result?.line.includes("overdue"), `Expected 'overdue' in: ${result?.line}`);
  assert.ok(!result?.line.includes("due today"), `Should not mention due-today: ${result?.line}`);
});

test("overdue 0, dueToday > 0 → due today message", () => {
  const result = buildGreeting({ name: null, hour: 9, dueToday: 3, overdue: 0, doneToday: 5 });
  assert.ok(result?.line.includes("due today"), `Expected 'due today' in: ${result?.line}`);
  assert.ok(!result?.line.includes("completed"), `Should not mention completed: ${result?.line}`);
});

test("all zero → 'Nothing is due today.'", () => {
  const result = buildGreeting({ name: null, hour: 9, dueToday: 0, overdue: 0, doneToday: 0 });
  assert.ok(result?.line.includes("Nothing is due today."));
});

test("only doneToday > 0 → completed message", () => {
  const result = buildGreeting({ name: null, hour: 14, dueToday: 0, overdue: 0, doneToday: 3 });
  assert.ok(result?.line.includes("completed"), `Expected 'completed' in: ${result?.line}`);
});

// ── Singular vs plural ────────────────────────────────────────────────────────

test("overdue 1 → singular 'One task is overdue.'", () => {
  const result = buildGreeting({ name: null, hour: 9, dueToday: 0, overdue: 1, doneToday: 0 });
  assert.ok(result?.line.includes("One task is overdue."), `Got: ${result?.line}`);
});

test("overdue 2 → plural 'Two tasks are overdue.'", () => {
  const result = buildGreeting({ name: null, hour: 9, dueToday: 0, overdue: 2, doneToday: 0 });
  assert.ok(result?.line.includes("Two tasks are overdue."), `Got: ${result?.line}`);
});

test("dueToday 1 → singular 'One task is due today.'", () => {
  const result = buildGreeting({ name: null, hour: 9, dueToday: 1, overdue: 0, doneToday: 0 });
  assert.ok(result?.line.includes("One task is due today."), `Got: ${result?.line}`);
});

test("dueToday 5 → plural 'Five tasks are due today.'", () => {
  const result = buildGreeting({ name: null, hour: 9, dueToday: 5, overdue: 0, doneToday: 0 });
  assert.ok(result?.line.includes("Five tasks are due today."), `Got: ${result?.line}`);
});

test("doneToday 1 → 'You have completed one today.'", () => {
  const result = buildGreeting({ name: null, hour: 9, dueToday: 0, overdue: 0, doneToday: 1 });
  assert.ok(result?.line.includes("You have completed one today."), `Got: ${result?.line}`);
});

test("doneToday 3 → 'You have completed three today.'", () => {
  const result = buildGreeting({ name: null, hour: 9, dueToday: 0, overdue: 0, doneToday: 3 });
  assert.ok(result?.line.includes("You have completed three today."), `Got: ${result?.line}`);
});

// ── Number-word boundary ─────────────────────────────────────────────────────

test("numWord boundary: 9 → 'nine'", () => {
  assert.equal(numWord(9), "nine");
});

test("numWord boundary: 10 → '10'", () => {
  assert.equal(numWord(10), "10");
});

test("overdue 9 → word 'Nine'", () => {
  const result = buildGreeting({ name: null, hour: 9, dueToday: 0, overdue: 9, doneToday: 0 });
  assert.ok(result?.line.includes("Nine tasks are overdue."), `Got: ${result?.line}`);
});

test("overdue 10 → digit '10'", () => {
  const result = buildGreeting({ name: null, hour: 9, dueToday: 0, overdue: 10, doneToday: 0 });
  assert.ok(result?.line.includes("10 tasks are overdue."), `Got: ${result?.line}`);
});

// ── Brand-voice checks ────────────────────────────────────────────────────────

test("no em dashes in any output", () => {
  const inputs = [
    { name: "Niamh", hour: 9, dueToday: 3, overdue: 0, doneToday: 0 },
    { name: null, hour: 14, dueToday: 0, overdue: 2, doneToday: 5 },
    { name: "Rian", hour: 20, dueToday: 0, overdue: 0, doneToday: 0 },
  ];
  for (const input of inputs) {
    const result = buildGreeting(input);
    assert.ok(!result?.line.includes("—"), `Em dash found in: ${result?.line}`);
  }
});

test("no exclamation marks in any output", () => {
  const inputs = [
    { name: null, hour: 9, dueToday: 0, overdue: 0, doneToday: 0 },
    { name: "Cian", hour: 17, dueToday: 5, overdue: 0, doneToday: 0 },
  ];
  for (const input of inputs) {
    const result = buildGreeting(input);
    assert.ok(!result?.line.includes("!"), `Exclamation mark found in: ${result?.line}`);
  }
});
