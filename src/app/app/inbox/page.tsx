import {
  getNotificationsForUser,
  getTasks,
} from "@/server/db/queries";
import { compileDailyDigest } from "@/server/db/daily-digest";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import { InboxApp } from "@/components/app/inbox/inbox-app";
import { AppPageHeader } from "@/components/app/page-header";
import { generateNudges } from "@/lib/nudges/generate-nudges";
import { aiConfigured } from "@/server/ai";
import { getWeeklySnapshotAction } from "@/server/actions/ai";
import { getOverdueTodayCount } from "@/server/actions/roll-forward";
import { db } from "@/server/db";
import { workspaces } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [me, ws] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspace(),
  ]);
  // Server-fetch in parallel: notifications + digest + the task list
  // we need to compute rules-based nudges from. All three scoped to
  // the current workspace.
  const [notifications, digest, tasks, weeklySnapshot, wsMeta, overdueCount] =
    await Promise.all([
      getNotificationsForUser(me, ws),
      compileDailyDigest(me, ws),
      getTasks(ws),
      getWeeklySnapshotAction(ws),
      // Lightweight name + slug lookup for the Slack-ready summary
      // headline + the trailing `tasks.app/p/{slug}` link. One row;
      // cheap enough to live alongside the other parallel reads.
      db
        .select({ name: workspaces.name, slug: workspaces.slug })
        .from(workspaces)
        .where(eq(workspaces.id, ws))
        .then((rows) => rows[0] ?? null),
      // Pre-flight count for the roll-forward affordance — server-side
      // so the button's render decision doesn't hinge on a client-side
      // filter pass.
      getOverdueTodayCount(),
    ]);
  const nudges = generateNudges(tasks, me);
  return (
    <>
      <AppPageHeader />
      <InboxApp
        notifications={notifications}
        digest={digest}
        nudges={nudges}
        weeklySnapshot={weeklySnapshot}
        weeklyEnabled={aiConfigured()}
        workspaceId={ws}
        workspaceName={wsMeta?.name}
        workspaceSlug={wsMeta?.slug}
        overdueCount={overdueCount}
      />
    </>
  );
}
