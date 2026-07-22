import "server-only";

import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { isDemoMode } from "@/lib/access-mode";
import { dataSource } from "../../lib/data/source";
import { isOnboarded } from "../../server/onboarding/signal-onboarding-queries";
import { requireSignalUser } from "../../server/signal-auth";
import { SignalOnboardingPicker } from "./signal-onboarding-picker";

/**
 * Onboarding page — ported from signal/src/app/app/onboarding/page.tsx.
 *
 * S1: self-referential "come back" href updated to /app/brief/onboarding.
 *     Redirect after onboarding goes to /app/brief (via completeOnboarding).
 * S5: TASKS_URL external link → /app/board (in-app board, internal path).
 * S3: no SendTestButton.
 * Demo: isDemoMode() bypasses auth + DB, serves mock candidates.
 */
export async function SignalOnboardingPage() {
  const demo = isDemoMode();

  let candidates;

  if (demo) {
    // Demo mode: serve mock workspace, no auth, no DB.
    candidates = [{ workspaceId: "ws_demo", name: "Demo workspace", role: "owner" as const }];
  } else {
    const userId = await requireSignalUser();
    if (!userId) redirect("/sign-in");

    if (await isOnboarded(userId)) {
      redirect("/app/brief");
    }

    const me = await currentUser();
    const email = me?.primaryEmailAddress?.emailAddress ?? null;

    candidates = await dataSource.listForUser({ clerkId: userId, email });
  }

  return (
    <div
      className="mx-auto w-full max-w-[560px] px-6"
      style={{ paddingTop: 64, paddingBottom: 96 }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono-stack)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ink-quiet)",
          marginBottom: 14,
        }}
      >
        Onboarding
      </div>
      <h1
        style={{
          fontSize: "clamp(28px, 4vw, 36px)",
          letterSpacing: "-0.035em",
          lineHeight: 1.08,
          fontWeight: 600,
          color: "var(--ink)",
          marginBottom: 12,
        }}
      >
        {candidates.length === 0
          ? "We couldn't find a workspace."
          : candidates.length === 1
            ? "We found your workspace."
            : "Pick the workspace to brief."}
      </h1>
      <p
        style={{
          fontSize: 17,
          lineHeight: 1.55,
          color: "var(--ink-soft)",
          marginBottom: 32,
        }}
      >
        {candidates.length === 0
          ? "Your briefing reads from a Signal Tasks workspace. Sign up at Tasks or get added to one, then come back."
          : "Your briefing reads from this workspace each morning. You can change it later."}
      </p>

      {candidates.length === 0 ? (
        <div
          style={{
            padding: 20,
            borderRadius: "var(--r-3)",
            border: "1px solid var(--border-soft)",
            background: "var(--bg-elev)",
          }}
        >
          {/* S5: TASKS_URL rewritten to in-app /app/board */}
          <a
            href="/app/board"
            style={{
              fontSize: 14,
              color: "var(--brand)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Open Signal Tasks ↗
          </a>
          <p
            style={{
              marginTop: 10,
              fontSize: 13,
              color: "var(--ink-quiet)",
              lineHeight: 1.55,
            }}
          >
            Once you have a workspace,{" "}
            <a
              href="/app/brief/onboarding"
              style={{ color: "var(--ink-soft)", textDecoration: "underline" }}
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
  );
}
