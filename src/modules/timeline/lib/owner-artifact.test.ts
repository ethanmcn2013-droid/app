import assert from "node:assert/strict";
import { test } from "node:test";
import type { AudienceOwnerPublication } from "@/modules/timeline/server/audience-timeline";
import { ownerPublicationToTimelineDto } from "./owner-artifact";

const publication: AudienceOwnerPublication = {
  id: "publication-1",
  label: "Mara & Finn",
  audienceKind: "couple",
  ownerDisplayLabel: "Shared by Mara & Finn",
  primaryDateLabel: "Wedding day",
  primaryDate: "2026-10-03",
  timezone: "Europe/Dublin",
  state: "published",
  lastUpdatedAt: new Date("2026-07-22T10:00:00.000Z"),
  qualifiedViewCount: 12,
  lastQualifiedViewAt: new Date("2026-07-22T10:30:00.000Z"),
  activeShareCount: 1,
  items: [
    {
      publicId: "later",
      sourceRelation: "tasks-milestone-later",
      title: "Wedding day",
      calendarDate: "2026-10-03",
      state: "later",
      sortOrder: 2,
      divergedAt: null,
    },
    {
      publicId: "done",
      sourceRelation: "tasks-milestone-done",
      title: "Venue chosen",
      calendarDate: "2026-05-12",
      state: "covered",
      sortOrder: 0,
      divergedAt: null,
    },
  ],
};

test("owner preview uses the same strict public projection as the shared artifact", () => {
  const dto = ownerPublicationToTimelineDto(
    publication,
    new Date("2026-07-22T12:00:00.000Z"),
  );

  assert.equal(dto.label, "Mara & Finn");
  assert.equal(dto.today, "2026-07-22");
  assert.deepEqual(dto.sections.map((section) => section.state), ["covered", "later"]);
  assert.equal("qualifiedViewCount" in dto, false);
  assert.equal("workspaceSlug" in dto, false);
});
