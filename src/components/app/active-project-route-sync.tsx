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
 * The epoch is what makes the refusal work. Route key alone is not enough: in
 * A1 → B → A2 a late A1 payload's route key matches the final A URL exactly,
 * so a key-only guard would commit A1's stale name, capabilities and counts
 * over A2's. See `src/lib/projects/route-snapshot.ts` for the rule and its
 * tests.
 *
 * `epoch` is accepted as a prop so a caller that knows when its transition
 * began can say so. When it is omitted, the epoch live at this payload's first
 * render is used — captured in a lazy `useState` initializer, so a re-render
 * cannot quietly re-stamp a payload as newer than it is.
 */

import { useEffect, useState } from "react";
import type { ProjectSummary } from "@/lib/projects/project-ref";
import { routeKey } from "@/lib/projects/route-snapshot";
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
  const liveEpoch = context?.live.epoch ?? 0;

  // Lazy initializer: evaluated once per mounted payload, never on re-render,
  // so a later render cannot quietly re-stamp this payload as newer than it is.
  const [capturedEpoch] = useState<number>(() => epoch ?? liveEpoch);

  const publishSnapshot = context?.publishSnapshot;
  const key = routeKey(pathname, project.id);
  const stampedEpoch = epoch ?? capturedEpoch;

  useEffect(() => {
    if (!publishSnapshot) return;
    publishSnapshot({ routeKey: key, epoch: stampedEpoch, project });
  }, [publishSnapshot, key, stampedEpoch, project]);

  return null;
}
