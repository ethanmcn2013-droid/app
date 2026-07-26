import assert from "node:assert/strict";
import { test } from "node:test";
import type { AudienceOwnerPublication } from "@/modules/timeline/server/audience-timeline";
import {
  ownerProjectToTimelineDto,
  ownerPublicationToTimelineDto,
} from "./owner-artifact";
import type { EffectiveNode } from "@/modules/timeline/server/db/timeline-queries";

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

const effectiveNodes: EffectiveNode[] = [
  {
    id: "private-source-id",
    projectSlug: "mara-finn",
    workspaceSlug: "weddings",
    title: "The Orchard reserved",
    status: "shipped",
    targetDate: "2026-04-18",
    sortOrder: 1,
    lane: "Shipped",
    hidden: false,
    laneOverride: null,
    labelOverride: null,
    dateOverride: null,
    source: "synced",
    driftDetected: false,
    updatedAt: new Date("2026-07-20T09:00:00.000Z"),
  },
  {
    id: "hidden-private-source-id",
    projectSlug: "mara-finn",
    workspaceSlug: "weddings",
    title: "Supplier contact details",
    status: "next",
    targetDate: null,
    sortOrder: 2,
    lane: "Later",
    hidden: true,
    laneOverride: null,
    labelOverride: null,
    dateOverride: null,
    source: "manual",
    driftDetected: false,
    updatedAt: new Date("2026-07-21T09:00:00.000Z"),
  },
];

test("live owner project preview preserves the public allowlist and wedding framing", () => {
  const dto = ownerProjectToTimelineDto({
    project: { slug: "mara-finn", name: "Mara & Finn" },
    workspace: {
      ownerName: "Luna Events",
      templateId: "wedding-planning-workspace",
    },
    nodes: effectiveNodes,
    now: new Date("2026-07-22T12:00:00.000Z"),
  });

  assert.equal(dto.audienceKind, "couple");
  assert.equal(dto.ownerDisplayLabel, "Shared by Luna Events");
  assert.equal(dto.primaryDate?.date, "2026-04-18");
  assert.equal(dto.sections[0]?.items[0]?.title, "The Orchard reserved");
  assert.equal(dto.sections.flatMap((section) => section.items).length, 1);
  assert.equal(dto.sections[0]?.items[0]?.publicId, "owner-preview-1");
  assert.equal(
    JSON.stringify(dto).includes("private-source-id"),
    false,
  );
  assert.equal(
    JSON.stringify(dto).includes("Supplier contact details"),
    false,
  );
});
