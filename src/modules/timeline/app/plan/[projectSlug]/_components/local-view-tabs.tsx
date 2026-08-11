import Link from "next/link";
import {
  buildTimelineProjectHref,
  type TimelineQueryContext,
} from "@/modules/timeline/lib/project-switcher-model";

export type LocalView = "timeline" | "milestones";

/**
 * The project's two local views.
 *
 * Real links with `aria-current="page"` inside a plain <nav>, following
 * ViewTabs (src/components/hybrid/shared/lab-chrome.tsx) rather than
 * role="tablist": these are routes, not panels, so middle-click opens a tab
 * and copy-link-address gives a working address. A tablist would promise
 * assistive technology a panel swap that never happens.
 *
 * The URL mechanism is unchanged — `?mode=edit` for Milestones, no `mode` for
 * Timeline — so every existing deep link, including `?mode=view`, still lands
 * exactly where it did.
 */
const VIEWS: ReadonlyArray<{
  id: LocalView;
  label: string;
  purpose: string;
}> = [
  {
    id: "timeline",
    label: "Timeline",
    purpose: "Read the plan as it is laid out",
  },
  {
    id: "milestones",
    label: "Milestones",
    purpose: "Rename, re-date, reorder and hide milestones",
  },
];

/**
 * One segmented control, not two loose chips.
 *
 * Timeline used to be a grey filled chip and Milestones a borderless text
 * link, which read as one button and one label rather than as two states of
 * the same switch — and they sat in a row that also held an outlined Preview
 * and a solid Share, so four different button treatments shared six inches of
 * chrome. The pair is now a track with a moving fill: one object, two states,
 * and the row is down to a segmented control, an outlined secondary and the
 * indigo primary.
 *
 * The track is exactly 44px so it lines up with Preview and Share beside it;
 * the links inside it are 40px, which is the segment's own inset. Still real
 * links with `aria-current="page"` — the switch is a visual grammar, not a
 * change of semantics.
 */
const TAB_TRACK =
  "inline-flex min-h-[44px] items-center gap-0 rounded-lg bg-bg-sunken p-[2px]";
const TAB_BASE =
  "inline-flex min-h-[40px] items-center rounded-md px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function LocalViewTabs({
  projectSlug,
  current,
  context,
}: {
  projectSlug: string;
  current: LocalView;
  context: TimelineQueryContext;
}) {
  return (
    <nav aria-label="Project views" className={TAB_TRACK}>
      {VIEWS.map((view) => {
        const isCurrent = view.id === current;
        return (
          <Link
            key={view.id}
            href={buildTimelineProjectHref(projectSlug, {
              ...context,
              mode: view.id === "milestones" ? "edit" : null,
            })}
            aria-current={isCurrent ? "page" : undefined}
            title={view.purpose}
            className={`${TAB_BASE} ${
              isCurrent
                ? "bg-white font-medium text-ink shadow-[0_0_0_1px_var(--line-soft),0_1px_2px_rgba(17,17,17,0.05)]"
                : "font-medium text-ink-soft hover:text-ink"
            }`}
          >
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
