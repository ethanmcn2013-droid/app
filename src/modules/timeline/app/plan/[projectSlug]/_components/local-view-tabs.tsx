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

/** Styling register carried from shared.module.css `.viewTabs`: quiet text at
 *  rest, a soft wash on hover, the current view filled and semibold. Tap
 *  targets are a literal 44px — this repo remaps Tailwind's scale, so the
 *  familiar `-11` utilities resolve to 80px and are banned. */
const TAB_BASE =
  "inline-flex min-h-[44px] items-center rounded-md px-2.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

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
    <nav aria-label="Project views" className="inline-flex items-center gap-0.5">
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
                ? "bg-bg-sunken font-semibold text-ink"
                : "font-medium text-ink-soft hover:bg-bg-sunken hover:text-ink"
            }`}
          >
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
