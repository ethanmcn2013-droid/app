/**
 * Source-level regression guards for the Tasks tenant boundaries. These run
 * without a database or server-only imports, but assert the real action/query
 * boundaries that would otherwise be easy to weaken during refactors.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = dirname(fileURLToPath(import.meta.url));
const actions = readFileSync(join(serverDir, "actions", "tasks.ts"), "utf8");
const activity = readFileSync(join(serverDir, "db", "activity.ts"), "utf8");
const queries = readFileSync(join(serverDir, "db", "queries.ts"), "utf8");
const dbIndex = readFileSync(join(serverDir, "db", "index.ts"), "utf8");
const publicTask = readFileSync(join(serverDir, "..", "lib", "public-task.ts"), "utf8");
const conversationActions = readFileSync(
  join(serverDir, "actions", "conversation.ts"),
  "utf8",
);
const attachmentActions = readFileSync(
  join(serverDir, "actions", "attachments.ts"),
  "utf8",
);
const crossWorkspaceActions = readFileSync(
  join(serverDir, "actions", "cross-workspace.ts"),
  "utf8",
);
const crossWorkspaceSearchActions = readFileSync(
  join(serverDir, "actions", "cross-workspace-search.ts"),
  "utf8",
);
const boardPage = readFileSync(
  join(serverDir, "..", "app", "app", "board", "page.tsx"),
  "utf8",
);
const inboxPage = readFileSync(
  join(serverDir, "..", "app", "app", "inbox", "page.tsx"),
  "utf8",
);
const importPage = readFileSync(
  join(serverDir, "..", "app", "app", "import", "page.tsx"),
  "utf8",
);
const shareCardImage = readFileSync(
  join(
    serverDir,
    "..",
    "app",
    "share-card",
    "[workspaceId]",
    "opengraph-image.tsx",
  ),
  "utf8",
);
const commentActions = readFileSync(
  join(serverDir, "actions", "comments.ts"),
  "utf8",
);
const duplicateTaskActions = readFileSync(
  join(serverDir, "actions", "duplicate-task.ts"),
  "utf8",
);
const setParentActions = readFileSync(
  join(serverDir, "actions", "set-parent.ts"),
  "utf8",
);
const resourceActions = readFileSync(
  join(serverDir, "actions", "resources.ts"),
  "utf8",
);
const aiActions = readFileSync(
  join(serverDir, "actions", "ai.ts"),
  "utf8",
);
const importActions = readFileSync(
  join(serverDir, "actions", "import.ts"),
  "utf8",
);
const boardActions = readFileSync(
  join(serverDir, "actions", "board.ts"),
  "utf8",
);
const timelineActions = readFileSync(
  join(serverDir, "actions", "timeline-drag.ts"),
  "utf8",
);
const shareActions = readFileSync(
  join(serverDir, "actions", "share.ts"),
  "utf8",
);
const templateActions = readFileSync(
  join(serverDir, "actions", "templates.ts"),
  "utf8",
);
const compActions = readFileSync(
  join(serverDir, "actions", "comp.ts"),
  "utf8",
);
const billingActions = readFileSync(
  join(serverDir, "actions", "billing.ts"),
  "utf8",
);
const checkoutRoute = readFileSync(
  join(serverDir, "..", "app", "api", "checkout", "route.ts"),
  "utf8",
);
const settingsPage = readFileSync(
  join(serverDir, "..", "app", "app", "settings", "page.tsx"),
  "utf8",
);
const calendarRoute = readFileSync(
  join(
    serverDir,
    "..",
    "app",
    "api",
    "calendar",
    "[workspaceId]",
    "route.ts",
  ),
  "utf8",
);

function exportedActionBody(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must remain an exported server action`);
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function assertDemoGuardBefore(source, name, boundary) {
  const body = exportedActionBody(source, name);
  const guard = body.indexOf("isDemoMode()");
  const boundaryIndex = body.indexOf(boundary);
  assert.ok(guard >= 0, `${name} must explicitly guard demo/review mode`);
  assert.ok(boundaryIndex >= 0, `${name} must still contain ${boundary}`);
  assert.ok(
    guard < boundaryIndex,
    `${name} must exit demo/review mode before ${boundary}`,
  );
}

test("recordActivity requires and enforces the caller workspace", () => {
  assert.match(activity, /opts:\s*\{\s*workspaceId:\s*string/);
  assert.match(activity, /eq\(tasks\.workspaceId, opts\.workspaceId\)/);
  assert.match(activity, /workspaceId:\s*opts\.workspaceId/);
});

test("updateTaskAction resolves an owned row before emitting activity", () => {
  const start = actions.indexOf("export async function updateTaskAction");
  const end = actions.indexOf("export async function addTaskAction", start);
  assert.ok(start >= 0 && end > start);
  const body = actions.slice(start, end);
  const ownedRead = body.indexOf("eq(tasks.id, id), eq(tasks.workspaceId, ws)");
  const activityWrite = body.indexOf("recordActivity(id");
  assert.ok(ownedRead >= 0, "update must read the target with workspace scope");
  assert.ok(activityWrite > ownedRead, "activity must follow the owned-row guard");
  assert.match(body, /if\s*\(!ownedTask\)\s*return\s*getTasks\(ws\)/);
});

test("addTaskAction validates parent ownership and top-level shape", () => {
  const start = actions.indexOf("export async function addTaskAction");
  const end = actions.indexOf("export async function reorderTaskAction", start);
  const body = actions.slice(start, end);
  assert.match(body, /eq\(tasks\.id, input\.parentTaskId\)/);
  assert.match(body, /eq\(tasks\.workspaceId, ws\)/);
  assert.match(body, /isNull\(tasks\.parentTaskId\)/);
  assert.match(body, /parent task is not in the active workspace/);
});

test("subtask reads include both parent id and workspace scope", () => {
  const start = queries.indexOf("export async function getSubtasks");
  const end = queries.indexOf("/** Resolve a published workspace", start);
  const body = queries.slice(start, end);
  assert.match(body, /byWorkspace\(/);
  assert.match(body, /tasks\.workspaceId/);
  assert.match(body, /eq\(tasks\.parentTaskId, parentTaskId\)/);
});

test("public routes use the explicit allowlisted projection", () => {
  assert.match(publicTask, /id:\s*task\.id/);
  assert.match(publicTask, /title:\s*task\.title/);
  assert.match(publicTask, /lane:\s*task\.lane/);
  assert.match(publicTask, /priority:\s*task\.priority/);
  assert.doesNotMatch(publicTask, /\.assignees|\.description|\.cents|\.workspaceId|\.sourceNoteId/);
  assert.match(queries, /const taskList = \(await getTasks\(ws\.id\)\)\.map\(toPublicTask\)/);
  assert.match(queries, /tasks:\s*taskList\.map\(toPublicTask\)/);
  assertDemoGuardBefore(
    queries,
    "getPublishedWorkspaceBySlug",
    "await db",
  );
  assertDemoGuardBefore(queries, "getWorkspaceName", "await db");
});

test("demo and review actions exit before tenant, database, or disk access", () => {
  for (const name of [
    "getTasksAction",
    "getSubtasksAction",
    "moveTaskAction",
    "toggleCompleteAction",
    "updateTaskAction",
    "addTaskAction",
    "reorderTaskAction",
    "removeTaskAction",
    "setTaskMilestoneAction",
  ]) {
    assertDemoGuardBefore(actions, name, "getActiveWorkspace");
  }
  for (const boundary of [
    "getActiveWorkspace",
    "laneStartPositions",
    "db.transaction",
    "recordActivity",
    "revalidatePath",
    "emitTasksChanged",
  ]) {
    assertDemoGuardBefore(importActions, "importCsvAction", boundary);
  }
  for (const [name, boundaries] of [
    ["getBoardName", ["await db"]],
    ["renameBoardAction", ["getActiveWorkspace", "db.run", "revalidatePath"]],
    ["getColumnConfig", ["readColumnConfig"]],
    ["getColumnNames", ["readColumnConfig"]],
    ["renameColumnAction", ["getActiveWorkspace", "readColumnConfig", "writeColumnConfig"]],
    ["addColumnAction", ["getActiveWorkspace", "readColumnConfig", "writeColumnConfig"]],
    ["reorderColumnsAction", ["getActiveWorkspace", "readColumnConfig", "writeColumnConfig"]],
    ["deleteColumnAction", ["getActiveWorkspace", "readColumnConfig", "await db", "writeColumnConfig"]],
    ["moveTaskToColumnAction", ["getActiveWorkspace", "await db", "revalidatePath"]],
  ]) {
    for (const boundary of boundaries) {
      assertDemoGuardBefore(boardActions, name, boundary);
    }
  }
  for (const boundary of [
    "getActiveWorkspace",
    "await db",
    "revalidatePath",
    "emitTasksChanged",
  ]) {
    assertDemoGuardBefore(
      timelineActions,
      "setTaskTimelineAction",
      boundary,
    );
  }
  for (const [name, boundaries] of [
    ["createShareLinkAction", ["getActiveWorkspace", "db.insert"]],
    ["listShareLinksAction", ["getActiveWorkspace", "await db"]],
    ["revokeShareLinkAction", ["getActiveWorkspace", "await db", "revalidatePath"]],
    ["bumpShareLinkVisitAction", ["db.run", "recordShareLinkVisit", "revalidatePath"]],
    ["listShareLinkAnalyticsAction", ["getActiveWorkspace", "await db", "getShareLinkVisitAnalytics"]],
    ["emailShareLinkAction", ["await db", "getCurrentUser", "getActiveWorkspace", "sendEmail"]],
  ]) {
    for (const boundary of boundaries) {
      assertDemoGuardBefore(shareActions, name, boundary);
    }
  }
  for (const boundary of ["await getActiveWorkspace()", "await db"]) {
    assertDemoGuardBefore(
      importActions,
      "getActiveWorkspaceNameAction",
      boundary,
    );
  }
  for (const boundary of [
    "getActiveWorkspace",
    "applyTemplateToWorkspace",
    "revalidatePath",
    "emitTasksChanged",
  ]) {
    assertDemoGuardBefore(templateActions, "applyTemplateAction", boundary);
  }
  for (const boundary of [
    "getCurrentUser",
    "reserveUniqueSlug",
    "db.insert",
    "cookies",
    "recordActivity",
    "revalidatePath",
    "emitTasksChanged",
  ]) {
    assertDemoGuardBefore(templateActions, "remixTemplateAction", boundary);
  }
  for (const boundary of ["mintCompCodeInternal", "sendEmail"]) {
    assertDemoGuardBefore(compActions, "requestStudentCodeAction", boundary);
  }
  for (const boundary of ["redeemCompCodeImpl", "Sentry.captureException"]) {
    assertDemoGuardBefore(compActions, "redeemCompCodeAction", boundary);
  }
  for (const boundary of [
    "getCurrentUser",
    "getActiveWorkspace",
    "grantEntitlement",
    "stripe.checkout.sessions.create",
  ]) {
    assertDemoGuardBefore(
      billingActions,
      "createCheckoutSessionAction",
      boundary,
    );
  }

  const checkoutBody = checkoutRoute.slice(
    checkoutRoute.indexOf("export async function GET"),
  );
  const checkoutGuard = checkoutBody.indexOf("isDemoMode()");
  assert.ok(checkoutGuard >= 0, "checkout route must guard demo/review mode");
  for (const boundary of [
    "stripeConfigured",
    "await auth()",
    "createCheckoutSessionAction",
  ]) {
    const boundaryIndex = checkoutBody.indexOf(boundary);
    assert.ok(boundaryIndex >= 0, `checkout route must retain ${boundary}`);
    assert.ok(
      checkoutGuard < boundaryIndex,
      `checkout route must exit demo/review mode before ${boundary}`,
    );
  }

  assertDemoGuardBefore(
    conversationActions,
    "getTaskConversationAction",
    "getActiveWorkspace",
  );
  assertDemoGuardBefore(
    attachmentActions,
    "uploadAttachmentAction",
    "formData.get",
  );
  assertDemoGuardBefore(
    attachmentActions,
    "deleteAttachmentAction",
    "getActiveWorkspace",
  );
  assertDemoGuardBefore(
    attachmentActions,
    "listAttachmentsForTaskAction",
    "getActiveWorkspace",
  );
  assertDemoGuardBefore(
    crossWorkspaceActions,
    "getOverdueAcrossWorkspacesAction",
    "getCurrentUser",
  );
  assertDemoGuardBefore(
    crossWorkspaceActions,
    "selectWorkspaceAction",
    "getCurrentUser",
  );
  assertDemoGuardBefore(
    crossWorkspaceSearchActions,
    "searchAcrossWorkspacesAction",
    "getCurrentUser",
  );
  for (const boundary of [
    "resolveCallerTaskWorkspace",
    "return getCommentsForTask",
  ]) {
    assertDemoGuardBefore(commentActions, "getCommentsForTaskAction", boundary);
  }
  for (const boundary of [
    "getCurrentUser",
    "resolveCallerTaskWorkspace",
    "db.insert",
    "touchTask",
    "recordActivity",
    "notify",
    "revalidatePath",
    "emitTasksChanged",
  ]) {
    assertDemoGuardBefore(commentActions, "addCommentAction", boundary);
  }
  for (const boundary of [
    "getCurrentUser",
    "getActiveWorkspace",
    ".select(",
    ".delete(",
    "touchTask",
    "recordActivity",
    "revalidatePath",
    "emitTasksChanged",
  ]) {
    assertDemoGuardBefore(commentActions, "removeCommentAction", boundary);
  }
  for (const boundary of [
    "getActiveWorkspace",
    "db.select",
    "db.transaction",
    "recordActivity",
    "revalidatePath",
    "emitTasksChanged",
  ]) {
    assertDemoGuardBefore(duplicateTaskActions, "duplicateTaskAction", boundary);
  }
  for (const boundary of [
    "getActiveWorkspace",
    "await db",
    "recordActivity",
    "revalidatePath",
    "emitTasksChanged",
  ]) {
    assertDemoGuardBefore(setParentActions, "setParentAction", boundary);
  }
  for (const boundary of [
    "getActiveWorkspace",
    "await db",
  ]) {
    assertDemoGuardBefore(resourceActions, "listTaskResourcesAction", boundary);
  }
  for (const boundary of [
    "getActiveWorkspace",
    "getCurrentUser",
    "await db",
    "recordActivity",
    "revalidatePath",
    "emitTasksChanged",
  ]) {
    assertDemoGuardBefore(resourceActions, "addLinkResourceAction", boundary);
  }
  assertDemoGuardBefore(resourceActions, "removeResourceAction", "getActiveWorkspace");
  for (const name of [
    "draftReplyAction",
    "summarizeConversationAction",
  ]) {
    for (const boundary of [
      "aiConfigured",
      "getModel",
      "getTaskById",
      "getTaskConversation",
      "getCurrentUser",
      "getActiveWorkspace",
      "allow",
      "streamText",
    ]) {
      assertDemoGuardBefore(aiActions, name, boundary);
    }
  }

  const welcomeStart = boardPage.indexOf('if (sp.welcome === "venue")');
  const welcomeBody = boardPage.slice(welcomeStart);
  assert.ok(welcomeStart >= 0, "board must retain the venue welcome branch");
  assert.ok(
    welcomeBody.indexOf("isDemoMode()") <
      welcomeBody.indexOf("getCurrentUser()"),
    "venue review fixture must resolve before auth or entitlement access",
  );
  assert.ok(
    welcomeBody.indexOf("isDemoMode()") <
      welcomeBody.indexOf("detectVenueWelcome"),
    "venue review fixture must resolve before entitlement reads",
  );
  assert.ok(
    welcomeBody.indexOf("isDemoMode()") <
      welcomeBody.indexOf("markVenueEntitlementReached"),
    "venue review fixture must resolve before entitlement writes",
  );

  const inboxBody = inboxPage.slice(
    inboxPage.indexOf("export default async function InboxPage"),
  );
  const inboxGuard = inboxBody.indexOf("isDemoMode()");
  assert.ok(inboxGuard >= 0, "inbox must explicitly guard demo/review mode");
  for (const boundary of [
    "getCurrentUser()",
    "getActiveWorkspace()",
    "getNotificationsForUser(",
    "compileDailyDigest(",
    "buildWeeklySnapshotFor(",
    "getOverdueTodayCount()",
    ".select({ name: workspaces.name",
  ]) {
    const boundaryIndex = inboxBody.indexOf(boundary);
    assert.ok(boundaryIndex >= 0, `inbox must retain production boundary ${boundary}`);
    assert.ok(
      inboxGuard < boundaryIndex,
      `inbox must resolve the demo fixture before ${boundary}`,
    );
  }

  const importBody = importPage.slice(
    importPage.indexOf("export default async function ImportPage"),
  );
  const importGuard = importBody.indexOf("isDemoMode()");
  assert.ok(importGuard >= 0, "import page must explicitly guard demo/review mode");
  for (const boundary of [
    "getActiveWorkspace()",
    "isFirstRun(",
    "getActiveWorkspaceNameAction()",
  ]) {
    const boundaryIndex = importBody.indexOf(boundary);
    assert.ok(boundaryIndex >= 0, `import page must retain production boundary ${boundary}`);
    assert.ok(
      importGuard < boundaryIndex,
      `import page must resolve the demo fixture before ${boundary}`,
    );
  }

  const shareCardBody = shareCardImage.slice(
    shareCardImage.indexOf("export default async function ShareCardOG"),
  );
  const shareCardGuard = shareCardBody.indexOf("isDemoMode()");
  const shareCardRead = shareCardBody.indexOf("await db");
  assert.ok(shareCardGuard >= 0, "share card must explicitly guard demo/review mode");
  assert.ok(shareCardRead >= 0, "share card must retain its production database read");
  assert.ok(
    shareCardGuard < shareCardRead,
    "share card must resolve the demo fixture before database access",
  );
  assert.match(
    settingsPage,
    /Review preview, settings are read-only\./,
  );
  assert.match(settingsPage, /<div inert aria-disabled="true">/);

  const calendarBody = calendarRoute.slice(
    calendarRoute.indexOf("export async function GET"),
  );
  const calendarGuard = calendarBody.indexOf("isDemoMode()");
  assert.ok(calendarGuard >= 0, "calendar feed must explicitly guard demo/review mode");
  for (const boundary of ["getCurrentUserOrNull()", "await db"]) {
    const boundaryIndex = calendarBody.indexOf(boundary);
    assert.ok(boundaryIndex >= 0, `calendar feed must retain ${boundary}`);
    assert.ok(
      calendarGuard < boundaryIndex,
      `calendar feed must resolve the demo fixture before ${boundary}`,
    );
  }
});

test("demo and review cannot bind or seed the configured database", () => {
  assert.match(dbIndex, /const demoMode = isDemoMode\(\)/);
  assert.match(
    dbIndex,
    /const url = demoMode\s*\? "file::memory:"\s*:\s*\(process\.env\.TASKS_DATABASE_URL/,
  );
  assert.match(
    dbIndex,
    /process\.env\.NODE_ENV === "development"\s*&&\s*!demoMode\s*&&/,
  );
});
