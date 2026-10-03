"use client";

/**
 * The states All projects can be in when there is no chart to draw
 * (spec §6): no projects yet, the read failed, and a filter that hides every
 * row. Each keeps the page's frame and offers one way forward.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { addMonths, SHORT_MONTHS, startOfMonth } from "@/lib/projects/project-portfolio-scale";
import styles from "./portfolio.module.css";

const GHOSTS = [
  { left: "6%", width: "46%", done: "55%" },
  { left: "22%", width: "58%", done: "30%" },
  { left: "40%", width: "50%", done: "12%" },
] as const;

/** No Projects yet: the page shows what it will become. */
export function PortfolioEmpty({ todayIso }: { todayIso: string }) {
  const first = addMonths(startOfMonth(todayIso), -1);
  const months = Array.from({ length: 6 }, (_, i) => SHORT_MONTHS[Number(addMonths(first, i).slice(5, 7)) - 1]);
  const day = Number(todayIso.slice(8, 10));
  const todayLeft = `${((1 + (day - 1) / 30) / 6) * 100}%`;
  return (
    <section className={styles.stateCard} aria-labelledby="portfolio-empty-title">
      <div className={styles.ghost} aria-hidden="true">
        <div className={styles.ghostAxis}>
          {months.map((month, i) => (
            <span key={`${month}-${i}`}>{month}</span>
          ))}
        </div>
        <div className={styles.ghostRows}>
          <span className={styles.ghostToday} style={{ left: todayLeft }} />
          {GHOSTS.map((ghost, i) => (
            <span key={i} className={styles.ghostLane}>
              <span className={styles.ghostBar} style={{ left: ghost.left, width: ghost.width, animationDelay: `${i * 90}ms` }}>
                <span style={{ width: ghost.done }} />
              </span>
            </span>
          ))}
        </div>
      </div>
      <h2 id="portfolio-empty-title" className={styles.stateTitle}>
        Your projects will line up here
      </h2>
      <p className={styles.stateBody}>Each project becomes one bar, from when work starts to its target date.</p>
      <div className={styles.stateActions}>
        <Link href="/app/project" className={styles.buttonPrimary}>
          Create a project
        </Link>
      </div>
    </section>
  );
}

/** The catalog read failed: say so plainly, keep the frame, offer a retry. */
export function PortfolioUnavailable() {
  const router = useRouter();
  return (
    <section className={styles.stateCard} data-tone="quiet" role="status" aria-labelledby="portfolio-unavailable-title">
      <span className={styles.stateMark} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 4.75v3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="10.9" r="0.9" fill="currentColor" />
        </svg>
      </span>
      <h2 id="portfolio-unavailable-title" className={styles.stateTitle}>
        We couldn&apos;t load your projects just now
      </h2>
      <p className={styles.stateBody}>Your work is safe. Try again in a moment.</p>
      <div className={styles.stateActions}>
        <button type="button" className={styles.buttonPrimary} onClick={() => router.refresh()}>
          Try again
        </button>
        <Link href="/app/project" className={styles.button}>
          Open Projects
        </Link>
      </div>
    </section>
  );
}

/** Every row is filtered out. */
export function PortfolioFilterEmpty({
  find,
  onShowAll,
  onClear,
}: {
  find: string;
  onShowAll: () => void;
  onClear: () => void;
}) {
  const text = find.trim();
  return (
    <div className={styles.filterEmpty} role="status">
      <p className={styles.filterEmptyTitle}>{text ? `No projects called “${text}”.` : "No projects match these filters."}</p>
      <button type="button" className={styles.button} onClick={text ? onClear : onShowAll}>
        {text ? "Clear" : "Show all"}
      </button>
    </div>
  );
}
