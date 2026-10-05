import assert from "node:assert/strict";
import test from "node:test";
import { computeProjectAnalytics } from "@/lib/projects/project-analytics";
import { CONSOLE_DAYS, doneByDay } from "@/lib/projects/project-console";
import { demoAnalyticsSource } from "./project-analytics-demo";

/**
 * In review mode the Console's "This week" and the Analytics page read one
 * source. This pins that they also count the same weeks from it: the last
 * seven days and the seven before, in the reader's time zone.
 */
test("the Console's week is the week Analytics draws", () => {
  const source = demoAnalyticsSource();
  const analytics = computeProjectAnalytics({ ...source, columns: [], people: [], range: "4w" });
  const days = doneByDay(
    source.tasks.filter((task) => task.done && task.completedAt != null).map((task) => task.completedAt!),
    source.now,
    source.timeZone,
  );
  assert.equal(days.length, CONSOLE_DAYS);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  assert.equal(sum(days.slice(7)), analytics.weeks.at(-1)!.finished);
  assert.equal(sum(days.slice(0, 7)), analytics.weeks.at(-2)!.finished);
  assert.ok(sum(days) > 0, "the review source has finished work in the last fortnight");
});
