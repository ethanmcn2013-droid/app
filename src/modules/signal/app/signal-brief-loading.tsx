import { ArrivalSettle } from "@/components/system/arrival-settle";
import styles from "../components/overview/overview.module.css";

/**
 * /app/home/briefing loading boundary: a tracing of the Overview.
 *
 * Loading canon (pitch 10): once chrome exists, loading stays inside the
 * content region, with no full-screen takeover. It is drawn from the settled
 * page's own classes (column, header, progress band, cards, grid), so the
 * two share their geometry and cannot quietly drift apart.
 *
 * Honesty contract: only structure the page always renders is reserved. The
 * header, the progress band and one card per column are certain; how many
 * signals settle is not, so the attention card reserves a single row and
 * grows by whole rows, which is the right direction to be wrong in. No fake
 * items, no fake counts, no shimmer.
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
        <div
          className={styles.inner}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="sr-only">Reading your Overview.</span>
          <div aria-hidden="true">
            <div className={styles.header}>
              <div className={styles.skeletonStack}>
                <Bar width={168} height={10} />
                <Bar width={132} height={24} />
                <Bar width={340} height={11} />
              </div>
            </div>

            <div className={styles.progress}>
              <div className={styles.progressLead}>
                <div className={styles.skeletonStack}>
                  <Bar width={64} height={10} />
                  <Bar width={72} height={26} />
                  <Bar width={104} height={10} />
                </div>
              </div>
              <div className={styles.progressBody}>
                <Bar width="100%" height={10} />
                <Bar width="52%" height={10} />
              </div>
            </div>

            <div className={styles.grid}>
              <div className={styles.column}>
                <div className={styles.card}>
                  <div className={styles.cardHead}>
                    <Bar width={128} height={12} />
                  </div>
                  <div className={styles.skeletonRow}>
                    <Bar width={72} height={20} />
                    <Bar width="58%" height={15} />
                    <Bar width="72%" height={12} />
                    <Bar width="40%" height={10} />
                  </div>
                </div>
              </div>
              <div className={styles.column}>
                <div className={styles.card}>
                  <div className={styles.cardHead}>
                    <Bar width={96} height={12} />
                  </div>
                  <div className={styles.skeletonRow}>
                    <Bar width={88} height={26} />
                    <Bar width="60%" height={11} />
                    <Bar width="100%" height={4} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
