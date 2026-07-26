/**
 * D6 two-gate revalidation path contracts for the Timeline module (BV-4).
 *
 * Ported from src/server/actions/revalidation-contracts.ts on the timeline
 * source (origin/main @ e9f7a9a). The module version rewrites all
 * revalidated paths to the unified-app route prefix /app/timeline (T1, T7).
 *
 * Kept in a separate module (no "use server", no Next.js imports) so they
 * can be imported directly in the Node.js test runner without pulling in
 * next/cache, Clerk, or Turso.
 *
 * PARITY NOTE (manifest §revalidation contracts): publish/unpublish actions
 * still write publishedAt to the shared Timeline Turso DB. The public
 * deployment at timeline.signalstudio.ie reads that DB and has its own
 * ISR window (revalidate=300). The unified app CANNOT revalidate the public
 * deployment because they are separate Next.js apps. The public page picks
 * up the change within the ISR window (~5 min) instead of instantly.
 * Document in cutover runbook + Phase 9 checks.
 */

/**
 * The exact set of paths syncMilestonesAction revalidates.
 * All paths begin with /app/timeline, none are public /{workspaceSlug} paths.
 * Invariant: sync NEVER touches the public ISR cache (D6 two-gate).
 *
 * Unified-app rewrite: owner dashboard → /app/timeline and project curation
 * → /app/timeline/{slug}.
 */
export function syncRevalidationPaths(projectSlug: string): string[] {
  return ["/app/timeline", `/app/timeline/${projectSlug}`];
}

/**
 * The exact set of paths publishWorkspaceAction revalidates in the unified app.
 *
 * Unified-app rewrite: the public /{workspaceSlug} path is intentionally
 * EXCLUDED here because the unified app cannot revalidate the public Timeline
 * deployment (different app). Only the authenticated /app/timeline path is
 * revalidated.
 * The public page picks up the publishedAt DB write within its ISR window.
 *
 * See PARITY NOTE above.
 */
export function publishRevalidationPaths(_workspaceSlug: string): string[] {
  return ["/app/timeline"];
}
