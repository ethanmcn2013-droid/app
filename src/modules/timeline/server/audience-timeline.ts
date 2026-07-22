import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { cache } from "react";
import {
  audienceShares,
  timelinePublicationItems,
  timelinePublications,
  workspaces,
  type AudienceItemState,
  type AudienceKind,
} from "@/modules/timeline/server/db/timeline-schema";
import { db } from "@/modules/timeline/server/db/timeline-client";
import { checkRateLimit, getClientIp } from "@/modules/timeline/lib/rate-limit";
import {
  getEffectiveNodesForWorkspace,
  getProjectsForWorkspace,
} from "@/modules/timeline/server/db/timeline-queries";
import {
  AUDIENCE_ITEM_STATES,
  AUDIENCE_TIMELINE_DTO_VERSION,
  SECTION_LABELS,
  calendarDateInTimeZone,
  digestSourceFields,
  freezeAudienceItem,
  generateAudienceToken,
  hashAudienceToken,
  hashesEqual,
  isAudienceTokenShape,
  resolveShareAccessState,
  validateAudienceTimelineDto,
  validateIanaTimezone,
  type AudienceTimelineDto,
  type ShareAccessState,
} from "@/modules/timeline/lib/audience-timeline";
import {
  assertAudienceSourceAuthority,
  type AudienceSourceAuthority,
} from "@/modules/timeline/server/audience-authority";
import { isDemoMode } from "@/lib/access-mode";
import { demoWorkspace } from "@/modules/timeline/lib/roadmap/demo-data";

export function audienceTimelineEnabled(): boolean {
  return (
    isDemoMode() || process.env.SIGNAL_AUDIENCE_TIMELINE_ENABLED === "true"
  );
}

export type AudienceOwnerItem = Readonly<{
  publicId: string;
  title: string;
  calendarDate: string | null;
  state: AudienceItemState;
  sortOrder: number;
  divergedAt: Date | null;
}>;

export type AudienceOwnerPublication = Readonly<{
  id: string;
  label: string;
  audienceKind: AudienceKind;
  ownerDisplayLabel: string | null;
  primaryDateLabel: string | null;
  primaryDate: string | null;
  timezone: string;
  state: "draft" | "published" | "unpublished";
  lastUpdatedAt: Date;
  qualifiedViewCount: number;
  lastQualifiedViewAt: Date | null;
  activeShareCount: number;
  items: readonly AudienceOwnerItem[];
}>;

/**
 * Stable review fixture for the Audience Timeline boundary. The token has the
 * same 256-bit base64url shape as production tokens but is intentionally
 * public and valid only while demo/review mode is active.
 */
export const DEMO_AUDIENCE_TOKEN =
  "DemoAudienceTimelineToken2026Fixed000000000";

const DEMO_AUDIENCE_DTO = validateAudienceTimelineDto({
  version: AUDIENCE_TIMELINE_DTO_VERSION,
  audienceKind: "couple",
  publicationId: "demo-audience-publication",
  label: "Mara & Finn",
  ownerDisplayLabel: "Shared by Mara & Finn",
  primaryDate: { label: "Wedding day", date: "2026-10-03" },
  lastUpdatedAt: "2026-07-21T18:30:00.000Z",
  today: "2026-07-22",
  sections: [
    {
      state: "covered",
      label: SECTION_LABELS.covered,
      items: [
        {
          publicId: "demo-audience-item-yes",
          title: "We said yes",
          date: "2026-01-02",
          state: "covered",
        },
        {
          publicId: "demo-audience-item-venue",
          title: "The Orchard reserved",
          date: "2026-04-18",
          state: "covered",
        },
      ],
    },
    {
      state: "now",
      label: SECTION_LABELS.now,
      items: [
        {
          publicId: "demo-audience-item-menu",
          title: "Menu tasting at The Orchard",
          date: "2026-08-01",
          state: "now",
        },
      ],
    },
    {
      state: "next",
      label: SECTION_LABELS.next,
      items: [
        {
          publicId: "demo-audience-item-invitations",
          title: "Send the invitations",
          date: "2026-08-08",
          state: "next",
        },
        {
          publicId: "demo-audience-item-fitting",
          title: "Final dress fitting",
          date: "2026-08-22",
          state: "next",
        },
        {
          publicId: "demo-audience-item-music",
          title: "Choose the evening music",
          date: "2026-08-29",
          state: "next",
        },
      ],
    },
    {
      state: "later",
      label: SECTION_LABELS.later,
      items: [
        {
          publicId: "demo-audience-item-guests",
          title: "Final guest numbers",
          date: "2026-09-05",
          state: "later",
        },
        {
          publicId: "demo-audience-item-walkthrough",
          title: "Venue walk-through",
          date: "2026-09-19",
          state: "later",
        },
        {
          publicId: "demo-audience-item-wedding",
          title: "Wedding day",
          date: "2026-10-03",
          state: "later",
        },
      ],
    },
    {
      state: "cancelled",
      label: SECTION_LABELS.cancelled,
      items: [
        {
          publicId: "demo-audience-item-hotel",
          title: "City hotel shortlist",
          state: "cancelled",
        },
      ],
    },
  ],
});

