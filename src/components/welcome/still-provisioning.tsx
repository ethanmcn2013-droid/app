"use client";

import { useEffect } from "react";

/**
 * Auto-refreshing interstitial shown when a freshly-signed-up user
 * reaches a state-mutating page before the Clerk webhook has hydrated
 * their `users` + `workspaces` rows. Refresh gives the webhook a
 * second chance; if it still hasn't landed after several refreshes,
 * the user will need to refresh manually. ensure-user.ts's fallback
 * provisioning should make this state extremely rare.
 */
export function StillProvisioning() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.reload();
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="max-w-[420px] text-center">
        <div className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-quiet">
          One moment
        </div>
        <h1 className="mb-3 text-[24px] font-semibold leading-tight tracking-[-0.01em] text-ink">
          Setting up your account.
        </h1>
        <p className="text-[15px] leading-[1.55] text-ink-soft">
          This page will refresh in a moment.
        </p>
      </div>
    </div>
  );
}
