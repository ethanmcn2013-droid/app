import type { AudienceTimelineDto } from "./audience-timeline";

/** Only the owner's explicitly approved public card fields may leave the page. */
export function master3SocialDetails(timeline: AudienceTimelineDto): {
  title: string;
  date: string | null;
  place: string | null;
  description: string;
} | null {
  if (timeline.presentation?.socialDetails !== true) return null;
  const title = timeline.audienceKind === "couple" && timeline.ownerDisplayLabel
    ? timeline.ownerDisplayLabel
    : timeline.label;
  const date = timeline.primaryDate
    ? new Intl.DateTimeFormat("en-IE", {
        weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
      }).format(new Date(`${timeline.primaryDate.date}T00:00:00Z`))
    : null;
  // Addresses and day notes are never unfurl content, even with card consent.
  const place = timeline.presentation.locationConsent === true
    ? timeline.presentation.place?.trim() || null
    : null;
  return {
    title,
    date,
    place,
    description: [date, place].filter(Boolean).join(" · ") || "A shared timeline.",
  };
}