const DEMO_OWNER_PUBLICATION: AudienceOwnerPublication = {
  id: DEMO_AUDIENCE_DTO.publicationId,
  label: DEMO_AUDIENCE_DTO.label,
  audienceKind: DEMO_AUDIENCE_DTO.audienceKind,
  ownerDisplayLabel: DEMO_AUDIENCE_DTO.ownerDisplayLabel ?? null,
  primaryDateLabel: DEMO_AUDIENCE_DTO.primaryDate?.label ?? null,
  primaryDate: DEMO_AUDIENCE_DTO.primaryDate?.date ?? null,
  timezone: "Europe/Dublin",
  state: "published",
  lastUpdatedAt: new Date(DEMO_AUDIENCE_DTO.lastUpdatedAt),
  qualifiedViewCount: 0,
  lastQualifiedViewAt: null,
  activeShareCount: 1,
  items: DEMO_AUDIENCE_DTO.sections.flatMap((section) =>
    section.items.map((item, sortOrder) => ({
      publicId: item.publicId,
      title: item.title,
      calendarDate: item.date ?? null,
      state: item.state,
      sortOrder,
      divergedAt: null,
    })),
  ),
};

export async function connectSuiteWorkspace(
  workspaceSlug: string,
  ownerUserId: string,
  suiteWorkspaceId: string,
): Promise<boolean> {
  const rows = await db
    .update(workspaces)
    .set({ suiteWorkspaceId, updatedAt: new Date() })
    .where(
      and(
        eq(workspaces.slug, workspaceSlug),
        eq(workspaces.ownerUserId, ownerUserId),
      ),
    )
    .returning({ slug: workspaces.slug });
  return rows.length === 1;
}

export async function createAudiencePublication(input: {
  workspaceSlug: string;
  sourceAuthority: AudienceSourceAuthority;
  label: string;
  audienceKind: AudienceKind;
  ownerDisplayLabel: string | null;
  primaryDateLabel: string | null;
  primaryDate: string | null;
  timezone: string;
  selectedSourceIds: readonly string[];
}): Promise<string> {
  const [nodes, projects] = await Promise.all([
    getEffectiveNodesForWorkspace(input.workspaceSlug),
    getProjectsForWorkspace(input.workspaceSlug),
  ]);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const projectMap = new Map(projects.map((project) => [project.slug, project]));
  const uniqueIds = [...new Set(input.selectedSourceIds)];
  if (uniqueIds.length === 0) throw new TypeError("Select at least one milestone");
  if (uniqueIds.length > 100) throw new TypeError("An Audience Timeline can contain at most 100 items");

  const frozen = uniqueIds.map((id) => {
    const node = nodeMap.get(id);
    if (!node || node.hidden) throw new TypeError("A selected milestone is not available in this workspace");
    const project = node.source === "synced" ? projectMap.get(node.projectSlug) : null;
    if (node.source === "synced" && !project) {
      throw new TypeError("A selected milestone has no local project provenance");
    }
    assertAudienceSourceAuthority(
      input.sourceAuthority,
      {
        kind: node.source,
        sourceTasksWorkspaceId: project?.sourceTasksWorkspaceId ?? null,
      },
    );
    return freezeAudienceItem(
      {
        id: node.id,
        workspaceId: input.sourceAuthority.sourceWorkspaceId,
        title: node.title,
        date: node.targetDate,
        completionState: node.status,
      },
      input.sourceAuthority.sourceWorkspaceId,
    );
  });

  const publicationId = randomUUID();
  const now = new Date();
  const publicationDigest = digestSourceFields({
    title: input.label,
    date: input.primaryDate,
    completionState: frozen.map((item) => item.sourceDigest).join(":"),
  });

  await db.transaction(async (tx) => {
    await tx.insert(timelinePublications).values({
      id: publicationId,
      workspaceSlug: input.workspaceSlug,
      sourceWorkspaceId: input.sourceAuthority.sourceWorkspaceId,
      sourceObjectId: `selection:${publicationId}`,
      sourceRevision: 1,
      sourceDigest: publicationDigest,
      label: input.label,
      primaryDateLabel: input.primaryDateLabel,
      primaryDate: input.primaryDate,
      audienceKind: input.audienceKind,
      timezone: validateIanaTimezone(input.timezone),
      ownerDisplayLabel: input.ownerDisplayLabel,
      state: "draft",
      lastUpdatedAt: now,
      updatedAt: now,
    });
    await tx.insert(timelinePublicationItems).values(
      frozen.map((item, index) => ({
        publicId: randomUUID(),
        publicationId,
        title: item.title,
        calendarDate: item.calendarDate,
        state: item.state,
        sortOrder: index,
        sourceRelation: item.sourceRelation,
        sourceDigest: item.sourceDigest,
        copiedAt: now,
        updatedAt: now,
      })),
    );
  });

  return publicationId;
}

