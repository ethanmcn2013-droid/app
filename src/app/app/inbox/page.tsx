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
import { buildWeeklySnapshotFor } from "@/server/digest-narration";
import { getOverdueTodayCount } from "@/server/actions/roll-forward";
import { db } from "@/server/db";
import { users, workspaces } from "@/server/db/schema";
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
  const [notifications, digest, tasks, weeklySnapshot, wsMeta, overdueCount, userRow] =
    await Promise.all([
      getNotificationsForUser(me, ws),
      compileDailyDigest(me, ws),
      getTasks(ws),
      buildWeeklySnapshotFor(ws),
      // Lightweight name + slug lookup for the Slack-ready summary
      // headline + the trailing `tasks.signalstudio.ie/p/{slug}` link. One row;
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
      // C1: resolve the real user's display name from DB so the inbox
      // greeting uses the actual name rather than the USERS Proxy
      // fallback ("Someone") for Clerk-issued ids.
      db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, me))
        .then((rows) => rows[0] ?? null),
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
        userName={userRow?.name ?? undefined}
      />
    </>
  );
}
