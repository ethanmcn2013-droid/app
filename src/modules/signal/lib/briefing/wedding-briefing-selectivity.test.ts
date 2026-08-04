/**
 * E05.09 — is the wedding briefing actually selective, and does it have
 * anything to be selective about?
 *
 * "Showing only what needs the couple's attention today" is the whole product
 * claim. Two separate things have to be true for it to hold:
 *
 *   A. The engine filters. It reads everything, surfaces a bounded few, and
 *      states its denominator so the claim is a receipt rather than an
 *      assertion.
 *   B. The couple's workspace contains the dates the filter runs on.
 *
 * A passes today and is pinned below. B does not, and the last block records
 * exactly why, against the shipped wedding template rather than a fixture.
 *
 * Run:
 *   node --import tsx --import ./src/test/register-server-only.mjs --test \
 *     src/modules/signal/lib/briefing/wedding-briefing-selectivity.test.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBriefing } from "./build";
import type { BriefingSource } from "./source";
import type { TaskSignal } from "./types";
import { SYNCED_TEMPLATES } from "@/lib/templates.generated";
import { resolveTemplateDueAt, templateMilestoneCount } from "@/lib/template-anchor";

const DAY = 86_400_000;
const NOW = Date.parse("2026-08-03T09:00:00.000Z");
const WEDDING_DATE = "2027-06-19";

function sourceOf(signals: TaskSignal[]): BriefingSource {
  return { getSignalsForUser: async () => signals };
}

function task(overrides: Partial<TaskSignal> & { id: string; title: string }): TaskSignal {
  return {
    lane: "next",
    priority: 2,
    dueAt: null,
    idleDays: 0,
    commentCount: 0,
    blockedBy: [],
    sourceLabel: "Tasks · Our wedding",
    movedToShippedAt: null,
    ...overrides,
  };
}

// ── A. the engine filters ────────────────────────────────────────────────────

test("a quiet wedding workspace produces an empty briefing, not a list", async () => {
  const signals = Array.from({ length: 30 }, (_, i) =>
    task({ id: `t${i}`, title: `Wedding item ${i}`, idleDays: 0 }),
  );
  const briefing = await buildBriefing(sourceOf(signals), { userId: "u", email: "" }, NOW);

  assert.equal(briefing.isEmpty, true);
  assert.equal(briefing.needsAttention.length, 0);
  assert.equal(briefing.readCount, 30, "the denominator must be everything read");
  assert.equal(briefing.triggeredCount, 0);
});

test("thirty items with three real deadlines surface three, and say so", async () => {
  const signals: TaskSignal[] = [
    ...Array.from({ length: 27 }, (_, i) =>
      task({ id: `quiet${i}`, title: `Quiet item ${i}` }),
    ),
    task({ id: "due-today", title: "Confirm final guest numbers", lane: "in-flight", dueAt: NOW }),
    task({ id: "overdue", title: "Send menu decisions to catering", lane: "in-flight", dueAt: NOW - 3 * DAY }),
    task({ id: "due-tomorrow", title: "Confirm supplier arrival times", lane: "in-flight", dueAt: NOW + DAY }),
  ];
  const briefing = await buildBriefing(sourceOf(signals), { userId: "u", email: "" }, NOW);

  assert.equal(briefing.readCount, 30);
  assert.equal(briefing.needsAttention.length, 3);
  assert.deepEqual(
    briefing.needsAttention.map((i) => i.id).sort(),
    ["due-today", "due-tomorrow", "overdue"],
  );
});

test("the three-item cap holds even when everything is on fire", async () => {
  const signals = Array.from({ length: 40 }, (_, i) =>
    task({
      id: `hot${i}`,
      title: `Overdue item ${i}`,
      lane: "in-flight",
      dueAt: NOW - (i + 1) * DAY,
      idleDays: 10,
    }),
  );
  const briefing = await buildBriefing(sourceOf(signals), { userId: "u", email: "" }, NOW);

  assert.equal(briefing.needsAttention.length, 3);
  assert.ok(briefing.quietRisks.length + briefing.movingWell.length <= 3);
  assert.equal(briefing.readCount, 40);
  // Work that crossed a rule but lost its slot must be counted as held back,
  // never as clear. Without this the all-clear copy could lie.
  assert.ok(
    briefing.triggeredCount > briefing.needsAttention.length,
    "triggeredCount must be counted before the cap",
  );
});

test("one task that crosses several rules appears once", async () => {
  const signals = [
    // Overdue, idle long enough for stuck-work, and blocked long enough for
    // blocked-too-long would each claim it.
    task({
      id: "same",
      title: "Confirm the marquee",
      lane: "in-flight",
      dueAt: NOW - 6 * DAY,
      idleDays: 9,
      blockedBy: ["upstream"],
    }),
    task({ id: "upstream", title: "Marquee supplier quote", lane: "in-flight", idleDays: 9 }),
  ];
  const briefing = await buildBriefing(sourceOf(signals), { userId: "u", email: "" }, NOW);
  const all = [...briefing.needsAttention, ...briefing.quietRisks, ...briefing.movingWell];
  const occurrences = all.filter((item) => item.id === "same").length;
  assert.equal(occurrences, 1, "a task must not be reported twice in one read");
});

test("a dismissed item stays dismissed for the reason it was dismissed", async () => {
  const signals = [
    task({ id: "dismissed", title: "Chase the florist", lane: "in-flight", dueAt: NOW }),
  ];
  const briefing = await buildBriefing(
    sourceOf(signals),
    { userId: "u", email: "" },
    NOW,
    { suppressed: new Set(["due-soon:dismissed"]) },
  );
  assert.equal(briefing.isEmpty, true);
  assert.equal(briefing.readCount, 1, "a dismissal must not shrink the denominator");
});

// ── B. does a real sponsored couple have anything to filter? ─────────────────

test("the venue wedding template exists and its anchoring is measurable", () => {
  const template = SYNCED_TEMPLATES.find(
    (t) => t.id === "wedding-planning-workspace",
  );
  assert.ok(template, "the venue wedding template must exist");
  assert.ok(template.tasks.length > 0);

  // Deliberately not an equality assertion on the counts. E05.03 owns the
  // template and is rewriting it in the same worktree; pinning today's numbers
  // here would booby-trap that work. The measured values on 2026-08-03 are
  // recorded in the E05.09 evidence document with the command that produced
  // them. What must hold whatever E05.03 does is the next two tests.
  const withOffset = template.tasks.filter(
    (t) => (t as { dueOffsetDays?: number | null }).dueOffsetDays != null,
  ).length;
  assert.ok(Number.isInteger(withOffset));
  assert.ok(Number.isInteger(templateMilestoneCount(template.tasks)));
});

test("with no wedding date, the anchoring machinery correctly yields no due date", () => {
  // The refusal is deliberate and right: an invented deadline is worse than an
  // absent one. It is recorded here so the gap is read as missing input, not
  // as broken code.
  assert.equal(resolveTemplateDueAt({ anchorDate: null, dueOffsetDays: -14 }), null);
  assert.equal(resolveTemplateDueAt({ anchorDate: WEDDING_DATE, dueOffsetDays: null }), null);
  const anchored = resolveTemplateDueAt({ anchorDate: WEDDING_DATE, dueOffsetDays: -14 });
  assert.ok(anchored instanceof Date);
  assert.equal(anchored.toISOString().slice(0, 10), "2027-06-05");
});

test("without a wedding date no template task can ever ask for the couple's attention", async () => {
  const template = SYNCED_TEMPLATES.find((t) => t.id === "wedding-planning-workspace")!;
  // Exactly what applyTemplateToWorkspace writes for a workspace whose
  // primary_date is null, which is every redeemed workspace today.
  const signals: TaskSignal[] = template.tasks.map((t, i) =>
    task({
      id: `tpl-${i}`,
      title: t.title,
      lane: t.lane === "done" ? "shipped" : t.lane === "todo" ? "next" : "in-flight",
      dueAt: resolveTemplateDueAt({
        anchorDate: null,
        dueOffsetDays: (t as { dueOffsetDays?: number | null }).dueOffsetDays,
      })?.getTime() ?? null,
      idleDays: 0,
    }),
  );

  const briefing = await buildBriefing(sourceOf(signals), { userId: "u", email: "" }, NOW);
  assert.equal(briefing.readCount, template.tasks.length);

  // The load-bearing property, and it holds however E05.03 rewrites the
  // template: with no wedding date on the workspace, resolveTemplateDueAt
  // refuses every offset, so no seeded task can be due-soon or cluster into a
  // crowded week. The date-driven half of the briefing is dark.
  const dated = briefing.needsAttention.filter(
    (item) => item.trigger === "due-soon" || item.trigger === "crowded-week",
  );
  assert.equal(
    dated.length,
    0,
    "no seeded task can be dated, so none can be surfaced by date",
  );

  // Anything that does reach the couple on day one is therefore a reading of
  // the template rather than a wedding task. On 2026-08-03 that is exactly one
  // row, the synthetic over-five overload alert raised by the seven items the
  // product itself just put in doing and review.
  for (const item of briefing.needsAttention) {
    assert.ok(
      item.id.startsWith("synthetic:"),
      `a real task reached the first briefing without a date: ${item.id}`,
    );
  }
});

test("the same template anchored to a wedding date does surface what is close", async () => {
  // Proof that the only missing piece is the date, not the engine. Offsets are
  // supplied here as a demonstration; the shipped template declares none.
  const template = SYNCED_TEMPLATES.find((t) => t.id === "wedding-planning-workspace")!;
  const near = Date.parse("2027-06-05T09:00:00.000Z");
  const signals: TaskSignal[] = template.tasks.slice(0, 6).map((t, i) =>
    task({
      id: `tpl-${i}`,
      title: t.title,
      lane: "in-flight",
      dueAt:
        resolveTemplateDueAt({
          anchorDate: WEDDING_DATE,
          dueOffsetDays: -14 + i,
        })?.getTime() ?? null,
    }),
  );

  const briefing = await buildBriefing(sourceOf(signals), { userId: "u", email: "" }, near);
  assert.ok(briefing.needsAttention.length > 0);
  assert.ok(briefing.needsAttention.length <= 3, "still bounded");
  assert.equal(briefing.readCount, 6);
});
