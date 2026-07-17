"use client";

/**
 * Room view bar — the Option B lab's 52px raised control band, live in
 * production (T·95 lab parity). Icon view tabs on the left; on the
 * right the working tools: search-this-view ("/"), Filter, Sort,
 * Fields (list), density, the mono result count, Save view, and the
 * production-only Share/overflow cluster with the Live dot. Every
 * control operates on the real task store via RoomToolsProvider —
 * nothing here is decorative.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIORITY_LABEL, type Priority } from "@/lib/data";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { ShareButton } from "@/components/app/share/share-button";
import { PageActionsOverflow } from "@/components/app/page-header";
import type { ShareView } from "@/server/actions/share";
import { Icon } from "./room-icons";
import {
  useRoomTools,
  useRoomVisibleTasks,
  type RoomOwnerFilter,
  type RoomSortMode,
  type RoomView,
} from "./room-tools-context";
import styles from "./option-b.module.css";
import shared from "./room-shared.module.css";

const TABS: Array<{ href: string; view: RoomView; label: string; purpose: string }> = [
  { href: "/app/board", view: "board", label: "Board", purpose: "Move and prioritize work by status" },
  { href: "/app/list", view: "list", label: "List", purpose: "Scan and edit operational task fields" },
  { href: "/app/timeline", view: "timeline", label: "Timeline", purpose: "Plan dated work and explicit unscheduled tasks" },
  { href: "/app/calendar", view: "calendar", label: "Calendar", purpose: "Review commitments by day, week, or agenda" },
];

const PRIORITIES: Priority[] = ["p0", "p1", "p2", "p3"];

type ToolPanel = "filter" | "sort" | "save" | null;

function currentView(pathname: string): RoomView {
  if (pathname.startsWith("/app/list")) return "list";
  if (pathname.startsWith("/app/timeline")) return "timeline";
  if (pathname.startsWith("/app/calendar")) return "calendar";
  return "board";
}

function inferShareView(pathname: string): ShareView {
  return currentView(pathname) as ShareView;
}

function inferPrintPath(pathname: string): string {
  return `/print/${currentView(pathname)}`;
}

function ToolPanelShell({
  title,
  subtitle,
  panel,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  panel: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={styles.roomToolPanel}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <button aria-label={`Close ${panel} controls`} onClick={onClose} type="button">
          <Icon name="close" size={14} />
        </button>
      </header>
      {children}
    </section>
  );
}

export function RoomViewBar() {
  const pathname = usePathname() ?? "/app/board";
  const view = currentView(pathname);
  const tasksState = useTasksState();
  const visible = useRoomVisibleTasks();
  const {
    query,
    priority,
    owner,
    sort,
    density,
    activeFilterCount,
    setQuery,
    setPriority,
    setOwner,
    setSort,
    setDensity,
    clearFilters,
    fieldsOpen,
    setFieldsOpen,
    saveCurrentView,
  } = useRoomTools();
  const [panel, setPanel] = useState<ToolPanel>(null);
  const [saveName, setSaveName] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  // "/" focuses search-this-view, exactly the lab's shortcut.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = target.matches(
        "input, textarea, select, [contenteditable='true']",
      );
      if (!editing && event.key === "/" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const togglePanel = (next: Exclude<ToolPanel, null>) => {
    setPanel((value) => (value === next ? null : next));
    setFieldsOpen(false);
  };

  return (
    <div className={styles.roomViewBar}>
      <nav aria-label="Workspace views" className={shared.viewTabs}>
        {TABS.map((t) => (
          <Link
            aria-current={view === t.view ? "page" : undefined}
            href={t.href}
            key={t.href}
            title={t.purpose}
          >
            <Icon name={t.view} size={15} />
            {t.label}
          </Link>
        ))}
      </nav>
      <div className={shared.viewTools}>
        <label className={shared.searchBox}>
          <Icon name="search" size={15} />
          <span className={shared.srOnly}>Search this view</span>
          <input
            aria-label="Search this view"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            ref={searchRef}
            type="search"
            value={query}
          />
          <kbd>/</kbd>
        </label>
        <button
          onClick={() => togglePanel("filter")}
          title="Filter this view"
          type="button"
        >
          <Icon name="filter" size={15} />
          Filter
        </button>
        <button onClick={() => togglePanel("sort")} title="Sort this view" type="button">
          <Icon name="sort" size={15} />
          Sort
        </button>
        <button
          disabled={view !== "list"}
          onClick={() => {
            setFieldsOpen(!fieldsOpen);
            setPanel(null);
          }}
          title={view === "list" ? "Choose visible fields" : "Fields apply to the list view"}
          type="button"
        >
          <Icon name="fields" size={15} />
          Fields
        </button>
        <label className={shared.compactSelect}>
          <span className={shared.srOnly}>Density</span>
          <Icon name="density" size={15} />
          <select
            aria-label="Density"
            onChange={(event) => setDensity(event.target.value as "compact" | "comfortable")}
            value={density}
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
          </select>
        </label>
        <span className={styles.roomResultCount}>
          {visible.length}/{tasksState.tasks.length}
          <span> shown</span>
        </span>
        {activeFilterCount > 0 ? (
          <button
            className={styles.activeFilterButton}
            onClick={() => setPanel("filter")}
            type="button"
          >
            {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
          </button>
        ) : null}
        <button onClick={() => togglePanel("save")} title="Save this view" type="button">
          Save view
        </button>
        <span className="hidden lg:inline-flex">
          <ShareButton view={inferShareView(pathname)} />
        </span>
        <PageActionsOverflow
          printPath={inferPrintPath(pathname)}
          shareView={inferShareView(pathname)}
          showShare
        />
        <span
          aria-label="Live updates active"
          className={styles.roomResultCount}
          style={{ alignItems: "center", display: "inline-flex", gap: 5 }}
        >
          <span
            aria-hidden="true"
            style={{
              background: "var(--x-task-success)",
              borderRadius: "50%",
              display: "inline-block",
              height: 6,
              width: 6,
            }}
          />
          Live
        </span>
      </div>

      {panel === "filter" ? (
        <ToolPanelShell
          onClose={() => setPanel(null)}
          panel="filter"
          subtitle="Applies to every view"
          title="Filter the room"
        >
          <div className={styles.roomFilterFields}>
            <label>
              <span>Priority</span>
              <select
                aria-label="Filter by priority"
                onChange={(event) => setPriority(event.target.value as "all" | Priority)}
                value={priority}
              >
                <option value="all">All priorities</option>
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_LABEL[value].label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>People</legend>
              {(["all", "assigned", "unassigned"] as RoomOwnerFilter[]).map((value) => (
                <label key={value}>
                  <input
                    checked={owner === value}
                    name="owner-filter"
                    onChange={() => setOwner(value)}
                    type="radio"
                  />
                  <span>
                    {value === "all"
                      ? "Everyone"
                      : value === "assigned"
                        ? "Has an owner"
                        : "Unassigned"}
                  </span>
                </label>
              ))}
            </fieldset>
            <button
              className={styles.roomResetFilters}
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          </div>
        </ToolPanelShell>
      ) : null}

      {panel === "sort" ? (
        <ToolPanelShell
          onClose={() => setPanel(null)}
          panel="sort"
          subtitle="Applies to every view"
          title="Order the room"
        >
          <fieldset className={styles.roomSortOptions}>
            <legend className={shared.srOnly}>Sort tasks</legend>
            {(
              [
                ["manual", "Workspace order", "Keep the deliberate lane and group order."],
                ["date", "Schedule", "Dated work first, then explicitly unscheduled work."],
                ["title", "Task title", "A to Z within each view composition."],
              ] as const
            ).map(([value, label, description]) => (
              <label key={value}>
                <input
                  checked={sort === value}
                  name="room-sort"
                  onChange={() => setSort(value as RoomSortMode)}
                  type="radio"
                />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </fieldset>
        </ToolPanelShell>
      ) : null}

      {panel === "save" ? (
        <ToolPanelShell
          onClose={() => setPanel(null)}
          panel="save"
          subtitle="Current view, filters, sort, and density"
          title="Save this view"
        >
          <form
            className={styles.roomFilterFields}
            onSubmit={(event) => {
              event.preventDefault();
              const name = saveName.trim();
              if (!name) return;
              saveCurrentView(name, view);
              setSaveName("");
              setPanel(null);
            }}
          >
            <label>
              <span>Name</span>
              <input
                aria-label="Saved view name"
                autoFocus
                maxLength={40}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="e.g. Overdue, mine only"
                style={{
                  background: "var(--x-task-raised)",
                  border: "1px solid var(--x-task-border)",
                  borderRadius: 6,
                  color: "var(--x-task-text)",
                  font: "inherit",
                  fontSize: 11,
                  minHeight: 30,
                  padding: "0 8px",
                }}
                type="text"
                value={saveName}
              />
            </label>
            <button className={styles.roomResetFilters} type="submit">
              Save to this workspace
            </button>
          </form>
        </ToolPanelShell>
      ) : null}
    </div>
  );
}