/**
 * Narrow Notes -> Timeline receiver. Notes sends an already reviewed
 * projection, never the private note body. This function performs the same
 * current Tasks-membership check as the owner flow, then creates a frozen
 * published projection with a one-time bearer URL.
 */
export async function createNotesAudiencePublication(input: {
  ownerUserId: string;
  workspaceSlug: string;
  sourceTasksWorkspaceId: string;
  sourceNoteId: string;
  title: string;
  date: string;
  completion: number;
  audienceLabel: string;
}): Promise<{ publicationId: string; rawToken: string }> {
  const [workspace] = await db
    .select({ suiteWorkspaceId: workspaces.suiteWorkspaceId })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.slug, input.workspaceSlug),
        eq(workspaces.ownerUserId, input.ownerUserId),
      ),
    )
    .limit(1);
  if (!workspace || workspace.suiteWorkspaceId !== input.sourceTasksWorkspaceId) {
    throw new TypeError("Timeline workspace is not connected to this Tasks workspace");
  }

  const sourceObjectId = `notes:${input.sourceNoteId}`;
  const [existing] = await db
    .select({ id: timelinePublications.id })
    .from(timelinePublications)
    .where(
      and(
        eq(timelinePublications.workspaceSlug, input.workspaceSlug),
        eq(timelinePublications.sourceObjectId, sourceObjectId),
      ),
    )
    .limit(1);
  if (existing) throw new TypeError("This Note already has a Timeline publication");

  const publicationId = randomUUID();
  const rawToken = generateAudienceToken();
  const now = new Date();
  const itemState: AudienceItemState =
    input.completion >= 100
      ? "covered"
      : input.completion > 0
        ? "now"
        : "next";
  const itemDigest = digestSourceFields({
    title: input.title,
    date: input.date,
    completionState: String(input.completion),
  });

  await db.transaction(async (tx) => {
    await tx.insert(timelinePublications).values({
      id: publicationId,
      workspaceSlug: input.workspaceSlug,
      sourceWorkspaceId: input.sourceTasksWorkspaceId,
      sourceObjectId,
      sourceRevision: 1,
      sourceDigest: itemDigest,
      label: input.audienceLabel,
      primaryDateLabel: "Selected date",
      primaryDate: input.date,
      audienceKind: "class",
      timezone: "UTC",
      ownerDisplayLabel: null,
      state: "published",
      lastUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    });
    await tx.insert(timelinePublicationItems).values({
      publicId: randomUUID(),
      publicationId,
      title: input.title,
      calendarDate: input.date,
      state: itemState,
      sortOrder: 0,
      sourceRelation: sourceObjectId,
      sourceDigest: itemDigest,
      copiedAt: now,
      publishedAt: now,
      updatedAt: now,
    });
    await tx.insert(audienceShares).values({
      id: randomUUID(),
      publicationId,
      tokenHash: hashAudienceToken(rawToken),
      state: "active",
      version: 1,
      createdAt: now,
    });
  });

  return { publicationId, rawToken };
}

