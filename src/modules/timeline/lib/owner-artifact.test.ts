import assert from "node:assert/strict";
import { test } from "node:test";
import type { AudienceOwnerPublication } from "@/modules/timeline/server/audience-timeline";
import {
  ownerProjectToTimelineDto,
  ownerPublicationToTimelineDto,
} from "./owner-artifact";
import type { EffectiveNode } from "@/modules/timeline/server/db/timeline-queries";
import {
  isReviewSuiteWorkspaceId,
  REVIEW_PRIMARY_PROJECT,
  REVIEW_SUITE_FIXTURE,
  REVIEW_TIMELINE_MILESTONES,
} from "@/lib/review-suite-fixture";
import {
  demoEffectiveNodes,
  demoProjects,
  demoWorkspace,
} from "@/modules/timeline/lib/roadmap/demo-data";
import { REVIEW_AUDIENCE_TIMELINE_DTO } from "@/modules/timeline/lib/review-audience-fixture";
import { PINNED_REVIEW_CALENDAR_FRAME } from "@/lib/calendar-frame";

test("the review suite runs on one clock: Timeline's fixture today equals the pinned calendar frame", () => {
  assert.equal(
    REVIEW_SUITE_FIXTURE.reviewToday,
    PINNED_REVIEW_CALENDAR_FRAME.today,
  );
  // The frozen public projection served at /s/[token] in review mode must
  // carry the same today as the owner surfaces — the two-routes-one-clock
  // guarantee, cross-checked at the DTO level.
  assert.equal(
    REVIEW_AUDIENCE_TIMELINE_DTO.today,
    PINNED_REVIEW_CALENDAR_FRAME.today,
  );
  // The fixture's last-updated stamp must not postdate the review "today",
  // or owner surfaces show an update from the future.
  assert.ok(
    REVIEW_SUITE_FIXTURE.lastUpdatedAt.slice(0, 10) <=
      REVIEW_SUITE_FIXTURE.reviewToday,
  );
});

const publication: AudienceOwnerPublication = {
  id: "publication-1",
  projectSlug: "mara-finn",
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
    sourceTargetDate: "2026-04-18",
    sortOrder: 1,
    lane: "Shipped",
    audienceState: "covered",
    sourceAudienceState: "covered",
    audienceStateOverride: null,
    hidden: false,
    laneOverride: null,
    labelOverride: null,
    dateOverride: null,
    dateOverrideMode: "inherit",
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
    sourceTargetDate: null,
    sortOrder: 2,
    lane: "Later",
    audienceState: "later",
    sourceAudienceState: "later",
    audienceStateOverride: null,
    hidden: true,
    laneOverride: null,
    labelOverride: null,
    dateOverride: null,
    dateOverrideMode: "inherit",
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

test("review context uses the canonical Tasks workspace and three authorised weddings", () => {
  assert.equal(isReviewSuiteWorkspaceId("demo-ws"), true);
  assert.equal(isReviewSuiteWorkspaceId(demoWorkspace.slug), false);
  assert.equal(demoWorkspace.suiteWorkspaceId, REVIEW_SUITE_FIXTURE.workspace.id);
  assert.equal(demoWorkspace.name, "The Orchard, events");
  assert.equal(demoProjects.length, 3);
  assert.deepEqual(
    demoProjects.map(({ slug, name }) => ({ slug, name })),
    REVIEW_SUITE_FIXTURE.projects.map(({ slug, name }) => ({ slug, name })),
  );
  assert.ok(
    demoProjects.every(
      (project) =>
        project.workspaceSlug === demoWorkspace.slug &&
        project.sourceTasksWorkspaceId === REVIEW_SUITE_FIXTURE.workspace.id,
    ),
  );
});

test("review owner artifact is the approved Mara and Finn public projection", () => {
  const dto = ownerProjectToTimelineDto({
    project: {
      slug: REVIEW_PRIMARY_PROJECT.slug,
      name: REVIEW_PRIMARY_PROJECT.name,
    },
    workspace: {
      ownerName: REVIEW_SUITE_FIXTURE.workspace.ownerName,
      templateId: REVIEW_SUITE_FIXTURE.workspace.templateId,
    },
    nodes: demoEffectiveNodes(demoWorkspace.slug),
    settings: {
      publicationId: "demo-audience-publication",
      label: REVIEW_PRIMARY_PROJECT.name,
      audienceKind: "couple",
      ownerDisplayLabel: `Shared by ${REVIEW_PRIMARY_PROJECT.name}`,
      primaryDateLabel: REVIEW_SUITE_FIXTURE.primaryDate.label,
      primaryDate: REVIEW_SUITE_FIXTURE.primaryDate.date,
      timezone: "Europe/Dublin",
    },
    now: new Date(`${REVIEW_SUITE_FIXTURE.reviewToday}T12:00:00.000Z`),
  });

  assert.equal(dto.label, "Mara & Finn");
  assert.equal(dto.ownerDisplayLabel, "Shared by Mara & Finn");
  assert.deepEqual(dto.primaryDate, REVIEW_SUITE_FIXTURE.primaryDate);
  assert.deepEqual(
    dto.sections.flatMap((section) =>
      section.items.map((item) => ({
        title: item.title,
        date: item.date ?? null,
        state: item.state,
      })),
    ),
    REVIEW_TIMELINE_MILESTONES.map(({ title, date, state }) => ({
      title,
      date,
      state,
    })),
  );
  assert.deepEqual(
    dto.sections.map(({ state, label, items }) => ({
      state,
      label,
      items: items.map(({ title, date, state: itemState }) => ({
        title,
        date: date ?? null,
        state: itemState,
      })),
    })),
    REVIEW_AUDIENCE_TIMELINE_DTO.sections.map(({ state, label, items }) => ({
      state,
      label,
      items: items.map(({ title, date, state: itemState }) => ({
        title,
        date: date ?? null,
        state: itemState,
      })),
    })),
  );

  const serialized = JSON.stringify(dto);
  const publicSerialized = JSON.stringify(REVIEW_AUDIENCE_TIMELINE_DTO);
  assert.equal(serialized.includes(REVIEW_SUITE_FIXTURE.workspace.id), false);
  assert.equal(serialized.includes(demoWorkspace.slug), false);
  assert.equal(
    REVIEW_TIMELINE_MILESTONES.some(({ sourceId }) =>
      serialized.includes(sourceId),
    ),
    false,
  );
  assert.equal(publicSerialized.includes(REVIEW_SUITE_FIXTURE.workspace.id), false);
  assert.equal(publicSerialized.includes(demoWorkspace.slug), false);
  assert.equal(
    REVIEW_TIMELINE_MILESTONES.some(({ sourceId }) =>
      publicSerialized.includes(sourceId),
    ),
    false,
  );
  assert.equal(
    REVIEW_TIMELINE_MILESTONES.filter(
      (milestone) => milestone.state !== "cancelled",
    ).length,
    9,
  );
});
