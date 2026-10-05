/**
 * Loading boundary for /app/timeline (v3, round 2): the All projects skeleton.
 *
 * The same geometry the page arrives with: the title and tabs, a sentence
 * bar at 60%, five chip placeholders, the toolbar, then the grid with a real
 * month axis (the months around today) and six rows with bars at plausible
 * offsets. Nothing moves when the page lands. Server Component, zero client
 * JS; the only announced content is the status line, and the skeleton is
 * decoration and says so.
 */
import { isDemoMode } from "@/lib/access-mode";
import { PINNED_REVIEW_CALENDAR_FRAME } from "@/lib/calendar-frame";
import { addMonths, SHORT_MONTHS, startOfMonth } from "@/lib/projects/project-portfolio-scale";
import styles from "./_components/timeline-loading.module.css";

const BARS = [
  { left: "6%", width: "54%" },
  { left: "0%", width: "62%" },
  { left: "14%", width: "40%" },
  { left: "2%", width: "70%" },
  { left: "20%", width: "30%" },
  { left: "9%", width: "48%" },
];

const CHIPS = [96, 84, 92, 104, 96];

export default function TimelineHomeLoading() {
  const todayIso = isDemoMode() ? PINNED_REVIEW_CALENDAR_FRAME.today : new Date().toISOString().slice(0, 10);
  const first = addMonths(startOfMonth(todayIso), -1);
  const months = Array.from({ length: 6 }, (_, i) => SHORT_MONTHS[Number(addMonths(first, i).slice(5, 7)) - 1]);
  const todayLeft = `${((1 + (Number(todayIso.slice(8, 10)) - 1) / 30) / 6) * 100}%`;

  return (
    <div data-timeline-module className={styles.page}>
      <p className="sr-only" role="status" aria-live="polite">
        Loading your projects.
      </p>
      <div aria-hidden className={styles.column}>
        <div className={styles.row}>
          <span className={styles.bone} style={{ width: 150, height: 32 }} />
          <span className={styles.bone} style={{ width: 300, height: 38, borderRadius: 11 }} />
        </div>
        <span className={styles.bone} style={{ width: "60%", maxWidth: 560, height: 18, marginTop: 16 }} />
        <div className={styles.chips}>
          {CHIPS.map((width, i) => (
            <span key={i} className={styles.bone} style={{ width, height: 34, borderRadius: 999 }} />
          ))}
        </div>
        <div className={styles.toolbar}>
          <span className={styles.bone} style={{ width: 118, height: 32 }} />
          <span className={styles.bone} style={{ width: 142, height: 32 }} />
          <span className={styles.toolbarGap} />
          <span className={styles.bone} style={{ width: 230, height: 32 }} />
          <span className={styles.bone} style={{ width: 64, height: 32 }} />
        </div>
      </div>
      <div aria-hidden className={styles.gridFrame}>
        <div className={styles.gridHead}>
          <div className={styles.gridLeft}>
            <span className={styles.bone} style={{ width: 56, height: 12 }} />
          </div>
          <div className={styles.axis}>
            {months.map((month, i) => (
              <span key={`${month}-${i}`}>{month}</span>
            ))}
          </div>
        </div>
        <div className={styles.gridBody}>
          <span className={styles.todayLine} style={{ left: `calc(var(--tl-left-w) + (100% - var(--tl-left-w)) * ${parseFloat(todayLeft) / 100})` }} />
          {BARS.map((bar, i) => (
            <div key={i} className={styles.gridRow}>
              <div className={styles.gridLeft}>
                <span className={styles.bone} style={{ width: 28, height: 28, borderRadius: 7 }} />
                <span className={styles.stack} style={{ gap: 6 }}>
                  <span className={styles.bone} style={{ width: 132 - i * 7, height: 13 }} />
                  <span className={styles.bone} style={{ width: 92, height: 11 }} />
                </span>
              </div>
              <div className={styles.gridCanvas}>
                <span className={`${styles.bone} ${styles.bar}`} style={bar} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
