import { ArrivalSettle } from "@/components/system/arrival-settle";
import styles from "../components/overview/overview.module.css";

/**
 * /app/home/briefing loading boundary: a tracing of the Overview.
 *
 * Loading canon (pitch 10): once chrome exists, loading stays inside the
 * content region, with no full-screen takeover. It is drawn from the settled
 * page's own classes, so the two share their geometry: the Home and Overview
 * tabs where they will sit, the title and its summary line, the grouping
 * control, then the week view as one framed block with its lane names down
 * the left and the week below it.
 *
 * Honesty contract: only structure the page always renders is reserved. How
 * many lanes and tasks settle is not known yet, so the frame holds three
 * lane names and no tasks. No fake items, no fake counts, no shimmer.
 *
 * Server component, zero JS of its own, no animation: static blocks satisfy
 * reduced motion without a media query. ArrivalSettle gives the page that
 * replaces this one whole-surface settle rather than a hard cut, the same
 * hand-off Home uses.
 */
function Bar({ width, height = 12 }: { width: number | string; height?: number }) {
  return <span className={styles.skeletonBar} style={{ width, height }} />;
}

export default function BriefLoading() {
  return (
    <>
      <ArrivalSettle />
      <div className={`${styles.page} thin-scroll`}>
        <div className={styles.inner} role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Reading your Overview.</span>
          <div aria-hidden="true">
            <div className={styles.tabsRow}>
              <Bar width={152} height={32} />
            </div>
            <div className={styles.skeletonStack}>
              <div className={styles.skeletonLine}>
                <Bar width={112} height={24} />
                <Bar width={196} height={30} />
              </div>
              <Bar width="min(420px, 80%)" height={12} />
              <Bar width={212} height={30} />
            </div>

            <div className={styles.skeletonStage}>
              <div className={styles.skeletonHeads}>
                {[96, 128, 104].map((width) => (
                  <div key={width} className={styles.skeletonHead}>
                    <Bar width={width} height={12} />
                    <Bar width={56} height={10} />
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.skeletonTray}>
              <div className={styles.skeletonStack}>
                <Bar width={104} height={10} />
                <Bar width={128} height={18} />
                <Bar width={152} height={11} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
