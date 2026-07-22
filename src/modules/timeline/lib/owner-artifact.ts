import {
  AUDIENCE_ITEM_STATES,
  AUDIENCE_TIMELINE_DTO_VERSION,
  SECTION_LABELS,
  calendarDateInTimeZone,
  validateAudienceTimelineDto,
  type AudienceTimelineDto,
} from "@/modules/timeline/lib/audience-timeline";
import type { AudienceOwnerPublication } from "@/modules/timeline/server/audience-timeline";

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
      label: SECTION_LABELS[state],
      items: publication.items
        .filter((item) => item.state === state)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((item) => ({
          publicId: item.publicId,
          title: item.title,
          ...(item.calendarDate ? { date: item.calendarDate } : {}),
          state: item.state,
        })),
    })).filter((section) => section.items.length > 0),
  });
}
