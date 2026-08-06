import {
  AUDIENCE_ITEM_STATES,
  AUDIENCE_TIMELINE_DTO_VERSION,
  validateAudienceTimelineDto,
} from "@/modules/timeline/lib/audience-timeline";
import { MILESTONE_STATE_LABELS } from "@/modules/timeline/lib/vocabulary";
import {
  REVIEW_PRIMARY_PROJECT,
  REVIEW_SUITE_FIXTURE,
  REVIEW_TIMELINE_MILESTONES,
} from "@/lib/review-suite-fixture";

/**
 * Frozen public projection of the deterministic Mara & Finn review timeline.
 * This is deliberately built through the production DTO validator: the review
 * fixture cannot acquire private workspace, source, user, or note fields.
 */
export const REVIEW_AUDIENCE_TIMELINE_DTO = validateAudienceTimelineDto({
  version: AUDIENCE_TIMELINE_DTO_VERSION,
  audienceKind: "couple",
  publicationId: REVIEW_SUITE_FIXTURE.journey.audiencePublicationId,
  label: REVIEW_PRIMARY_PROJECT.name,
  ownerDisplayLabel: `Shared by ${REVIEW_PRIMARY_PROJECT.name}`,
  primaryDate: REVIEW_SUITE_FIXTURE.primaryDate,
  lastUpdatedAt: REVIEW_SUITE_FIXTURE.lastUpdatedAt,
  today: REVIEW_SUITE_FIXTURE.reviewToday,
  sections: AUDIENCE_ITEM_STATES.map((state) => ({
    state,
    label: MILESTONE_STATE_LABELS[state],
    items: REVIEW_TIMELINE_MILESTONES.filter(
      (milestone) => milestone.state === state,
    ).map((milestone) => ({
      publicId: milestone.publicId,
      title: milestone.title,
      ...(milestone.date ? { date: milestone.date } : {}),
      state: milestone.state,
    })),
  })).filter((section) => section.items.length > 0),
});
