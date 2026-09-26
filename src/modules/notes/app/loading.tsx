/**
 * Notes loading: the notebook's own two-pane shape, so nothing jumps when
 * it arrives. The list head (title, capture bar, search, views and Filter),
 * the waiting banner and six rows on the left; the canvas on the right. A
 * server component with no script; the shimmer is still under reduced
 * motion. After a real wait one calm line is announced.
 */
import { LongWaitStatus } from "@/components/system/long-wait-status";
import styles from "./loading.module.css";

export default function NotesLoading() {
  return (
    <div className={styles.frame} aria-busy="true">
      <div className={styles.list} aria-hidden="true">
        <div className={styles.head}>
          <div className={`${styles.bar} ${styles.title}`} />
          <div className={`${styles.bar} ${styles.capture}`} />
          <div className={`${styles.bar} ${styles.search}`} />
          <div className={styles.viewRow}>
            <div className={`${styles.bar} ${styles.views}`} />
            <div className={`${styles.bar} ${styles.filter}`} />
          </div>
        </div>
        <div className={`${styles.bar} ${styles.banner}`} />
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={styles.row}>
            <div className={styles.rowText}>
              <div className={`${styles.bar} ${styles.rowTitle}`} />
              <div className={`${styles.bar} ${styles.rowPreview}`} />
            </div>
            <div className={`${styles.bar} ${styles.rowTime}`} />
          </div>
        ))}
      </div>
      <div className={styles.main} aria-hidden="true">
        <div className={styles.column}>
          <div className={`${styles.bar} ${styles.canvasTitle}`} />
          <div className={`${styles.bar} ${styles.canvas}`} />
          <div className={`${styles.bar} ${styles.line}`} />
        </div>
      </div>
      <div className={styles.wait}>
        <LongWaitStatus line="Opening the notebook" />
      </div>
    </div>
  );
}
