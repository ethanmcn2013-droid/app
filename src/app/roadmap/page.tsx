import type { Metadata } from "next";
import { syncAndRead } from "@/server/roadmap/sync";
import {
  seedLaunchReadinessIfMissing,
  readBlockers,
  readActionItems,
} from "@/server/roadmap/launch-readiness-seed";
import { RoadmapView } from "./roadmap-view";

/**
 * `/roadmap` — interactive 8-week GTM tracker plus blockers strip
 * and the launch-readiness action-items checklist. Reads canonical
 * plan markdown at `~/Projects/tasks/docs/gtm-plan.md` on every
 * request, reconciles new/changed items against the `roadmap_items`
 * table, then seeds the blockers + action_items tables (idempotent),
 * then renders the synced state. Toggling a row writes back via the
 * server action; new rows in the markdown surface on the next page
 * load without losing prior status.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "GTM Roadmap · Tasks",
  description:
    "8-week go-to-market roadmap. 2026-05-11 → 2026-07-05. Two launch beats: Show HN, Product Hunt.",
};

export default async function RoadmapPage() {
  const items = await syncAndRead();
  await seedLaunchReadinessIfMissing();
  const [blockerRows, actionRows] = await Promise.all([
    readBlockers(),
    readActionItems(),
  ]);
  return (
    <RoadmapView
      initialItems={items}
      initialBlockers={blockerRows}
      initialActionItems={actionRows}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
