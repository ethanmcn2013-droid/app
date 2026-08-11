import { calendarDateInTimeZone } from "@/modules/timeline/lib/audience-timeline";
import { formatTimelineDate } from "@/modules/timeline/components/artifact/timeline-artifact-model";

/**
 * Who can see this page right now, said in the header.
 *
 * The owner's chrome carried Preview and Share and explained neither. Preview
 * of what — the live plan, or the frozen copy? Share meaning it is shared, or
 * meaning it could be? Notes answers the same question with "Private to you"
 * and Timeline answered it nowhere at all, so the one thing an owner most
 * needs to know before typing — whether the couple are reading this as it
 * changes — had to be inferred from two verbs.
 *
 * Every state here is derived from data this page already loads, and no state
 * is rendered that cannot be. In particular:
 *
 *  - `linkLive` is published AND at least one share still open, which is the
 *    same derivation the Share panel makes. Revoking every link leaves
 *    `state` reading "published" while nothing opens, so keying off the state
 *    column alone would tell an owner their timeline is reachable when it is
 *    not.
 *  - "since" comes from `publishedAt`, the column the publish and rotate
 *    actions write, never from `lastUpdatedAt`, which moves whenever anything
 *    about the publication is touched.
 *  - There is no audience name to state. Shares are bearer links: no sign-in,
 *    no named recipient, no cap on how many people hold one. "Live for the
 *    couple" would read well and would not be true, so the line says what is
 *    true — anyone holding the link.
 */

export type VisibilityState = Readonly<{
  state: "draft" | "published" | "unpublished";
  activeShareCount: number;
  publishedAt: Date | null;
  timezone: string;
}>;

/** The sentence, derived. Exported bare so it can be read without a render. */
export function visibilityLine(
  publication: VisibilityState | null,
): Readonly<{ live: boolean; text: string }> {
  if (!publication) {
    return {
      live: false,
      text: "Only you can see this. Share it when you are ready.",
    };
  }

  const live =
    publication.state === "published" && publication.activeShareCount > 0;

  if (live) {
    const since = publication.publishedAt
      ? formatTimelineDate(
          calendarDateInTimeZone(publication.publishedAt, publication.timezone),
        )
      : null;
    return {
      live: true,
      text: since
        ? `Live since ${since}. Anyone holding the link can read it.`
        : "Live now. Anyone holding the link can read it.",
    };
  }

  if (publication.state === "published") {
    return {
      live: false,
      text: "Every link is switched off. Nobody can open this page.",
    };
  }

  if (publication.state === "unpublished") {
    return {
      live: false,
      text: "Not published. No link opens this page.",
    };
  }

  return {
    live: false,
    text: "Only you can see this. Publishing makes the link.",
  };
}

export function VisibilityLine({
  publication,
}: {
  publication: VisibilityState | null;
}) {
  const { live, text } = visibilityLine(publication);

  return (
    <p
      className="flex min-w-0 items-center gap-1.5 text-[12px] leading-5"
      style={{ color: "var(--x-ink-quiet, var(--ink-quiet))" }}
      data-timeline-visibility={live ? "live" : "private"}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: live ? "var(--accent)" : "var(--ink-ghost)" }}
      />
      <span className="truncate">{text}</span>
    </p>
  );
}
