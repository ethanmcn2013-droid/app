import "server-only";

import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { isDemoMode } from "@/lib/access-mode";
import { dataSource } from "../../lib/data/source";
import { getAnalyticsUser } from "../../server/onboarding/signal-onboarding-queries";
import { requireSignalUser } from "../../server/signal-auth";
import { SignalOnboardingPicker } from "./signal-onboarding-picker";
import { REVIEW_SUITE_FIXTURE } from "@/lib/review-suite-fixture";

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
    // Demo mode: serve mock workspace, no auth, no DB.
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
      redirect("/app/signal");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[960px] px-6 py-8 sm:px-8">
      <div className="max-w-[600px]">
        <p
          className="mb-[14px] text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--ink-soft)" }}
        >
          Onboarding
        </p>
        <h1
          className="mb-3 text-[36px] font-semibold leading-[1.06] tracking-[-0.035em] text-balance"
          style={{ color: "var(--ink)" }}
        >
          {candidates.length === 0
            ? "No workspace found."
            : candidates.length === 1
              ? "Signal found your workspace."
              : "Pick the workspace Signal should read."}
        </h1>
        <p
          className="mb-8 max-w-[510px] text-[15px] leading-[1.6]"
          style={{ color: "var(--ink-soft)" }}
        >
          {candidates.length === 0
            ? "Signal reads from a Tasks workspace. Create one in Tasks, or ask to be added to one, then come back."
            : "Signal reads this workspace when you open the briefing. You can change it later."}
        </p>

        {candidates.length === 0 ? (
          <div
            className="rounded-lg border p-6"
            style={{
              borderColor: "var(--hairline)",
              background: "var(--paper)",
            }}
          >
            {/* S5: TASKS_URL rewritten to in-app /app/tasks.
                No component-level ring on either anchor: the suite's global
                :focus-visible outline is the only focus mark. */}
            <a
              href="/app/tasks"
              className="inline-flex min-h-[44px] items-center text-[13px] font-medium no-underline transition-[color] hover:text-[color:var(--ink)]"
              style={{ color: "var(--ink)" }}
            >
              Open Tasks <span aria-hidden>&nbsp;→</span>
            </a>
            <p
              className="mt-2 max-w-[510px] text-[15px] leading-[1.6]"
              style={{ color: "var(--ink-quiet)" }}
            >
              Once you have a workspace,{" "}
              <a
                href="/app/signal/onboarding"
                className="underline underline-offset-2"
                style={{ color: "var(--ink-soft)" }}
              >
                come back to this tab and try again
              </a>
              .
            </p>
          </div>
        ) : (
          <SignalOnboardingPicker candidates={candidates} />
        )}
      </div>
    </div>
  );
}
