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
import type { ProjectSummary } from "@/lib/projects/project-ref";
import { routeKey, stampSnapshotEpoch } from "@/lib/projects/route-snapshot";
import { useActiveProject } from "@/components/app/active-project-provider";

export function ActiveProjectRouteSync({
  pathname,
  project,
  epoch,
}: {
  /** Normalized pathname the server resolved this Project for. */
  pathname: string;
  /** The Project the server verified. Never an unverified client guess. */
  project: ProjectSummary;
  epoch?: number;
}) {
  const context = useActiveProject();
  const publishSnapshot = context?.publishSnapshot;
  const live = context?.live;

  const key = routeKey(pathname, project.id);
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
