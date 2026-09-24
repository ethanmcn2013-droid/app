/**
 * /app/analytics loading boundary. The shell is already on screen, so the
 * wait stays in the content column as a tracing of the settled page: header,
 * the five numbers, the weekly chart and its neighbour. No shimmer and no
 * invented figures; static blocks satisfy reduced motion without a query.
 */
import { ArrivalSettle } from "@/components/system/arrival-settle";
import styles from "@/components/app/analytics/analytics.module.css";

function Bar({ width, height = 12 }: { width: string; height?: number }) {
  return <span className={styles.skel} style={{ width, height }} aria-hidden="true" />;
}

export default function AnalyticsLoading() {
  return (
    <>
      <ArrivalSettle />
      <div className={`${styles.page} thin-scroll`}>
        <div className={styles.inner} role="status" aria-label="Opening Analytics">
          <div className={styles.header} style={{ alignItems: "flex-start", display: "grid", gap: 8 }}>
            <Bar width="12ch" height={10} />
            <Bar width="9ch" height={24} />
            <Bar width="38ch" height={12} />
          </div>
          <div className={styles.kpis}>
            {[0, 1, 2, 3, 4].map((key) => (
              <div key={key} className={`${styles.kpi} ${styles.skelCard}`}>
                <Bar width="60%" height={11} />
                <Bar width="36%" height={24} />
                <Bar width="72%" height={10} />
              </div>
            ))}
          </div>
          <div className={styles.rowMain}>
            <div className={styles.skelCard} style={{ minHeight: 340 }} />
            <div className={styles.skelCard} style={{ minHeight: 340 }} />
          </div>
        </div>
      </div>
    </>
  );
}