export async function getOwnerAudiencePublications(
  workspaceSlug: string,
): Promise<AudienceOwnerPublication[]> {
  if (isDemoMode()) {
    return workspaceSlug === demoWorkspace.slug
      ? [DEMO_OWNER_PUBLICATION]
      : [];
  }

  const publications = await db
    .select({
      id: timelinePublications.id,
      label: timelinePublications.label,
      audienceKind: timelinePublications.audienceKind,
      timezone: timelinePublications.timezone,
      ownerDisplayLabel: timelinePublications.ownerDisplayLabel,
      primaryDateLabel: timelinePublications.primaryDateLabel,
      primaryDate: timelinePublications.primaryDate,
      state: timelinePublications.state,
      lastUpdatedAt: timelinePublications.lastUpdatedAt,
      qualifiedViewCount: timelinePublications.qualifiedViewCount,
      lastQualifiedViewAt: timelinePublications.lastQualifiedViewAt,
    })
    .from(timelinePublications)
    .where(eq(timelinePublications.workspaceSlug, workspaceSlug))
    .orderBy(asc(timelinePublications.createdAt));
  if (publications.length === 0) return [];

  const publicationIds = publications.map((publication) => publication.id);
  const [items, activeShares] = await Promise.all([
    db
      .select({
        publicId: timelinePublicationItems.publicId,
        publicationId: timelinePublicationItems.publicationId,
        title: timelinePublicationItems.title,
        calendarDate: timelinePublicationItems.calendarDate,
        state: timelinePublicationItems.state,
        sortOrder: timelinePublicationItems.sortOrder,
        divergedAt: timelinePublicationItems.divergedAt,
      })
      .from(timelinePublicationItems)
      .where(inArray(timelinePublicationItems.publicationId, publicationIds))
      .orderBy(asc(timelinePublicationItems.sortOrder)),
    db
      .select({ publicationId: audienceShares.publicationId })
      .from(audienceShares)
      .where(
        and(
          inArray(audienceShares.publicationId, publicationIds),
          eq(audienceShares.state, "active"),
          or(
            isNull(audienceShares.expiresAt),
            gt(audienceShares.expiresAt, new Date()),
          ),
        ),
      ),
  ]);

  return publications.map((publication) => ({
    ...publication,
    activeShareCount: activeShares.filter(
      (share) => share.publicationId === publication.id,
    ).length,
    items: items
      .filter((item) => item.publicationId === publication.id)
      .map((item) => ({
        publicId: item.publicId,
        title: item.title,
        calendarDate: item.calendarDate,
        state: item.state,
        sortOrder: item.sortOrder,
        divergedAt: item.divergedAt,
      })),
  }));
}

async function ownsPublication(
  publicationId: string,
  workspaceSlug: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: timelinePublications.id })
    .from(timelinePublications)
    .where(
      and(
        eq(timelinePublications.id, publicationId),
        eq(timelinePublications.workspaceSlug, workspaceSlug),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function publishAudiencePublication(
  publicationId: string,
  workspaceSlug: string,
  expiresAt: Date | null,
): Promise<string> {
  if (!(await ownsPublication(publicationId, workspaceSlug))) {
    throw new TypeError("Publication not found");
  }
  const rawToken = generateAudienceToken();
  const tokenHash = hashAudienceToken(rawToken);
  const now = new Date();

  await db.transaction(async (tx) => {
    const priorVersions = await tx
      .select({ version: audienceShares.version })
      .from(audienceShares)
      .where(eq(audienceShares.publicationId, publicationId));
    const nextVersion = Math.max(0, ...priorVersions.map((row) => row.version)) + 1;
    await tx
      .update(audienceShares)
      .set({ state: "rotated", rotatedAt: now })
      .where(
        and(
          eq(audienceShares.publicationId, publicationId),
          eq(audienceShares.state, "active"),
        ),
      );
    await tx
      .update(timelinePublications)
      .set({
        state: "published",
        publishedAt: now,
        unpublishedAt: null,
        lastUpdatedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(timelinePublications.id, publicationId),
          eq(timelinePublications.workspaceSlug, workspaceSlug),
        ),
      );
    await tx
      .update(timelinePublicationItems)
      .set({ publishedAt: now, unpublishedAt: null })
      .where(eq(timelinePublicationItems.publicationId, publicationId));
    await tx.insert(audienceShares).values({
      id: randomUUID(),
      publicationId,
      tokenHash,
      state: "active",
      version: nextVersion,
      expiresAt,
      createdAt: now,
    });
  });
  return rawToken;
}

export async function rotateAudienceShare(
  publicationId: string,
  workspaceSlug: string,
  expiresAt: Date | null,
): Promise<string> {
  if (!(await ownsPublication(publicationId, workspaceSlug))) {
    throw new TypeError("Publication not found");
  }
  const rawToken = generateAudienceToken();
  const tokenHash = hashAudienceToken(rawToken);
  const now = new Date();

  await db.transaction(async (tx) => {
    const versions = await tx
      .select({ version: audienceShares.version })
      .from(audienceShares)
      .where(eq(audienceShares.publicationId, publicationId));
    const nextVersion = Math.max(0, ...versions.map((row) => row.version)) + 1;
    await tx
      .update(audienceShares)
      .set({ state: "rotated", rotatedAt: now })
      .where(
        and(
          eq(audienceShares.publicationId, publicationId),
          eq(audienceShares.state, "active"),
        ),
      );
    await tx.insert(audienceShares).values({
      id: randomUUID(),
      publicationId,
      tokenHash,
      state: "active",
      version: nextVersion,
      expiresAt,
      createdAt: now,
    });
  });
  return rawToken;
}

export async function revokeAudienceShares(
  publicationId: string,
  workspaceSlug: string,
): Promise<void> {
  if (!(await ownsPublication(publicationId, workspaceSlug))) {
    throw new TypeError("Publication not found");
  }
  const now = new Date();
  await db
    .update(audienceShares)
    .set({ state: "revoked", revokedAt: now })
    .where(
      and(
        eq(audienceShares.publicationId, publicationId),
        eq(audienceShares.state, "active"),
      ),
    );
}

export async function unpublishAudiencePublication(
  publicationId: string,
  workspaceSlug: string,
): Promise<void> {
  if (!(await ownsPublication(publicationId, workspaceSlug))) {
    throw new TypeError("Publication not found");
  }
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(timelinePublications)
      .set({ state: "unpublished", unpublishedAt: now, updatedAt: now, lastUpdatedAt: now })
      .where(
        and(
          eq(timelinePublications.id, publicationId),
          eq(timelinePublications.workspaceSlug, workspaceSlug),
        ),
      );
    await tx
      .update(timelinePublicationItems)
      .set({ unpublishedAt: now })
      .where(eq(timelinePublicationItems.publicationId, publicationId));
    await tx
      .update(audienceShares)
      .set({ state: "revoked", revokedAt: now })
      .where(
        and(
          eq(audienceShares.publicationId, publicationId),
          eq(audienceShares.state, "active"),
        ),
      );
  });
}

