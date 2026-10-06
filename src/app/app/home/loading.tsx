/**
 * /app/home loading boundary. Loading canon (pitch 10): chrome exists, so
 * loading stays in the content region as a tracing of the settled page: the
 * Home and Overview tabs, the greeting and its count line, the task groups on the left, the next big day
 * and the Project list on the right. No fake items, no full-screen takeover.
 * The soft pulse is switched off under reduced motion in the stylesheet.
 *
 * Hand-off (wave 7): ArrivalSettle rides beside the tracing and gives the
 * page that replaces it one whole-surface opacity settle rather than a cut.
 * See src/components/system/arrival-settle.tsx.
 */
import { ArrivalSettle } from "@/components/system/arrival-settle";
import styles from "@/components/app/home/home.module.css";

function Bone({ width, height = 12 }: { width: string; height?: number }) {
  return <span aria-hidden className={styles.bone} style={{ width, height }} />;
}

function Group({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className={styles.section}>
      <div style={{ marginBottom: 12 }}>
        <Bone width={title} height={13} />
      </div>
      <div className={styles.list}>
        {rows.map((width, index) => (
          <div key={index} className={styles.boneRow}>
            <Bone width="16px" height={16} />
            <div className={styles.rowMain} style={{ gap: 8 }}>
              <Bone width={width} height={13} />
              <Bone width="22%" height={10} />
            </div>
            <Bone width="64px" height={11} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomeLoading() {
  return (
    <>
      <ArrivalSettle />
      <div className={`${styles.page} thin-scroll`}>
        <div className={`${styles.inner} ${styles.loading}`} role="status" aria-label="Opening Home">
          <div className={styles.tabsRow}>
            <Bone width="152px" height={32} />
          </div>
          <div className={styles.header}>
            <div className={styles.headerMain}>
              <div className={styles.titleRow} style={{ minHeight: 28 }}>
                <Bone width="220px" height={22} />
                <Bone width="132px" height={26} />
              </div>
              <div style={{ marginTop: 12 }}>
                <Bone width="min(420px, 80%)" height={12} />
              </div>
            </div>
          </div>
          <div className={styles.grid}>
            <div className={styles.col}>
              <Group title="56px" rows={["58%", "44%"]} />
              <Group title="92px" rows={["52%"]} />
              <Group title="168px" rows={["48%"]} />
            </div>
            <div className={styles.side}>
              <div className={styles.boneCard} />
              <div className={styles.section}>
                <div style={{ marginBottom: 12 }}>
                  <Bone width="72px" height={13} />
                </div>
                <div className={styles.list}>
                  {["62%", "48%", "56%"].map((width, index) => (
                    <div key={index} className={styles.boneRow} style={{ minHeight: 40 }}>
                      <Bone width="14px" height={14} />
                      <div className={styles.rowMain}>
                        <Bone width={width} height={12} />
                      </div>
                      <Bone width="44px" height={10} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
