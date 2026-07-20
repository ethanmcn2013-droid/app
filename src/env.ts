import "server-only";
import { isDemoMode } from "@/lib/access-mode";

/**
 * Boot-time environment validation for Signal Tasks.
 *
 * Same pattern as the rest of the suite: enforce the vars the app cannot
 * run without in REAL production (skip demo/review/dev), throwing an
 * aggregated error at boot rather than letting a missing secret surface as
 * a runtime 500 deep in a request. Dependency-free; called once from
 * instrumentation.ts `register()`.
 */

// Tasks is fully auth-gated, it cannot serve anyone without these.
const REQUIRED_IN_PRODUCTION: ReadonlyArray<readonly [string, string]> = [
  ["TASKS_DATABASE_URL", "tasks database"],
  ["TASKS_AUTH_TOKEN", "tasks database auth token"],
  ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "Clerk auth (browser key)"],
  ["CLERK_SECRET_KEY", "Clerk auth (server key)"],
];

// Billing / cron / email break without these, but the app still boots.
const RECOMMENDED_IN_PRODUCTION: ReadonlyArray<readonly [string, string]> = [
  ["STRIPE_SECRET_KEY", "Stripe checkout / Venue Edition billing"],
  ["STRIPE_WEBHOOK_SECRET", "Stripe webhook signature verification"],
  ["CRON_SECRET", "cron endpoint authentication"],
  ["RESEND_API_KEY", "transactional email"],
  // Notes module (D4 — WARN tier; promoted to required at Phase 8).
  // Without these the /app/notes DB calls will throw at runtime but the
  // rest of the app remains unaffected (module-isolated lazy DB init).
  ["NOTES_DATABASE_URL", "Notes module database (notes.signalstudio.ie Turso)"],
  ["NOTES_AUTH_TOKEN", "Notes module database auth token"],
];

let validated = false;

export function validateEnv(): void {
  if (validated) return;
  validated = true;

  const isProd = process.env.NODE_ENV === "production";
  if (!isProd || isDemoMode()) return; // dev / demo / review: nothing to enforce

  const missingRecommended = RECOMMENDED_IN_PRODUCTION.filter(
    ([key]) => !process.env[key],
  );
  if (missingRecommended.length > 0) {
    console.warn(
      "[env] missing recommended production variables (features degraded):\n" +
        missingRecommended.map(([k, why]) => `  - ${k}, ${why}`).join("\n"),
    );
  }

  const missingRequired = REQUIRED_IN_PRODUCTION.filter(
    ([key]) => !process.env[key],
  );
  if (missingRequired.length > 0) {
    const detail = missingRequired
      .map(([k, why]) => `  - ${k}, ${why}`)
      .join("\n");
    throw new Error(
      `[env] FATAL: missing required production environment variables:\n${detail}\n\n` +
        "Set them in the Vercel project (or run in demo/review mode). Refusing to " +
        "boot a half-configured production environment, this would otherwise 500 " +
        "every authenticated request at runtime instead of failing here, visibly.",
    );
  }
}
