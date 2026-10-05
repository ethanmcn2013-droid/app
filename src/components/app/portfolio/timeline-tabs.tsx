"use client";

/**
 * The view switch that starts every Timeline page (v3, round 2):
 *
 *   [ All projects ][ TO The Orchard, events ][▾]
 *
 * Two real link tabs. The second always leads with the Project, never with
 * a plan inside it: a plan name ("Mara & Finn") is the H1 on its own page
 * and never stands in for the Project it belongs to. With no Project known
 * yet it reads "One project".
 *
 * The chevron is a separate button that opens the switcher: "Timelines in
 * <Project>" (the plans, the open one ticked) and "Other projects" (catalog
 * rows, each opened through the authorized index). Only authorized options
 * are ever passed in.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { projectColor } from "@/components/shell/app-sidebar";
import { RowMenu, type RowMenuEntry, type RowMenuState } from "./row-menu";
import { ChevronDown } from "./timeline-ui";
import styles from "./timeline-ui.module.css";

export type TimelineTabProject = Readonly<{
  id: string;
  name: string;
  monogram: string;
  /** Where the tab goes: the last plan opened, or the plan on screen. */
  href: string;
}>;

export type SwitcherOption = Readonly<{
  key: string;
  name: string;
  href: string;
  /** Other projects show their identity tile; plans show a diamond. */
  tile?: Readonly<{ id: string; monogram: string }>;
  current?: boolean;
}>;

export type SwitcherSection = Readonly<{ title: string; options: readonly SwitcherOption[] }>;

function BarsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={styles.tabIcon}>
      <rect x="2" y="3" width="8" height="2.4" rx="1.2" fill="currentColor" />
      <rect x="5" y="6.8" width="9" height="2.4" rx="1.2" fill="currentColor" opacity="0.7" />
      <rect x="3.5" y="10.6" width="6" height="2.4" rx="1.2" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={styles.tabIcon}>
      <path d="M8 2.5 13.5 8 8 13.5 2.5 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** A Project's identity tile, for server pages that cannot call `projectColor`. */
export function ProjectTile({ id, monogram, className }: { id: string; monogram: string; className?: string }) {
  return (
    <span className={className} style={{ background: projectColor(id) }} aria-hidden="true">
      {monogram}
    </span>
  );
}

export function TimelineTabs({
  current,
  allHref,
  project,
  sections,
}: {
  current: "all" | "project";
  allHref: string;
  project: TimelineTabProject | null;
  sections: readonly SwitcherSection[];
}) {
  const router = useRouter();
  const [menu, setMenu] = useState<RowMenuState | null>(null);
  const options = sections.flatMap((section) => section.options);
  const projectHref = project?.href ?? "/app/timeline?open=project";

  function openMenu(button: HTMLButtonElement) {
    const items: RowMenuEntry[] = [];
    sections.forEach((section, index) => {
      if (section.options.length === 0) return;
      if (index > 0 && items.length > 0) items.push({ id: `sep-${index}`, separator: true });
      items.push({ id: `head-${index}`, heading: section.title });
      for (const option of section.options) {
        items.push({
          id: option.key,
          label: option.name,
          current: option.current,
          icon: option.tile ? (
            <span className={styles.menuTile} style={{ background: projectColor(option.tile.id) }} aria-hidden="true">
              {option.tile.monogram}
            </span>
          ) : (
            <span className={styles.menuDiamond} aria-hidden="true" />
          ),
          onSelect: () => router.push(option.href),
        });
      }
    });
    setMenu({ anchor: button.getBoundingClientRect(), items, label: "Switch project", returnTo: button });
  }

  return (
    <div className={styles.tabsWrap}>
      <div className={styles.tabs}>
        <div role="tablist" aria-label="Timeline views" className={styles.tabList}>
          <Link
            href={allHref}
            role="tab"
            aria-selected={current === "all"}
            aria-current={current === "all" ? "page" : undefined}
            className={styles.tab}
            prefetch={false}
            data-timeline-tab="all"
          >
            <BarsIcon />
            <span className={styles.tabLabel}>All projects</span>
          </Link>
          <Link
            href={projectHref}
            role="tab"
            aria-selected={current === "project"}
            aria-current={current === "project" ? "page" : undefined}
            className={styles.tab}
            prefetch={false}
            title={project ? `${project.name} timeline` : undefined}
            data-timeline-tab="project"
          >
            {project ? (
              <span className={styles.tabTile} style={{ background: projectColor(project.id) }} aria-hidden="true">
                {project.monogram}
              </span>
            ) : (
              <DiamondIcon />
            )}
            <span className={styles.tabLabel}>{project?.name ?? "One project"}</span>
          </Link>
        </div>
        {options.length > 1 ? (
          <button
            type="button"
            className={styles.tabChevron}
            aria-haspopup="menu"
            aria-expanded={menu !== null}
            aria-label="Switch project"
            title="Switch project"
            onClick={(event) => (menu ? setMenu(null) : openMenu(event.currentTarget))}
            data-project-switcher=""
          >
            <ChevronDown size={14} className={styles.tabChevronIcon} />
          </button>
        ) : null}
      </div>
      <RowMenu state={menu} onClose={() => setMenu(null)} />
    </div>
  );
}
