"use client";

/**
 * Route sync — plan §3.4, "require each product page to render
 * `ActiveProjectRouteSync` with the verified summary and normalized route key".
 *
 * Every product page renders exactly one of these, inside its own route
 * boundary, with the Project its Server Component just resolved and
 * authorized. It renders nothing. Its whole job is to hand the persistent
 * layout a snapshot the layout could not have obtained for itself, and to let
 * the provider refuse that snapshot when it no longer describes the current
 * transition.
 *
 * This component holds **no state**. The epoch it stamps is derived on every
 * render by `stampSnapshotEpoch`, which is where the reasoning lives — read
 * the note there before changing anything here. In short: a mount-time capture
 * broke same-path A → B switches (Next does not remount a segment for a
 * search-param-only navigation) and raced cold entry (the initializer runs
 * during render, the bridge publishes from an effect). Deriving fixes both,
 * and makes the honest limit of a client-minted epoch explicit rather than
 * hidden behind a hand-supplied test fixture.
 *
 * `epoch` stays an accepted prop: a caller that genuinely knows when its
 * transition began gets the full route-key-and-epoch guard.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { parseProjectId, type ProjectSummary } from "@/lib/projects/project-ref";
import { routeKey, stampSnapshotEpoch } from "@/lib/projects/route-snapshot";
import { useActiveProject } from "@/components/app/active-project-provider";

export function ActiveProjectRouteSync({
  pathname,
  project,
  requestedProjectId,
  epoch,
}: {
  /**
   * Normalized pathname the server resolved this Project for.
   *
   * Optional, and omitting it is the ordinary case for a Server Component:
   * a server render cannot read the current URL (Next.js `use-pathname`
   * reference), so a caller inside a server tree has no honest value to pass.
   * The fallback is `usePathname()`, which is the SAME source the provider's
   * URL bridge publishes from — so the two agree by construction rather than
   * by a server string and a client string happening to match. Pass one only
   * when the caller genuinely knows a normalized path the hook would not
   * report.
   */
  pathname?: string;
  /** The Project the server verified. Never an unverified client guess. */
  project: ProjectSummary;
  /**
   * The `workspaceId` this route actually carried, exactly as the caller's
   * Server Component received it — `null` on a bare entry that named none.
   *
   * ── Why this, and not `project.id` ────────────────────────────────────────
   *
   * A route key identifies the ROUTE; the Project is the payload verified FOR
   * that route. The provider's URL bridge builds its key from
   * `searchParams.get(workspaceId)`, so a payload keyed by the resolved
   * Project's id only ever matched on routes whose URL already named that
   * Project. On a bare entry — every Tasks surface today, because only
   * `/app/project` and the print gate act on `canonicalRedirectTo` — the
   * bridge published `path::` while the payload published `path::<id>`, the
   * commit rule refused it as a route-key mismatch, and the chrome could never
   * leave `skeleton`. Keyed this way the two agree by construction on both
   * bare and explicit entry, and a genuinely stale payload is still refused,
   * which is what the guard is for.
   *
   * Passed from the server rather than read here on purpose: `useSearchParams`
   * client-renders the whole tree up to the nearest Suspense boundary, and the
   * provider quarantines it in a component with no output precisely so it
   * cannot do that to a product surface. `usePathname` carries no such cost.
   */
  requestedProjectId?: string | null;
  epoch?: number;
}) {
  const context = useActiveProject();
  const publishSnapshot = context?.publishSnapshot;
  const live = context?.live;
  const livePathname = usePathname() ?? "";

  const key = routeKey(
    pathname ?? livePathname,
    parseProjectId(requestedProjectId ?? null),
  );
  const stampedEpoch = stampSnapshotEpoch({
    suppliedEpoch: epoch,
    payloadRouteKey: key,
    live: live ?? { routeKey: "", epoch: 0 },
  });

  useEffect(() => {
    if (!publishSnapshot) return;
    // Re-runs whenever the live transition moves, which is what lets a payload
    // rendered before the bridge's first publish reach the provider at all.
    publishSnapshot({ routeKey: key, epoch: stampedEpoch, project });
  }, [publishSnapshot, key, stampedEpoch, project]);

  return null;
}
