import Link from "next/link";
import { ShellIcon } from "@/components/shell/shell-icons";
import styles from "./wedding.module.css";

/** The page frame every guest-list state shares, so nothing jumps on arrival. */
function Frame({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <p className={styles.eyebrow}>Wedding tools</p>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>Guest list</h1>
            </div>
            <p className={styles.summary}>
              <span>{summary}</span>
            </p>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export function WeddingUnavailable({ kind, projectName }: { kind: "no-project" | "not-wedding"; projectName?: string }) {
  if (kind === "no-project") {
    return (
      <Frame summary="Choose a wedding to see its guests.">
        <section className={styles.empty}>
          <h2 className={styles.emptyTitle}>No project open</h2>
          <p className={styles.emptyBody}>A guest list belongs to a wedding project. Open one from the sidebar, or see them all in Projects.</p>
          <div className={styles.emptyActions}>
            <Link href="/app/project" className={styles.btnPrimary}>See projects</Link>
          </div>
        </section>
      </Frame>
    );
  }
  return (
    <Frame summary={`${projectName ?? "This project"} isn’t set up as a wedding.`}>
      <section className={styles.empty}>
        <h2 className={styles.emptyTitle}>Wedding tools are for wedding projects</h2>
        <p className={styles.emptyBody}>
          The guest list appears on projects made for a wedding. Open a wedding from the sidebar, or start one from Projects.
        </p>
        <div className={styles.emptyActions}>
          <Link href="/app/project" className={styles.btnPrimary}>See projects</Link>
        </div>
      </section>
    </Frame>
  );
}

export function GuestListSkeleton() {
  return (
    <div className={`${styles.page} thin-scroll`} aria-busy="true" aria-label="Loading the guest list">
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <p className={styles.eyebrow}>Wedding tools</p>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>Guest list</h1>
            </div>
            <p className={styles.summary}>
              <span className={styles.skelLine} style={{ width: 220 }} />
            </p>
          </div>
        </header>
        <div className={styles.replies} aria-hidden="true">
          <div className={styles.replyBar} />
          <div className={styles.skelStats}>
            {[0, 1, 2, 3, 4].map((i) => <span key={i} className={styles.skelBlock} />)}
          </div>
        </div>
        <ol className={styles.households} aria-hidden="true">
          {[3, 2, 1].map((rows, i) => (
            <li key={i} className={styles.household}>
              <div className={styles.householdHead}>
                <span className={styles.skelLine} style={{ width: 160 }} />
              </div>
              {Array.from({ length: rows }, (_, r) => (
                <div key={r} className={styles.skelRow}>
                  <span className={styles.avatar} />
                  <span className={styles.skelLine} style={{ width: 140 }} />
                </div>
              ))}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
