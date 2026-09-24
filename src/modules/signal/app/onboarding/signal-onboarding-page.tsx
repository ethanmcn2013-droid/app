import "server-only";

import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { isDemoMode } from "@/lib/access-mode";
import { dataSource } from "../../lib/data/source";
import { getAnalyticsUser } from "../../server/onboarding/signal-onboarding-queries";
import { requireSignalUser } from "../../server/signal-auth";
import { SignalOnboardingPicker } from "./signal-onboarding-picker";
import { REVIEW_SUITE_FIXTURE } from "@/lib/review-suite-fixture";
import { ShellIcon } from "@/components/shell/shell-icons";
import styles from "../../components/overview/overview.module.css";

/**
 * Onboarding page — ported from signal/src/app/app/onboarding/page.tsx.
 *
 * S1: self-referential "come back" href updated to /app/brief/onboarding.
 *     Redirect after onboarding goes to /app/brief (via completeOnboarding).
 * S5: TASKS_URL external link → /app/tasks (in-app board, internal path).
 * S3: no SendTestButton.
 * Demo: isDemoMode() bypasses auth + DB, serves mock candidates.
 */
export async function SignalOnboardingPage() {
  const demo = isDemoMode();

  let candidates;

  if (demo) {
    // Demo mode: serve the mock Project, no auth, no DB.
    candidates = [{
      workspaceId: REVIEW_SUITE_FIXTURE.workspace.id,
      name: REVIEW_SUITE_FIXTURE.workspace.name,
      role: "owner" as const,
    }];
  } else {
    const userId = await requireSignalUser();
    if (!userId) redirect("/sign-in");

    const me = await currentUser();
    const email = me?.primaryEmailAddress?.emailAddress ?? null;

    candidates = await dataSource.listForUser({ clerkId: userId, email });
    const analyticsUser = await getAnalyticsUser(userId);
    const linkedWorkspaceStillExists = candidates.some(
      (candidate) =>
        candidate.workspaceId === analyticsUser?.linkedWorkspaceId,
    );
    if (linkedWorkspaceStillExists) {
      redirect("/app/home/briefing");
    }
  }

  const heading =
    candidates.length === 0
      ? "No project found yet."
      : candidates.length === 1
        ? "Signal found your project."
        : "Pick the project Signal should read.";

  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={`${styles.inner} ${styles.rise}`}>
        <div className={styles.narrow}>
          <p className={styles.eyebrow}>Set up the Overview</p>
          <h1 className={styles.title}>{heading}</h1>
          <p className={styles.lede}>
            {candidates.length === 0
              ? "Signal reads from a project in Tasks. Create one in Tasks, or ask to be added to one, then come back."
              : "Signal reads this project each time you open the Overview. You can change it later."}
          </p>

          {candidates.length === 0 ? (
            <div className={styles.card}>
              <div className={styles.setting}>
                <span className={styles.settingIcon} aria-hidden="true">
                  <ShellIcon.tasks size={16} />
                </span>
                <div className={styles.settingText}>
                  <p className={styles.settingValue}>Start in Tasks</p>
                  <p className={styles.settingBody}>
                    Once you have a project,{" "}
                    <a href="/app/home/briefing/onboarding" className={styles.readLink}>
                      come back to this page and try again
                    </a>
                    .
                  </p>
                </div>
              </div>
              <div className={styles.cardFoot}>
                {/* S5: TASKS_URL rewritten to in-app /app/tasks. */}
                <a href="/app/tasks" className={styles.button}>
                  Open Tasks
                  <ShellIcon.arrowRight size={14} />
                </a>
              </div>
            </div>
          ) : (
            <SignalOnboardingPicker candidates={candidates} />
          )}
        </div>
      </div>
    </div>
  );
}