export async function updateAudiencePublicationItem(input: {
  publicationId: string;
  publicId: string;
  workspaceSlug: string;
  title: string;
  calendarDate: string | null;
  state: AudienceItemState;
}): Promise<void> {
  if (!(await ownsPublication(input.publicationId, input.workspaceSlug))) {
    throw new TypeError("Publication not found");
  }
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(timelinePublicationItems)
      .set({
        title: input.title,
        calendarDate: input.calendarDate,
        state: input.state,
        updatedAt: now,
      })
      .where(
        and(
          eq(timelinePublicationItems.publicId, input.publicId),
          eq(timelinePublicationItems.publicationId, input.publicationId),
        ),
      );
    await tx
      .update(timelinePublications)
      .set({ lastUpdatedAt: now, updatedAt: now })
      .where(
        and(
          eq(timelinePublications.id, input.publicationId),
          eq(timelinePublications.workspaceSlug, input.workspaceSlug),
        ),
      );
  });
}

export async function refreshAudienceDivergence(
  publicationId: string,
  workspaceSlug: string,
): Promise<number> {
  if (!(await ownsPublication(publicationId, workspaceSlug))) {
    throw new TypeError("Publication not found");
  }
  const nodes = await getEffectiveNodesForWorkspace(workspaceSlug);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const items = await db
    .select({
      publicId: timelinePublicationItems.publicId,
      sourceRelation: timelinePublicationItems.sourceRelation,
      sourceDigest: timelinePublicationItems.sourceDigest,
      divergedAt: timelinePublicationItems.divergedAt,
    })
    .from(timelinePublicationItems)
    .where(eq(timelinePublicationItems.publicationId, publicationId));
  const now = new Date();
  let changed = 0;

  for (const item of items) {
    const source = nodeMap.get(item.sourceRelation);
    const currentDigest = source
      ? digestSourceFields({
          title: source.title,
          date: source.targetDate,
          completionState: source.status,
        })
      : null;
    const diverged = currentDigest === null || !hashesEqual(item.sourceDigest, currentDigest);
    if (diverged && item.divergedAt === null) {
      await db
        .update(timelinePublicationItems)
        .set({ divergedAt: now })
        .where(
          and(
            eq(timelinePublicationItems.publicId, item.publicId),
            eq(timelinePublicationItems.publicationId, publicationId),
          ),
        );
      changed += 1;
    }
  }
  return changed;
}

