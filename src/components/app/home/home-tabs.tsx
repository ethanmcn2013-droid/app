"use client";

/**
 * Home's two views (founder instruction, 5 October 2026): "Home", the page
 * that opens on what needs you, and "Overview", the week view. Overview is a
 * tab of Home, not a place of its own.
 *
 * A real tablist: one tab stop, Left and Right (and Home, End) move between
 * the tabs and open the one they land on. Each tab is also a plain link, so
 * the address always says which view is open: `/app/home` and
 * `/app/home/briefing`, the addresses both pages already had. The tablist sits
 * in the same place on both pages, so nothing jumps when the view changes.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type KeyboardEvent } from "react";
import { HOME_TABPANEL_ID, homeTabId, type HomeTab } from "./home-tab-ids";
import styles from "./home-tabs.module.css";

export type { HomeTab };

const TABS: ReadonlyArray<{ id: HomeTab; label: string }> = [
  { id: "home", label: "Home" },
  { id: "overview", label: "Overview" },
];

export function HomeTabs({
  current,
  homeHref = "/app/home",
  overviewHref = "/app/home/briefing",
}: {
  current: HomeTab;
  homeHref?: string;
  /** Carries the Project the Overview opens on, when Home knows it. */
  overviewHref?: string;
}) {
  const router = useRouter();
  const list = useRef<HTMLDivElement>(null);
  const hrefOf = (tab: HomeTab) => (tab === "home" ? homeHref : overviewHref);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = TABS.findIndex((tab) => tab.id === current);
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (at + 1) % TABS.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (at - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next < 0 || next === at) return;
    event.preventDefault();
    const tab = TABS[next]!;
    list.current?.querySelector<HTMLElement>(`#${homeTabId(tab.id)}`)?.focus();
    router.push(hrefOf(tab.id));
  }

  return (
    <div ref={list} className={styles.tabs} role="tablist" aria-label="Home views" onKeyDown={onKeyDown}>
      {TABS.map((tab) => {
        const selected = tab.id === current;
        return (
          <Link
            key={tab.id}
            id={homeTabId(tab.id)}
            href={hrefOf(tab.id)}
            role="tab"
            aria-selected={selected}
            aria-controls={selected ? HOME_TABPANEL_ID : undefined}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            data-on={selected ? "" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
