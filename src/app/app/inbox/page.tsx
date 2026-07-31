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
import { isDemoMode } from "@/lib/access-mode";
import {
  DEMO_USER_ID,
  DEMO_WORKSPACE_ID,
  DEMO_WORKSPACE_NAME,
  DEMO_WORKSPACE_SLUG,
  demoTasks,
} from "@/server/demo/tasks-demo";
import { USERS } from "@/lib/data";
import { readPersonalityPrefs } from "@/server/personality-read";
import { PERSONALITY_DEFAULTS } from "@/lib/personality-prefs";
import { isTaskDone } from "@/lib/board-columns";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  if (isDemoMode()) {
    const tasks = demoTasks();
    // Demo/review never touches the DB (access-mode.ts safety invariant), so
    // there is no per-workspace column config to read here; null resolves to
    // the default ["done"] doneKeys, identical to the literal check it replaces.
    const completed = tasks.filter((task) => isTaskDone(task, null));
    const open = tasks.filter((task) => !isTaskDone(task, null));

    return (
      <>
        <AppPageHeader />
        <InboxApp
          notifications={[]}
          digest={{
            forDate: new Date().toISOString().slice(0, 10),
            user: DEMO_USER_ID,
            completedYesterday: completed,
            dueToday: open.filter((task) => task.due).slice(0, 2),
            mentions: [],
          }}
          nudges={generateNudges(tasks, DEMO_USER_ID)}
          weeklySnapshot={{
            closedThisWeek: completed.length,
            closedTitles: completed.map((task) => task.title),
            stillCirclingTitles: [],
            openCount: open.length,
          }}
          weeklyEnabled={false}
          workspaceId={DEMO_WORKSPACE_ID}
          workspaceName={DEMO_WORKSPACE_NAME}
          workspaceSlug={DEMO_WORKSPACE_SLUG}
          overdueCount={0}
          userName={USERS[DEMO_USER_ID].name}
          personalityPrefs={PERSONALITY_DEFAULTS}
        />
      </>
    );
  }

  const [me, ws] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspace(),
  ]);
  // Server-fetch in parallel: notifications + digest + the task list
  // we need to compute rules-based nudges from. All three scoped to
  // the current workspace.
  const [notifications, digest, tasks, weeklySnapshot, wsMeta, overdueCount, userRow, personalityPrefs] =
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
      // Pre-flight count for the roll-forward affordance, server-side
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
      // Personality prefs for greeting + tips gating.
      readPersonalityPrefs(me),
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
        personalityPrefs={personalityPrefs}
      />
    </>
  );
}
