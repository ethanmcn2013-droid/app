/**
 * /app/home loading boundary. Chrome exists, so loading stays in the content
 * region as a tracing of the settled page: the greeting, the launch tile and
 * done this week side by side, four start cards, and the activity strip. No
 * fake figures, no full-screen takeover. The soft breathing is switched off
 * under reduced motion in the stylesheet.
 *
 * ArrivalSettle rides beside the tracing and gives the page that replaces it
 * one whole-surface opacity settle rather than a cut.
 */
import { ArrivalSettle } from "@/components/system/arrival-settle";
import styles from "@/components/app/home/bento/home-bento.module.css";

function Bone({ width, height = 12 }: { width: string; height?: number }) {
  return <span aria-hidden className={styles.bone} style={{ width, height }} />;
}

export default function HomeLoading() {
  return (
    <>
      <ArrivalSettle />
      <div className={`${styles.page} thin-scroll`}>
        <div className={`${styles.inner} ${styles.loading}`} role="status" aria-label="Opening Home">
          <div className={styles.head} style={{ display: "grid", gap: 12 }}>
            <Bone width="260px" height={26} />
            <Bone width="150px" height={12} />
          </div>
          <div className={styles.bento}>
            <div className={`${styles.tile} ${styles.s7} ${styles.boneTile} ${styles.boneHero}`}>
              <Bone width="120px" />
              <Bone width="45%" height={20} />
              <Bone width="96px" height={64} />
            </div>
            <div className={`${styles.tile} ${styles.s5} ${styles.boneTile}`}>
              <Bone width="110px" />
              <Bone width="56px" height={44} />
              <Bone width="80%" />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`${styles.card} ${styles.boneTile}`} style={{ minHeight: 168, padding: 20, gap: 16 }}>
                <Bone width="40px" height={40} />
                <Bone width="48px" height={24} />
                <Bone width="70%" />
              </div>
            ))}
            <div className={`${styles.tile} ${styles.s12} ${styles.boneTile}`}>
              <Bone width="90px" />
              <Bone width="100%" height={120} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
