/**
 * Pure auth-policy predicate for the Notes module — no server-only import so
 * the fail-closed invariant is unit-testable outside the Next server context.
 *
 * Fail-closed ON ITS OWN: the keyless-dev fallback additionally requires
 * NODE_ENV !== "production", because an explicit SIGNAL_ACCESS_MODE=development
 * is NOT downgraded by access-mode's production-deployment check (only
 * demo/review are). Without the NODE_ENV term, a production deploy carrying
 * that env var with Clerk unset would mint the dev identity and depend
 * entirely on the proxy's 503 backstop. (Phase 4 Opus review M1.)
 */
export function devFallbackEligible(env: {
  nodeEnv: string | undefined;
  clerkConfigured: boolean;
  accessMode: string;
}): boolean {
  return (
    env.nodeEnv !== "production" &&
    !env.clerkConfigured &&
    env.accessMode === "development"
  );
}
