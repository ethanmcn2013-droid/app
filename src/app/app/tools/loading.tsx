import styles from "@/components/shell/launcher/launcher.module.css";

/** /app/tools loading: the directory's own shape, so nothing jumps on arrival. */
export default function ToolsLoading() {
  return (
    <div className={styles.page} aria-busy="true">
      <div className={styles.pageInner}>
        <p className={styles.srOnly} role="status">
          Loading apps and tools
        </p>
        <div className={styles.pageHeader}>
          <div className={styles.pageHeading}>
            <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
            <div className={`${styles.skeleton} ${styles.skeletonLede}`} />
          </div>
          <div className={`${styles.skeleton} ${styles.skeletonSearch}`} />
        </div>
        {/* "Your apps" first; the sections below it fill in on load. */}
        <div className={`${styles.skeleton} ${styles.skeletonHeading}`} />
        <div className={styles.appGrid}>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className={`${styles.skeleton} ${styles.skeletonApp}`} />
          ))}
        </div>
        <div className={`${styles.skeleton} ${styles.skeletonHeading}`} />
      </div>
    </div>
  );
}
