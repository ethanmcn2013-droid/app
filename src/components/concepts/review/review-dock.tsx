"use client";

/**
 * The review dock on every concept page: a verdict, three notes that save as
 * you type, and a way through all the concepts without going back to the
 * gallery. It floats above every concept, full-screen ones included.
 */

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ConceptMeta } from "../types";
import { conceptHref, conceptKey, viewLabel } from "../views";
import { updateReview, useReviews, VERDICTS, type Verdict } from "./store";
import styles from "./review.module.css";

const COLLAPSE_KEY = "signal:concept-review:dock-collapsed";
let collapsedCache: boolean | null = null;
const collapseListeners = new Set<() => void>();
function readCollapsed() {
  if (collapsedCache === null) {
    try {
      collapsedCache = window.localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      collapsedCache = false;
    }
  }
  return collapsedCache;
}
function setCollapsed(value: boolean) {
  collapsedCache = value;
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    // Private windows: the dock still collapses for this visit.
  }
  for (const listener of collapseListeners) listener();
}
function subscribeCollapsed(listener: () => void) {
  collapseListeners.add(listener);
  return () => {
    collapseListeners.delete(listener);
  };
}

const Chevron = ({ flip = false }: { flip?: boolean }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}>
    <path d="m6 3.5 4.5 4.5L6 12.5" />
  </svg>
);

export function ReviewDock({ concepts, current }: { concepts: readonly ConceptMeta[]; current: string }) {
  const router = useRouter();
  const reviews = useReviews();
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const index = concepts.findIndex((concept) => conceptKey(concept) === current);
  const concept = concepts[index];
  const prev = concepts[(index - 1 + concepts.length) % concepts.length];
  const next = concepts[(index + 1) % concepts.length];
  const nextOpen = [...concepts.slice(index + 1), ...concepts.slice(0, index)].find((item) => !reviews[conceptKey(item)]?.verdict);
  const review = reviews[current] ?? {};
  const reviewed = concepts.filter((item) => reviews[conceptKey(item)]?.verdict).length;
  const inView = concepts.filter((item) => item.view === concept?.view);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowRight" && next) {
        event.preventDefault();
        router.push(conceptHref(next));
      } else if (event.key === "ArrowLeft" && prev) {
        event.preventDefault();
        router.push(conceptHref(prev));
      } else if (["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        const verdict = VERDICTS[Number(event.key) - 1]!.key;
        updateReview(current, { verdict: review.verdict === verdict ? undefined : verdict });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, next, prev, review.verdict, router]);

  if (!concept) return null;
  const edges = (
    <>
      <Link className={`${styles.edge} ${styles.edgePrev}`} href={conceptHref(prev)} aria-label={`Previous concept: ${prev.title}`}>
        <Chevron flip />
        <span className={styles.edgeLabel}><small>Previous</small>{prev.title}</span>
      </Link>
      <Link className={`${styles.edge} ${styles.edgeNext}`} data-beside-dock={collapsed ? undefined : ""} href={conceptHref(next)} aria-label={`Next concept: ${next.title}`}>
        <span className={styles.edgeLabel}><small>Next</small>{next.title}</span>
        <Chevron />
      </Link>
    </>
  );
  const setVerdict = (verdict: Verdict) => updateReview(current, { verdict: review.verdict === verdict ? undefined : verdict });
  const position = `${viewLabel(concept.view)} ${inView.indexOf(concept) + 1} of ${inView.length}`;

  if (collapsed) {
    return (
      <>
      {edges}
      <div className={styles.pill} role="region" aria-label="Concept review">
        <Link className={styles.iconBtn} href={conceptHref(prev)} aria-label={`Previous: ${prev.title}`} title="Previous (Alt ←)"><Chevron flip /></Link>
        <button type="button" className={styles.pillMain} onClick={() => setCollapsed(false)} aria-label="Open the review panel">
          <span className={styles.dot} data-verdict={review.verdict ?? "none"} aria-hidden="true" />
          <span className={styles.pillText}>{position}</span>
          <span className={styles.pillCount}>{reviewed}/{concepts.length}</span>
        </button>
        <Link className={styles.iconBtn} href={conceptHref(next)} aria-label={`Next: ${next.title}`} title="Next (Alt →)"><Chevron /></Link>
      </div>
      </>
    );
  }

  return (
    <>
    {edges}
    <section className={styles.dock} aria-label={`Review: ${concept.title}`}>
      <div className={styles.progress} aria-hidden="true"><i style={{ width: `${(reviewed / concepts.length) * 100}%` }} /></div>
      <header className={styles.dockHead}>
        <span className={styles.eyebrow}>{position}</span>
        <span className={styles.count}>{reviewed} of {concepts.length} reviewed</span>
        <Link className={styles.iconBtn} href="/app/concepts" aria-label="All concepts" title="All concepts">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></svg>
        </Link>
        <button type="button" className={styles.iconBtn} onClick={() => setCollapsed(true)} aria-label="Minimise the review panel" title="Minimise">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 8h8" /></svg>
        </button>
      </header>

      <h2 className={styles.dockTitle}>{concept.title}</h2>
      <p className={styles.thesis}>{concept.thesis}</p>

      <div className={styles.verdicts} role="group" aria-label="Verdict">
        {VERDICTS.map((verdict, i) => (
          <button
            key={verdict.key}
            type="button"
            className={styles.verdict}
            data-verdict={verdict.key}
            aria-pressed={review.verdict === verdict.key}
            onClick={() => setVerdict(verdict.key)}
            title={`${verdict.hint} (Alt ${i + 1})`}
          >
            {verdict.label}
          </button>
        ))}
      </div>

      <label className={styles.field}>
        <span>{review.verdict === "partly" ? "Parts to keep" : "What works"}</span>
        <textarea rows={2} value={review.keep ?? ""} onChange={(event) => updateReview(current, { keep: event.target.value })} placeholder={review.verdict === "partly" ? "The parts worth carrying forward…" : "What you like and want kept…"} />
      </label>
      <label className={styles.field}>
        <span>Change or drop</span>
        <textarea rows={2} value={review.change ?? ""} onChange={(event) => updateReview(current, { change: event.target.value })} placeholder="What isn't working, or should change…" />
      </label>
      <label className={styles.field}>
        <span>Notes</span>
        <textarea rows={2} value={review.notes ?? ""} onChange={(event) => updateReview(current, { notes: event.target.value })} placeholder="Anything else, e.g. combine with another concept…" />
      </label>

      <footer className={styles.dockFoot}>
        <Link className={styles.navBtn} href={conceptHref(prev)} title="Previous (Alt ←)"><Chevron flip />Previous</Link>
        {nextOpen && conceptKey(nextOpen) !== conceptKey(next) ? (
          <Link className={styles.skip} href={conceptHref(nextOpen)} title={nextOpen.title}>Next not reviewed</Link>
        ) : <span />}
        <Link className={`${styles.navBtn} ${styles.navNext}`} href={conceptHref(next)} title="Next (Alt →)">Next<Chevron /></Link>
      </footer>
      <p className={styles.keys}>Saved as you type · <kbd>Alt</kbd> + <kbd>←</kbd> <kbd>→</kbd> move · <kbd>Alt</kbd> + <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> verdict</p>
    </section>
    </>
  );
}
