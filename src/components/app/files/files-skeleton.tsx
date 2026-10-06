import styles from "./files.module.css";

/*
 * In its own file so the loading boundary does not pull the page's client
 * code (the search and the preview) into a second bundle.
 */

/** The wait, traced: header, search box, chips, rows and the docked preview. */
export function FilesSkeleton() {
  const bar = (width: string, height = 12) => (
    <span className={styles.skel} style={{ width, height, maxWidth: "100%" }} aria-hidden="true" />
  );
  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner} role="status" aria-label="Opening Files">
        <div className={styles.head}>
          <div className={styles.headText} style={{ display: "grid", gap: 10 }}>
            {bar("10ch", 24)}
            {bar("30ch")}
          </div>
        </div>
        <div className={styles.dockTop}>
          <span className={`${styles.field} ${styles.skelField}`} aria-hidden="true" />
          <div className={styles.narrow} aria-hidden="true">
            {[132, 118, 92, 96].map((width) => (
              <span key={width} className={styles.skel} style={{ width, height: 30, borderRadius: 8 }} />
            ))}
          </div>
        </div>
        <div className={styles.split}>
          <div className={styles.results} aria-hidden="true">
            <div className={styles.resHead}>{bar("16ch")}</div>
            {[0, 1, 2, 3, 4, 5].map((key) => (
              <div key={key} className={styles.skelRow}>
                <span className={styles.skel} style={{ width: 34, height: 34, borderRadius: 9 }} />
                <span style={{ display: "grid", gap: 7, flex: 1 }}>
                  {bar(`${46 - key * 4}%`, 13)}
                  {bar(`${30 + (key % 3) * 6}%`, 10)}
                </span>
              </div>
            ))}
          </div>
          <div className={`${styles.dock} ${styles.skelDock}`} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
