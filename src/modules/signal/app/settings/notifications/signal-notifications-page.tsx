import "server-only";

import Link from "next/link";
import { ShellIcon } from "@/components/shell/shell-icons";
import styles from "../../../components/overview/overview.module.css";

/**
 * Signal's delivery provider is intentionally not active in the consolidated
 * app. Keep this route as a truthful description of the in-app read until
 * scheduled delivery has its own verified provider and release gate.
 *
 * Reached from the Overview's "How this was read" note, so it wears the
 * Overview's page grammar: same column, header and card.
 */
export function SignalNotificationsPage() {
  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={`${styles.inner} ${styles.rise}`}>
        <section aria-labelledby="signal-briefing-settings-title" className={styles.narrow}>
          <p className={styles.eyebrow}>
            <Link href="/app/home/briefing" className={styles.crumb}>
              Overview
            </Link>
            <span aria-hidden="true"> / </span>
            Briefing delivery
          </p>
          <h1 id="signal-briefing-settings-title" className={styles.title}>
            The briefing is ready when you open it.
          </h1>
          <p className={styles.lede}>
            Signal builds one short read from the work you can access each
            time you open the Overview. It surfaces at most three signals and
            stays quiet when nothing crosses Signal&rsquo;s attention rules.
          </p>

          <div className={styles.card}>
            <div className={styles.setting}>
              <span className={styles.settingIcon} aria-hidden="true">
                <ShellIcon.bell size={16} />
              </span>
              <div className={styles.settingText}>
                <p className={styles.settingLabel}>Current delivery</p>
                <p className={styles.settingValue}>In app only</p>
                <p className={styles.settingBody}>
                  No scheduled delivery service is active in this app. Open
                  the Overview whenever you want a current read of the
                  available work.
                </p>
              </div>
            </div>
            <div className={styles.cardFoot}>
              <Link href="/app/home/briefing" className={styles.button}>
                Open the Overview
                <ShellIcon.arrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
