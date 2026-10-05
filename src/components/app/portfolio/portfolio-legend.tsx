"use client";

/**
 * "How to read this" (spec 3.1a): one row under the toolbar, drawn with the
 * real marks, scaled down, not icons. Open on a first visit; closing it is
 * remembered in this browser only (`localStorage`, every access wrapped),
 * and a tiny inline script applies that before paint so a returning reader
 * never sees it flash open and then close.
 */

import { useSyncExternalStore } from "react";
import styles from "./portfolio.module.css";

const KEY = "signal.timeline.legend";
const EVENT = "signal-timeline-legend";
let memory: boolean | null = null;

function readOpen(): boolean {
  if (memory !== null) return memory;
  try {
    return window.localStorage.getItem(KEY) !== "closed";
  } catch {
    return true;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useLegendOpen(): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(subscribe, readOpen, () => true);
  function set(next: boolean) {
    memory = next;
    try {
      if (next) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, "closed");
    } catch {
      // Private windows and blocked storage: remembered for this visit only.
    }
    document.documentElement.toggleAttribute("data-tl-legend-closed", !next);
    window.dispatchEvent(new Event(EVENT));
  }
  return [open, set];
}

/** Before paint: hide the legend for a reader who closed it last time. */
export const LEGEND_SCRIPT = `try{if(localStorage.getItem("${KEY}")==="closed")document.documentElement.setAttribute("data-tl-legend-closed","")}catch(_){}`;

export function PortfolioLegend({ id, milestonesUnavailable }: { id: string; milestonesUnavailable: boolean }) {
  return (
    <div id={id} className={styles.legend} role="group" aria-label="How to read this">
      <span className={styles.legendItem}>
        <span className={styles.legendMark} style={{ width: 46 }} aria-hidden="true">
          <span className={styles.bar} data-tone="success" style={{ left: 0, width: 46 }}>
            <span className={styles.barDone} style={{ width: "0%" }} />
          </span>
        </span>
        Start to target date
      </span>
      <span className={styles.legendItem}>
        <span className={styles.legendMark} style={{ width: 34 }} aria-hidden="true">
          <span className={styles.bar} data-tone="success" style={{ left: 0, width: 34 }}>
            <span className={styles.barDone} style={{ width: "100%" }} />
          </span>
        </span>
        Done so far
      </span>
      {milestonesUnavailable ? null : (
        <>
          <span className={styles.legendItem}>
            <span className={styles.legendMark} style={{ width: 12 }} aria-hidden="true">
              <span className={styles.diamond} data-tone="upcoming" style={{ left: 6 }} />
            </span>
            Milestone
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendMark} style={{ width: 12 }} aria-hidden="true">
              <span className={styles.diamond} data-tone="done" style={{ left: 6 }} />
            </span>
            Milestone done
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendMark} style={{ width: 12 }} aria-hidden="true">
              <span className={styles.diamond} data-tone="next" style={{ left: 6 }} />
            </span>
            Next milestone
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendMark} style={{ width: 20 }} aria-hidden="true">
              <span className={styles.cluster} style={{ left: 10 }}>
                2
              </span>
            </span>
            Several milestones
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendMark} style={{ width: 12 }} aria-hidden="true">
              <span className={styles.diamond} data-tone="overdue" style={{ left: 6 }} />
            </span>
            Missed
          </span>
        </>
      )}
      <span className={styles.legendItem}>
        <span className={styles.legendMark} style={{ width: 10 }} aria-hidden="true">
          <span className={styles.flag} style={{ left: 5 }}>
            <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
              <path d="M1.5 13V1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M1.5 1.75h8l-2 2.75 2 2.75h-8" fill="currentColor" />
            </svg>
          </span>
        </span>
        Target date
      </span>
      <span className={styles.legendItem}>
        <span className={styles.legendToday} aria-hidden="true" />
        Today
      </span>
      <span className={styles.legendItem}>
        <span className={styles.legendMark} style={{ width: 34 }} aria-hidden="true">
          <span className={styles.bar} data-tone="paused" style={{ left: 0, width: 34 }} />
        </span>
        Paused
      </span>
      <span className={styles.legendItem}>
        <span className={styles.legendMark} style={{ width: 46 }} aria-hidden="true">
          <span className={styles.bar} data-tone="warning" data-past="" style={{ left: 0, width: 28 }}>
            <span className={styles.barDone} style={{ width: "60%" }} />
          </span>
          <span className={styles.pastRun} style={{ left: 28, width: 18 }} />
        </span>
        Past target
      </span>
      {milestonesUnavailable ? <span className={styles.legendNote}>Milestones couldn&apos;t be loaded.</span> : null}
    </div>
  );
}
