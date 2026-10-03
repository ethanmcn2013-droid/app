/**
 * Loading boundary for /app/timeline/[projectSlug] (v3, round 2): the plan
 * skeleton, on the plan's own geometry: the tabs, the Project line, the
 * plan's name, the key date and status lines, the runway with its axis and
 * five ghost diamonds, six milestone rows, and the side column. Server
 * Component, zero client JS; only the status line is announced and the
 * skeleton is hidden from assistive tech.
 */
import styles from "../../_components/timeline-loading.module.css";

const DIAMONDS = ["22%", "31%", "48%", "63%", "88%"];

export default function PlanLoading() {
  return (
    <div data-timeline-module className={styles.page}>
      <p className="sr-only" role="status" aria-live="polite">
        Loading the timeline.
      </p>
      <div aria-hidden className={styles.column}>
        <span className={styles.bone} style={{ width: 300, height: 38, borderRadius: 11 }} />
        <div className={styles.row} style={{ marginTop: 18, alignItems: "flex-start" }}>
          <div className={styles.stack}>
            <span className={styles.bone} style={{ width: 170, height: 16 }} />
            <span className={styles.bone} style={{ width: 240, height: 34 }} />
            <span className={styles.bone} style={{ width: 280, height: 16 }} />
          </div>
          <span className={styles.bone} style={{ width: 170, height: 34 }} />
        </div>
        <span className={styles.bone} style={{ width: 420, maxWidth: "100%", height: 16, marginTop: 16 }} />
        <div className={styles.runway}>
          <div className={styles.runwayAxis} />
          <div className={styles.runwayLine}>
            {DIAMONDS.map((left) => (
              <span key={left} className={styles.ghostDiamond} style={{ left }} />
            ))}
          </div>
          <div className={styles.runwayFoot}>
            <span className={styles.bone} style={{ width: 150, height: 12 }} />
            <span className={styles.bone} style={{ width: 260, height: 12 }} />
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.card}>
            <div className={styles.listRow} style={{ borderTop: 0, height: 56 }}>
              <span className={styles.bone} style={{ width: 110, height: 15 }} />
            </div>
            {[62, 48, 70, 40, 56, 44].map((width, i) => (
              <div key={i} className={styles.listRow}>
                <span className={styles.bone} style={{ width: 10, height: 10, transform: "rotate(45deg)" }} />
                <span className={styles.bone} style={{ width: `${width}%`, height: 13 }} />
              </div>
            ))}
          </div>
          <div className={styles.stack} style={{ gap: 16 }}>
            <span className={styles.bone} style={{ width: "100%", height: 132, borderRadius: 12 }} />
            <span className={styles.bone} style={{ width: "100%", height: 480, borderRadius: 12 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