export type AudienceResolution =
  | { kind: "ok"; dto: AudienceTimelineDto }
  | { kind: Exclude<ShareAccessState, "valid"> | "unpublished" };

/**
 * Resolves a raw token on every request. The indexed lookup uses only a fixed
 * length SHA-256 digest, followed by a timing-safe digest comparison. The raw
 * token is neither selected nor logged because no raw-token column exists.
 */
export const resolveAudienceTimeline = cache(async (
  rawToken: string,
): Promise<AudienceResolution> => {
  if (isDemoMode()) {
    return rawToken === DEMO_AUDIENCE_TOKEN
      ? { kind: "ok", dto: DEMO_AUDIENCE_DTO }
      : { kind: "invalid" };
  }

  if (!isAudienceTokenShape(rawToken)) return { kind: "invalid" };

  // A share token carries 256 bits of entropy and the digest lookup is
  // indexed, so the link remains safe and usable when the optional
  // distributed limiter has not been provisioned. If either Upstash value is
  // present, treat the limiter as configured and fail closed on a missing
  // counterpart or service error through checkRateLimit().
  const audienceLimiterConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL ||
      process.env.UPSTASH_REDIS_REST_TOKEN,
  );
  if (audienceLimiterConfigured) {
    const rateLimit = await checkRateLimit(
      "audience-read",
      await getClientIp(),
      120,
      60,
    );
    if (!rateLimit.allowed) return { kind: "invalid" };
  }

  const tokenHash = hashAudienceToken(rawToken);
  const [share] = await db
    .select({
      publicationId: audienceShares.publicationId,
      tokenHash: audienceShares.tokenHash,
      state: audienceShares.state,
      expiresAt: audienceShares.expiresAt,
    })
    .from(audienceShares)
    .where(eq(audienceShares.tokenHash, tokenHash))
    .limit(1);
  if (!share || !hashesEqual(share.tokenHash, tokenHash)) return { kind: "invalid" };

  const access = resolveShareAccessState(share, new Date());
  if (access !== "valid") return { kind: access };

  const [publication] = await db
    .select({
      id: timelinePublications.id,
      audienceKind: timelinePublications.audienceKind,
      timezone: timelinePublications.timezone,
      label: timelinePublications.label,
      ownerDisplayLabel: timelinePublications.ownerDisplayLabel,
      primaryDateLabel: timelinePublications.primaryDateLabel,
      primaryDate: timelinePublications.primaryDate,
      lastUpdatedAt: timelinePublications.lastUpdatedAt,
      state: timelinePublications.state,
    })
    .from(timelinePublications)
    .where(eq(timelinePublications.id, share.publicationId))
    .limit(1);
  if (!publication || publication.state !== "published") return { kind: "unpublished" };

  // Public boundary: explicit presentation columns only. No source relation,
  // digest, workspace, user, description, note, comment, or attachment column.
  const items = await db
    .select({
      publicId: timelinePublicationItems.publicId,
      title: timelinePublicationItems.title,
      date: timelinePublicationItems.calendarDate,
      state: timelinePublicationItems.state,
      sortOrder: timelinePublicationItems.sortOrder,
    })
    .from(timelinePublicationItems)
    .where(eq(timelinePublicationItems.publicationId, publication.id))
    .orderBy(asc(timelinePublicationItems.sortOrder));

  const candidate = {
    version: AUDIENCE_TIMELINE_DTO_VERSION,
    audienceKind: publication.audienceKind,
    publicationId: publication.id,
    label: publication.label,
    ...(publication.ownerDisplayLabel
      ? { ownerDisplayLabel: publication.ownerDisplayLabel }
      : {}),
    ...(publication.primaryDate && publication.primaryDateLabel
      ? {
          primaryDate: {
            label: publication.primaryDateLabel,
            date: publication.primaryDate,
          },
        }
      : {}),
    lastUpdatedAt: publication.lastUpdatedAt.toISOString(),
    today: calendarDateInTimeZone(new Date(), publication.timezone),
    sections: AUDIENCE_ITEM_STATES.map((state) => ({
      state,
      label: SECTION_LABELS[state],
      items: items
        .filter((item) => item.state === state)
        .map((item) => ({
          publicId: item.publicId,
          title: item.title,
          ...(item.date ? { date: item.date } : {}),
          state: item.state,
        })),
    })).filter((section) => section.items.length > 0),
  };
  return { kind: "ok", dto: validateAudienceTimelineDto(candidate) };
});
