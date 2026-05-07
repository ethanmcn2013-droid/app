import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import {
  getEffectiveTier,
  tierMeetsMinimum,
} from "@/server/db/entitlements";
import type { EntitlementTier } from "@/lib/data";
import Link from "next/link";

/**
 * Server-side gate. Renders `children` when the current user's tier
 * in the active workspace meets or exceeds `minimum`; otherwise
 * renders an inline upgrade prompt.
 *
 * Use sparingly — most Pro features should be feature-flag-shaped at
 * the route level, not section level. This is for surface-area gates
 * (a button, a card) inside an otherwise-free view.
 */
export async function RequireTier({
  minimum,
  children,
  fallbackTitle = "Upgrade to use this",
  fallbackBody = "This is part of a paid tier — but the basics that make Tasks useful work without paying.",
}: {
  minimum: EntitlementTier;
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackBody?: string;
}) {
  const [user, ws] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspace(),
  ]);
  const tier = await getEffectiveTier(user, ws);
  if (tierMeetsMinimum(tier, minimum)) return <>{children}</>;

  return (
    <div className="rounded-xl border border-brand/20 bg-brand-soft/30 px-4 py-3 text-[12.5px] text-ink-soft">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand">
        {minimum.toUpperCase()} only
      </div>
      <div className="mt-1 font-medium text-ink">{fallbackTitle}</div>
      <p className="mt-1 leading-[1.5]">{fallbackBody}</p>
      <Link
        href="/pricing"
        className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-brand transition-opacity hover:opacity-80"
      >
        See pricing
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
