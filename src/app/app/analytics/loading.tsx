/**
 * /app/analytics loading boundary. The shell is already on screen, so the
 * wait stays in the content column as a tracing of the settled page: title
 * and summary, the two parts, the ask box and the grid of questions. No
 * shimmer and no invented figures; static blocks satisfy reduced motion
 * without a query.
 */
import { ArrivalSettle } from "@/components/system/arrival-settle";
import styles from "@/components/app/analytics/analytics.module.css";

function Bar({ width, height = 12 }: { width: string; height?: number }) {
  return <span className={styles.skel} style={{ width, height, maxWidth: "100%" }} aria-hidden="true" />;
}

export default function AnalyticsLoading() {
  return (
    <>
      <ArrivalSettle />
      <div className={`${styles.page} thin-scroll`}>
        <div className={styles.inner} role="status" aria-label="Opening Analytics">
          <div className={styles.head} style={{ display: "grid", gap: 10 }}>
            <Bar width="22ch" height={26} />
            <Bar width="38ch" height={12} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <Bar width="188px" height={36} />
          </div>
          <div className={styles.askBox} aria-hidden="true">
            <span className={`${styles.askField} ${styles.skelField}`} />
            <p className={styles.askHelp}>
              <Bar width="min(52ch, 100%)" height={12} />
            </p>
          </div>
          <div className={styles.starters} aria-hidden="true">
            {[0, 1, 2, 3].map((group) => (
              <div key={group} className={styles.need}>
                <Bar width="11ch" height={11} />
                <div className={styles.skelCard} style={{ minHeight: 148 }} />
                <div className={styles.skelCard} style={{ minHeight: 148 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
