import "server-only";

import { isDemoMode } from "@/lib/access-mode";
import { getOrCreatePreferences } from "../../../lib/signal-preferences";
import { SignalCadenceForm } from "./signal-cadence-form";

/**
 * Notifications page — ported from
 * signal/src/app/app/settings/notifications/page.tsx.
 *
 * S3: SendTestButton and sendTestBriefingAction are NOT ported.
 * S1: revalidatePath targets /app/brief/settings/notifications (in cadence-actions).
 * Demo: synthetic prefs so the surface renders without a session.
 */
export async function SignalNotificationsPage() {
  // Demo/Review: synthetic prefs so the surface renders without a real session.
  const prefs = isDemoMode()
    ? { email: "you@theorchard.example", cadence: "daily" as const }
    : await getOrCreatePreferences();

  return (
    <main className="mx-auto w-full max-w-[640px] px-6 py-16">
      <p
        className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--ink-quiet)" }}
      >
        Settings · Notifications
      </p>
      <h1
        className="mb-3 text-[32px] font-semibold leading-[1.15]"
        style={{ color: "var(--ink)" }}
      >
        How often should the briefing land?
      </h1>
      <p
        className="mb-8 text-[15px] leading-[1.6]"
        style={{ color: "var(--ink-soft)" }}
      >
        Signal sends a short morning briefing to{" "}
        <span style={{ color: "var(--ink)" }}>{prefs.email}</span>. You can
        change this any time. The briefing is always one short read, never a
        feed, never a dashboard. If a day has no real signal, no email is sent.
      </p>

      <SignalCadenceForm initial={prefs.cadence as "daily" | "weekly" | "off"} />

      {/* S3: SendTestButton intentionally omitted */}

      <div
        className="mt-12 rounded-xl border p-5"
        style={{
          borderColor: "var(--line-soft, rgba(20,21,26,0.10))",
          background: "var(--bg-sunken, rgba(20,21,26,0.02))",
        }}
      >
        <p
          className="text-[12.5px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--ink-quiet)" }}
        >
          Our promise
        </p>
        <p
          className="mt-2 text-[14px] leading-[1.6]"
          style={{ color: "var(--ink-soft)" }}
        >
          Every email has a one-click off button in the footer, and a native
          unsubscribe link in the email header (Gmail and Apple Mail surface
          this at the top of the message). We never send anything else from
          this address, no announcements, no upsells. Just the briefing.
        </p>
      </div>
    </main>
  );
}
