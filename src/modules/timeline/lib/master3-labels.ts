import type { AudienceTimelineDto } from './audience-timeline';

/** Legacy publications store attribution and the shared names in one field. */
export function master3TimelineTitle(timeline: AudienceTimelineDto): string {
  if (timeline.audienceKind !== 'couple') return timeline.label;
  return timeline.ownerDisplayLabel?.replace(/^Shared by\s+/i, '').trim() || timeline.label;
}

export function master3ConfirmationSubject(timeline: AudienceTimelineDto): string {
  return timeline.presentation?.subject || `Confirm your updates from ${master3TimelineTitle(timeline)}`;
}
