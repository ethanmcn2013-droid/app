"use client";

// What survives of the design lab: the project view tabs, which are real
// production navigation. The lab's own chrome — its ribbon, dataset and
// state selectors, fake suite rail and account chip — was deleted with
// T·132; the lab route it belonged to is gone, and shipping a fake
// "Signal Studio" sidebar to every client was cost without a reader.

import { useEffect, useRef, type Ref } from "react";
import { VIEW_LABELS, LAB_VIEWS, type LabRouteState } from "../types";
import { Icon } from "./icons";
import styles from "./shared.module.css";

const VIEW_PURPOSES: Record<LabRouteState["view"], string> = {
  board: "Move and prioritise work by status",
  list: "Scan and edit operational task fields",
  timeline: "Plan dated work and explicit unscheduled tasks",
  calendar: "Review commitments by day, week, or agenda",
};

export function ViewTabs({ route, onRouteChange, hrefFor, className = "" }: { route: LabRouteState; onRouteChange: (patch: Partial<LabRouteState>) => void; hrefFor?: (view: LabRouteState["view"]) => string; className?: string }) {
  // When the tab row scrolls (phone widths), the current view must not
  // load clipped mid-word off the right edge — pull it into view once.
  const activeRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [route.view]);
  return (
    <nav aria-label="Project views" className={`${styles.viewTabs} ${className}`}>
      {LAB_VIEWS.map((view) => {
        const current = route.view === view;
        // Production passes canonical hrefs so the views are real links —
        // middle-click and cmd-click open a tab, copy-link-address works.
        // A plain click still navigates client-side through onRouteChange.
        // The lab has no routes and keeps buttons.
        if (hrefFor) {
          return (
            <a
              aria-current={current ? "page" : undefined}
              href={hrefFor(view)}
              key={view}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                event.preventDefault();
                onRouteChange({ view });
              }}
              ref={current ? (activeRef as Ref<HTMLAnchorElement>) : undefined}
              title={VIEW_PURPOSES[view]}
            >
              <Icon name={view} size={15} />{VIEW_LABELS[view]}
            </a>
          );
        }
        return (
          <button aria-current={current ? "page" : undefined} key={view} onClick={() => onRouteChange({ view })} ref={current ? (activeRef as Ref<HTMLButtonElement>) : undefined} title={VIEW_PURPOSES[view]} type="button">
            <Icon name={view} size={15} />{VIEW_LABELS[view]}
          </button>
        );
      })}
    </nav>
  );
}
