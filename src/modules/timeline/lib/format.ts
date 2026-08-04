/**
 * Shared formatting utilities for the Roadmap product.
 * Extracted from [workspaceSlug]/page.tsx + [workspaceSlug]/update/page.tsx
 * in Phase 11.3 to eliminate the duplicate.
 */

/**
 * Returns a human-readable relative time string ("3 minutes ago",
 * "2 days ago") for a Date. Falls back to a short locale date string
 * for anything older than 30 days.
 */
export function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Plain-English freshness phrase for the public view's "Updated …" stamp.
 *
 * A quiet trust signal for a reader who is not auditing timestamps, they
 * just want to know the plan is being kept current. The voice is human and
 * declarative (PRODUCT.md copy rules): "this morning", "today", "yesterday",
 * "3 days ago", never a raw timestamp, never PM phrasing.
 *
 * Same-calendar-day work splits into "this morning" (before noon) and
 * "today" (noon onward) so an early-morning edit reads the way a person
 * would actually say it. Beyond a week it falls back to a short date so the
 * stamp never grows vague ("47 days ago" helps no one).
 *
 * `now` is injectable for deterministic tests; defaults to the call time.
 */
export function freshnessStamp(updated: Date, now: Date = new Date()): string {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round(
    (startOfDay(now) - startOfDay(updated)) / (24 * 60 * 60 * 1000),
  );

  if (dayDiff <= 0) {
    // Same calendar day. Morning vs. later in the day, in plain words.
    return updated.getHours() < 12 ? "this morning" : "today";
  }
  if (dayDiff === 1) return "yesterday";
  if (dayDiff < 7) return `${dayDiff} days ago`;
  if (dayDiff < 14) return "last week";

  return `on ${updated.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(updated.getFullYear() !== now.getFullYear()
      ? { year: "numeric" }
      : {}),
  })}`;
}

/**
 * Human labels for audience-publication enums. Raw values ("couple",
 * "published") are storage words, not sentences; the owner reads these on
 * the sharing surfaces, so they get the same care as any other copy.
 */
export function audienceKindLabel(kind: string): string {
  if (kind === "couple") return "Couple";
  if (kind === "class") return "Class";
  // "module" is the stored enum; owners and viewers both read "Project".
  if (kind === "module") return "Project";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function publicationStateLabel(state: string): string {
  if (state === "published") return "Link live";
  if (state === "draft") return "Private draft";
  if (state === "unpublished") return "Unpublished";
  if (state === "revoked") return "Links revoked";
  return state.charAt(0).toUpperCase() + state.slice(1);
}

/** "3 Oct 2026" from an ISO calendar date, UTC-stable. */
export function calendarDateLabel(iso: string): string {
  const parsed = Date.parse(`${iso}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(parsed));
}
