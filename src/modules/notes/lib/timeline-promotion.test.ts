import assert from "node:assert/strict";
import test from "node:test";
import {
  createTimelinePromotionCommand,
  timelinePromotionPreview,
} from "./timeline-promotion";

test("Timeline command contains only the deliberate safe projection", () => {
  const privateBody = "Private supplier concern that must never leave Notes";
  const command = createTimelinePromotionCommand({
    noteId: "n_1",
    workspaceId: "ws_1",
    title: "Deposit due",
    date: "2026-08-14",
    completion: 40,
    audienceLabel: "Maeve and Dara",
  });
  const serialized = JSON.stringify({ command, analytics: { event: "timeline_projection_prepared" } });
  assert.equal(serialized.includes(privateBody), false);
  assert.equal("body" in command, false);
  assert.equal("extractBody" in command, false);
  assert.deepEqual(command.projection, {
    title: "Deposit due",
    date: "2026-08-14",
    completion: 40,
  });
  assert.equal(
    timelinePromotionPreview(command),
    "Deposit due · 2026-08-14 · 40% · for Maeve and Dara",
  );
});

test("Timeline command rejects malformed dates, completion, and blank audiences", () => {
  const base = {
    noteId: "n_1",
    workspaceId: "ws_1",
    title: "Deposit due",
    date: "2026-08-14",
    completion: 40,
    audienceLabel: "Maeve",
  };
  assert.throws(() => createTimelinePromotionCommand({ ...base, date: "Friday" }));
  assert.throws(() => createTimelinePromotionCommand({ ...base, completion: 101 }));
  assert.throws(() => createTimelinePromotionCommand({ ...base, audienceLabel: " " }));
});
