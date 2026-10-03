"use client";

/**
 * The one Filter button beside the views: how a note came in (single
 * choice, only the ways that have notes, each with its count), then the
 * legend for the list's two marks, so there is one place to learn them.
 *
 * Menu-button pattern: arrows move, Escape and Tab close, focus returns to
 * the button. `F` opens it from the list (wired in NotesWorkspace through
 * `openRef`).
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  activeSources,
  FILTER_LABELS,
  type NotebookFilter,
  type SourceCounts,
} from "@/modules/notes/lib/notes-view-model";
import { NOTES_LEGEND } from "@/modules/notes/lib/notes-copy";
import { CheckIcon, FilterIcon, SourceIcon } from "@/modules/notes/app/workspace/icons";

import styles from "./notes-workspace.module.css";

export function NotesFilterMenu({
  filter,
  counts,
  onChange,
  openRef,
}: {
  filter: NotebookFilter;
  counts: SourceCounts;
  onChange: (filter: NotebookFilter) => void;
  /** Lets the page's `F` key open the menu. */
  openRef?: React.RefObject<(() => void) | null>;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const sources = activeSources(counts);
  const activeLabel = filter !== "all" && filter !== "review" ? FILTER_LABELS[filter] : null;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!openRef) return;
    openRef.current = () => setOpen(true);
    return () => {
      openRef.current = null;
    };
  }, [openRef]);

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]');
    const checked = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    (checked ?? items?.[0])?.focus({ preventScroll: true });
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close(false);
    };
    window.addEventListener("pointerdown", onPointer, true);
    return () => window.removeEventListener("pointerdown", onPointer, true);
  }, [close, open]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    }
  };

  const choose = (next: NotebookFilter) => {
    onChange(next);
    close(true);
  };

  const total = sources.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className={styles.filterAnchor}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.filterButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-keyshortcuts="F"
        aria-label={activeLabel ? `Filter: ${activeLabel}` : "Filter"}
        title={activeLabel ? `Filter: ${activeLabel} (F)` : "Filter (F)"}
        data-active={activeLabel ? "" : undefined}
        data-open={open ? "" : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <FilterIcon />
        <span className={styles.filterLabel} aria-hidden="true">
          {activeLabel ? `Filter · ${activeLabel}` : "Filter"}
        </span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Filter notes"
          className={`${styles.menu} ${styles.filterMenu}`}
          data-notes-overlay=""
          onKeyDown={onMenuKeyDown}
        >
          <p className={styles.menuHeading} aria-hidden="true">
            How it came in
          </p>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!activeLabel}
            className={styles.menuItem}
            onClick={() => choose("all")}
          >
            <span className={styles.menuCheck} aria-hidden="true">
              {!activeLabel ? <CheckIcon /> : null}
            </span>
            All sources
            <span className={styles.menuCount}>{total}</span>
          </button>
          {sources.map(({ source, count }) => (
            <button
              key={source}
              type="button"
              role="menuitemradio"
              aria-checked={filter === source}
              className={styles.menuItem}
              onClick={() => choose(filter === source ? "all" : source)}
            >
              <span className={styles.menuCheck} aria-hidden="true">
                {filter === source ? <CheckIcon /> : <SourceIcon source={source} />}
              </span>
              {FILTER_LABELS[source]}
              <span className={styles.menuCount}>{count}</span>
            </button>
          ))}
          <div className={styles.menuLegend} role="presentation">
            <span className={styles.legendItem}>
              <span className={styles.waitingDot} aria-hidden="true" />
              {NOTES_LEGEND.waiting}
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendCheck} aria-hidden="true">
                <CheckIcon />
              </span>
              {NOTES_LEGEND.inTasks}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
