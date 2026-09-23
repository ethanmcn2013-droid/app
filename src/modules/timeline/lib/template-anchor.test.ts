import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyTemplateAnchor,
  isCalendarDate,
  shiftCalendarDate,
} from "./template-anchor";
import { getSyncedTemplateRoadmap } from "./templates.generated";
import { SYNCED_TEMPLATE_ROADMAPS } from "./templates.generated";
import { SYNCED_TEMPLATES } from "../../../lib/templates.generated";
import { getTemplate } from "../../../lib/templates";
import { withWeddingTimelinePoints } from "../../../lib/wedding-template-timeline";

describe("template anchor dates", () => {
  it("accepts real calendar days and rejects impossible ones", () => {
    assert.equal(isCalendarDate("2026-10-03"), true);
    assert.equal(isCalendarDate("2026-02-29"), false); // 2026 is not a leap year
    assert.equal(isCalendarDate("2024-02-29"), true);
    assert.equal(isCalendarDate("2026-13-01"), false);
    assert.equal(isCalendarDate("2026-10-3"), false);
    assert.equal(isCalendarDate("03/10/2026"), false);
    assert.equal(isCalendarDate(""), false);
  });

  it("shifts calendar days in UTC across months, years, and leap days", () => {
    assert.equal(shiftCalendarDate("2026-10-03", -2), "2026-10-01");
    assert.equal(shiftCalendarDate("2026-10-03", -3), "2026-09-30");
    assert.equal(shiftCalendarDate("2026-01-01", -1), "2025-12-31");
    assert.equal(shiftCalendarDate("2024-03-01", -1), "2024-02-29");
    assert.equal(shiftCalendarDate("2026-10-03", 0), "2026-10-03");
    assert.equal(shiftCalendarDate("not-a-date", -1), null);
    assert.equal(shiftCalendarDate("2026-10-03", 1.5), null);
  });

  it("materializes offsets into target dates", () => {
    const items = [
      { title: "booked", anchorOffsetDays: -300 },
      { title: "walkthrough", anchorOffsetDays: -6 },
      { title: "no offset" },
    ];

    assert.deepEqual(applyTemplateAnchor(items, "2026-10-03"), [
      { title: "booked", anchorOffsetDays: -300, targetDate: "2025-12-07" },
      { title: "walkthrough", anchorOffsetDays: -6, targetDate: "2026-09-27" },
      { title: "no offset" },
    ]);
  });

  it("leaves items undated when no usable anchor is supplied", () => {
    const items = [{ title: "booked", anchorOffsetDays: -300 }];

    for (const anchor of [null, undefined, "", "not-a-date", "2026-02-30"]) {
      assert.deepEqual(
        applyTemplateAnchor(items, anchor),
        [{ title: "booked", anchorOffsetDays: -300 }],
        `anchor ${String(anchor)} must not invent a date`,
      );
    }
  });

  it("lets the offset win over a hardcoded target date", () => {
    assert.deepEqual(
      applyTemplateAnchor(
        [{ targetDate: "2020-01-01", anchorOffsetDays: -2 }],
        "2026-10-03",
      ),
      [{ targetDate: "2026-10-01", anchorOffsetDays: -2 }],
    );
  });

  it("never mutates the caller's items", () => {
    const items = [{ title: "booked", anchorOffsetDays: -300 }];
    applyTemplateAnchor(items, "2026-10-03");
    assert.deepEqual(items, [{ title: "booked", anchorOffsetDays: -300 }]);
  });

  it("dates every wedding milestone, in plan order, ending on the day itself", () => {
    const template = getSyncedTemplateRoadmap("wedding-planning-workspace");
    assert.ok(template, "the flagship template must exist");
    assert.ok(
      template.roadmap.anchor,
      "the flagship template must declare its anchor, or a first-run artifact has no countdown",
    );

    const dated = applyTemplateAnchor(template.roadmap.items, "2026-10-03");
    assert.equal(
      dated.every((item) => typeof item.targetDate === "string"),
      true,
      "every seeded milestone must carry a date once the day is known",
    );

    const dates = dated.map((item) => item.targetDate as string);
    assert.deepEqual(
      [...dates].sort(),
      dates,
      "milestones must seed in ascending date order",
    );
    assert.equal(
      dates.every((date) => date < "2026-10-03"),
      true,
      "no planning milestone may land on or after the day itself",
    );
  });
});

describe("connected template records", () => {
  it("Tasks and Timeline slices have the same unique identities and no orphan project references", () => {
    assert.deepEqual(SYNCED_TEMPLATES.map((t) => t.id), SYNCED_TEMPLATE_ROADMAPS.map((t) => t.id));
    assert.equal(new Set(SYNCED_TEMPLATES.map((t) => t.id)).size, SYNCED_TEMPLATES.length);
    for (const template of SYNCED_TEMPLATE_ROADMAPS) {
      assert.equal(SYNCED_TEMPLATES.find((t) => t.id === template.id)?.name, template.name);
      const slugs = new Set(template.roadmap.projects.map((project) => project.slug));
      assert.equal(slugs.size, template.roadmap.projects.length);
      for (const item of template.roadmap.items) assert.ok(slugs.has(item.projectSlug), `${template.id}: ${item.title}`);
    }
  });

  it("keeps 18 wedding tasks, six task milestones and eight separate legacy Timeline seed items distinct", () => {
    const raw = SYNCED_TEMPLATES.find((template) => template.id === "wedding-planning-workspace")!;
    const before = structuredClone(raw);
    const connected = withWeddingTimelinePoints(raw);
    assert.equal(raw.tasks.length, 18);
    assert.equal(raw.tasks.filter((task) => task.milestone).length, 0);
    assert.equal(connected.tasks.filter((task) => task.milestone).length, 6);
    assert.deepEqual(withWeddingTimelinePoints(connected), connected);
    assert.deepEqual(getTemplate(raw.id), connected);
    assert.deepEqual(raw, before);
    assert.equal(getSyncedTemplateRoadmap(raw.id)?.roadmap.items.length, 8);
    const originalFields = structuredClone(connected.tasks);
    for (const task of originalFields) {
      delete task.milestone;
      delete task.dueOffsetDays;
    }
    assert.deepEqual(originalFields, raw.tasks);
  });
});
