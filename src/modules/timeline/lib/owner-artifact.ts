import type { Master3ProjectSettings } from './master3-presentation';
import {
  AUDIENCE_ITEM_STATES,
  AUDIENCE_TIMELINE_DTO_VERSION,
  calendarDateInTimeZone,
  validateAudienceTimelineDto,
  type AudienceKind,
  type AudienceTimelineDto,
} from "@/modules/timeline/lib/audience-timeline";
import { MILESTONE_STATE_LABELS } from "@/modules/timeline/lib/vocabulary";
import type { AudienceOwnerPublication } from "@/modules/timeline/server/audience-timeline";
import type { EffectiveNode } from "@/modules/timeline/server/db/timeline-queries";

/**
 * Builds the exact allowlisted DTO used by the bearer-link renderer. Keeping
 * the owner preview on this boundary prevents private source fields from
 * creeping into the phone mockup and guarantees visual parity with viewers.
 */
export function ownerPublicationToTimelineDto(
  publication: AudienceOwnerPublication,
  now = new Date(),
): AudienceTimelineDto {
  return validateAudienceTimelineDto({
    version: AUDIENCE_TIMELINE_DTO_VERSION,
    audienceKind: publication.audienceKind,
    publicationId: publication.id,
    label: publication.label,
    ...(publication.presentation ? {presentation:publication.presentation} : {}),
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
    today: calendarDateInTimeZone(now, publication.timezone),
    sections: AUDIENCE_ITEM_STATES.map((state) => ({
      state,
      label: MILESTONE_STATE_LABELS[state],
      items: publication.items
        .filter((item) => item.state === state)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((item) => ({
          publicId: item.publicId,
          ...(item.presentation ? {presentation:item.presentation} : {}),
          title: item.title,
          ...(item.calendarDate ? { date: item.calendarDate } : {}),
          state: item.state,
        })),
    })).filter((section) => section.items.length > 0),
  });
}

type OwnerPreviewProject = Readonly<{
  slug: string;
  name: string;
}>;

type OwnerPreviewWorkspace = Readonly<{
  ownerName: string | null;
  templateId: string | null;
}>;

type OwnerPreviewSettings = Readonly<{
  publicationId?: string;
  label?: string;
  audienceKind?: AudienceKind;
  ownerDisplayLabel?: string | null;
  primaryDateLabel?: string | null;
  primaryDate?: string | null;
  timezone?: string;
}>;

function defaultAudienceKind(templateId: string | null): AudienceKind {
  return templateId?.toLowerCase().includes("wedding") ? "couple" : "module";
}

/**
 * Projects render through the same strict, allowlisted DTO as a public share.
 * This is deliberately a presentation projection: source ids, workspace ids,
 * descriptions, comments, and private Tasks metadata never reach the artifact.
 */
export function ownerProjectToTimelineDto(input: {
  project: OwnerPreviewProject;
  workspace: OwnerPreviewWorkspace;
  nodes: readonly EffectiveNode[];
  settings?: OwnerPreviewSettings;
  now?: Date;
  presentationSettings?: Master3ProjectSettings;
  settingsUpdatedAt?: Date;
}): AudienceTimelineDto {
  const now = input.now ?? new Date();
  const timezone = input.presentationSettings?.presentation?.timezone ?? input.settings?.timezone ?? "Europe/Dublin";
  const visible = input.nodes
    .filter((node) => !node.hidden)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const audienceKind =
    input.settings?.audienceKind ??
    defaultAudienceKind(input.workspace.templateId);
  const dated = visible
    .map((node) => node.targetDate)
    .filter((date): date is string => Boolean(date))
    .sort();
  const primaryDate =
    input.settings?.primaryDate === undefined
      ? dated.at(-1) ?? null
      : input.settings.primaryDate;
  const primaryDateLabel =
    input.settings?.primaryDateLabel === undefined
      ? audienceKind === "couple"
        ? "Wedding day"
        : "Final milestone"
      : input.settings.primaryDateLabel;
  const latestUpdate = visible.reduce(
    (latest, node) =>
      node.updatedAt.getTime() > latest.getTime() ? node.updatedAt : latest,
    visible[0]?.updatedAt ?? now,
  );

  return validateAudienceTimelineDto({
    version: AUDIENCE_TIMELINE_DTO_VERSION,
    audienceKind,
    publicationId:
      input.settings?.publicationId ?? `owner-preview-${input.project.slug}`,
    label: input.settings?.label ?? input.project.name,
    ...(input.presentationSettings?.presentation ? {presentation:input.presentationSettings.presentation} : {}),
    ...((input.settings?.ownerDisplayLabel ??
    (input.workspace.ownerName
      ? `Shared by ${input.workspace.ownerName}`
      : null))
      ? {
          ownerDisplayLabel:
            input.settings?.ownerDisplayLabel ??
            `Shared by ${input.workspace.ownerName}`,
        }
      : {}),
    ...(primaryDate && primaryDateLabel
      ? {
          primaryDate: {
            label: primaryDateLabel,
            date: primaryDate,
          },
        }
      : {}),
    lastUpdatedAt: (input.settingsUpdatedAt && input.settingsUpdatedAt > latestUpdate ? input.settingsUpdatedAt : latestUpdate).toISOString(),
    today: calendarDateInTimeZone(now, timezone),
    sections: AUDIENCE_ITEM_STATES.map((state) => ({
      state,
      label: MILESTONE_STATE_LABELS[state],
      items: visible
        .map((node, index) => ({
          publicId: `owner-preview-${index + 1}`,
          ...(input.presentationSettings?.items?.[node.id] ? {presentation:input.presentationSettings.items[node.id]} : {}),
          title: node.title,
          ...(node.targetDate ? { date: node.targetDate } : {}),
          state: node.audienceState,
        }))
        .filter((item) => item.state === state),
    })).filter((section) => section.items.length > 0),
  });
}
