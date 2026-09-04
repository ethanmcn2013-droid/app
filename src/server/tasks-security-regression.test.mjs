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
  join(serverDir, "..", "app", "app", "tasks", "page.tsx"),
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
const seedActions = readFileSync(
  join(serverDir, "actions", "seed.ts"),
  "utf8",
);
const projectTaskGraph = readFileSync(
  join(serverDir, "projects", "project-task-graph.ts"),
  "utf8",
);
const nudgeActions = readFileSync(
  join(serverDir, "actions", "nudge.ts"),
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

test("destructive task graphs re-prove authority and deletion fences inside their writer transaction", () => {
  for (const [source, name] of [
    [attachmentActions, "deleteAttachmentAction"],
    [resourceActions, "removeResourceAction"],
    [actions, "removeTaskAction"],
  ]) {
    const body = exportedActionBody(source, name);
    const transaction = body.indexOf("db.transaction");
    const reproof = body.indexOf("authorizeStoredProject", transaction);
    const fence = body.indexOf("assertProjectNotDeleting", transaction);
    assert.ok(transaction >= 0, `${name} must use a writer transaction`);
    assert.ok(
      reproof > transaction,
      `${name} must re-prove authority inside its writer transaction`,
    );
    assert.ok(
      fence > reproof,
      `${name} must check the deletion fence after transactional reproof`,
    );
  }

  const graphFence = projectTaskGraph.indexOf("assertProjectNotDeleting");
  const graphDelete = projectTaskGraph.indexOf(".delete(", graphFence);
  assert.ok(
    graphFence >= 0 && graphDelete > graphFence,
    "the shared graph replacement must fence Project deletion before mutation",
  );
  for (const name of ["clearAllTasksAction", "seedDomainAction"]) {
    const body = exportedActionBody(seedActions, name);
    const transaction = body.indexOf("db.transaction");
    const reproof = body.indexOf("authorizeStoredProject", transaction);
    const graphReplacement = body.indexOf(
      "replaceWorkspaceTaskGraphInTransaction",
      reproof,
    );
    assert.ok(transaction >= 0, `${name} must use a writer transaction`);
    assert.ok(
      reproof > transaction,
      `${name} must re-prove authority inside its writer transaction`,
    );
    assert.ok(
      graphReplacement > reproof,
      `${name} must enter the fenced graph replacement after transactional reproof`,
    );
  }

  const attachmentDelete = exportedActionBody(
    attachmentActions,
    "deleteAttachmentAction",
  );
  assert.match(
    attachmentDelete,
    /deleteNativeAttachmentAndMirrorInTransaction\(transaction/,
    "direct attachment deletion must atomically remove its exact Signal-upload mirror",
  );
});

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
  // The projection call sites take toPublicTask through a lambda now: the
  // share path passes the serving instant (for the derived overdue flag,
  // never the timestamp) and the /p path passes none. The property this
  // test guards is unchanged — every public payload flows through the
  // toPublicTask allowlist.
  assert.match(
    queries,
    /const taskList = \(await getTasks\(ws\.id\)\)\.map\(\(task\) => toPublicTask\(task\)\)/,
  );
  assert.match(
    queries,
    /const publicTasks = taskList\.map\(\(task\) => toPublicTask\(task, servedAt\)\)/,
  );
  assert.match(queries, /tasks:\s*publicTasks/);
  assert.match(queries, /toPublicTask\(task, demoNow\)/);
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
  // WP3 renegotiation (ADR 0001 §9). This guard's subject is the ORDERING —
  // demo/review must exit before the action resolves a tenant — and not the
  // name of the call that does the resolving. `getSubtasksAction` no longer
  // resolves a tenant ambiently at all: it derives the parent task's own
  // Project and proves `open` on it, so there is no `getActiveWorkspace*` left
  // in its body to point at. Pointing the assertion at the call that replaced
  // it keeps the invariant intact and still fails if the demo guard is moved
  // below the boundary. Every other action in the list above keeps the
  // original token, which continues to match `getActiveWorkspaceOrNull`.
  assertDemoGuardBefore(actions, "getSubtasksAction", "scopeForTask");
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
    ["renameColumnAction", ["getActiveWorkspace", "readColumnConfig", "writeColumnConfig"]],
    ["setColumnLimitAction", ["getActiveWorkspace", "readColumnConfig", "writeColumnConfig"]],
    ["setColumnDoneAction", ["getActiveWorkspace", "readColumnConfig", "writeColumnConfig"]],
    ["addColumnAction", ["getActiveWorkspace", "readColumnConfig", "writeColumnConfig"]],
    ["reorderColumnsAction", ["getActiveWorkspace", "readColumnConfig", "writeColumnConfig"]],
    ["deleteColumnAction", ["getActiveWorkspace", "readColumnConfig", "await db", "writeColumnConfig"]],
    // WP3 renegotiation (ADR 0001 §9), same reasoning as getSubtasksAction
    // above: moveTaskToColumnAction is an object operation, so it derives the
    // dragged card's own Project instead of resolving one ambiently, and has
    // no `getActiveWorkspace*` left to point at. The ordering invariant — demo
    // exits before tenant resolution — is unchanged; only the name of the call
    // that resolves the tenant has. Every other entry in this table is a
    // create/list site that still resolves ambiently and keeps the old token.
    ["moveTaskToColumnAction", ["scopeForTask", "await db", "revalidatePath"]],
  ]) {
    for (const boundary of boundaries) {
      assertDemoGuardBefore(boardActions, name, boundary);
    }
  }
  // WP3 renegotiation (ADR 0001 §9). setTaskTimelineAction is an object
  // operation and derives the dragged task's own Project, so `scopeForTask`
  // replaces `getActiveWorkspace` as the tenant-resolution boundary. The
  // ordering invariant is unchanged. This action was the inventory's clearest
  // silent-refusal case — it returns { ok: true } unconditionally — so the
  // ordering matters more here than almost anywhere.
  for (const boundary of [
    "scopeForTask",
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
  // WP3 renegotiation (ADR 0001 §9). create/list here still resolve a Project
  // ambiently — they have no object to derive one from — and keep the original
  // token, which matches getActiveWorkspaceOrNull. revoke and email are object
  // operations on the link row: they prove the link's own stored Project, so
  // `authorizeStoredProject` is the boundary. That distinction is the point of
  // the change. A revocation scoped to the cookie silently failed to revoke
  // when the caller's active Project had moved on, which is the worst failure
  // mode a revocation can have.
  for (const [name, boundaries] of [
    ["createShareLinkAction", ["getActiveWorkspace", "db.insert"]],
    ["listShareLinksAction", ["getActiveWorkspace", "await db"]],
    ["revokeShareLinkAction", ["authorizeStoredProject", "await db", "revalidatePath"]],
    ["bumpShareLinkVisitAction", ["db.run", "recordShareLinkVisit", "revalidatePath"]],
    ["listShareLinkAnalyticsAction", ["getActiveWorkspace", "await db", "getShareLinkVisitAnalytics"]],
    ["emailShareLinkAction", ["await db", "getCurrentUser", "authorizeStoredProject", "sendEmail"]],
  ]) {
    for (const boundary of boundaries) {
      assertDemoGuardBefore(shareActions, name, boundary);
    }
  }
  // WP3 renegotiation (ADR 0001 §9). The old token pinned the exact call
  // `await getActiveWorkspace()`, which no longer exists anywhere in this lane
  // — the ambient value is now read through the fail-closed accessor and put
  // through a membership proof before it is used. `provedProject` is the call
  // that resolves the tenant here, so it is what the ordering is asserted
  // against. The invariant is unchanged.
  for (const boundary of ["provedProject", "await db"]) {
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
  const studentRequest = compActions.slice(compActions.indexOf("export async function requestStudentCodeAction"));
  assert.match(studentRequest, /reason: "unavailable"/);
  assert.doesNotMatch(studentRequest, /mintCompCodeInternal|sendEmail|db\.|ok: true/);

  for (const boundary of ["redeemCompCodeImpl", "Sentry.captureException"]) {
    assertDemoGuardBefore(compActions, "redeemCompCodeAction", boundary);
  }
  for (const boundary of [
    "getCurrentUser",
    "getActiveWorkspace",
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

  // WP3 renegotiation (ADR 0001 §9). getTaskConversationAction is an object
  // operation: it proves the task's own Project rather than resolving one
  // ambiently. Ordering invariant unchanged.
  assertDemoGuardBefore(
    conversationActions,
    "getTaskConversationAction",
    "scopeForTask",
  );
  assertDemoGuardBefore(
    attachmentActions,
    "uploadAttachmentAction",
    "formData.get",
  );
  // WP3 renegotiation (ADR 0001 §9). Both attachment paths are object
  // operations now: they derive the parent task's own Project instead of
  // resolving one ambiently, so `scopeForTask` is the tenant-resolution
  // boundary. The invariant is unchanged — demo/review must exit before the
  // action resolves a tenant, and it still does.
  assertDemoGuardBefore(
    attachmentActions,
    "deleteAttachmentAction",
    "scopeForTask",
  );
  assertDemoGuardBefore(
    attachmentActions,
    "listAttachmentsForTaskAction",
    "scopeForTask",
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
  // WP3 renegotiation (ADR 0001 §9). removeCommentAction is an object
  // operation: it proves the parent task's own Project rather than resolving
  // one ambiently, so `scopeForTask` is the tenant-resolution boundary. The
  // author match (`comments.userId === me`) is unchanged and still precedes
  // the delete — this guard's other seven boundaries pin that ordering.
  for (const boundary of [
    "getCurrentUser",
    "scopeForTask",
    ".select(",
    ".delete(",
    "touchTask",
    "recordActivity",
    "revalidatePath",
    "emitTasksChanged",
  ]) {
    assertDemoGuardBefore(commentActions, "removeCommentAction", boundary);
  }
  // WP3 renegotiation (ADR 0001 §9). duplicateTaskAction derives the source
  // task's own Project; the cross-Project refusal it already carried is now an
  // assertion against the proved id rather than against the cookie.
  for (const boundary of [
    "scopeForTask",
    "db.select",
    "db.transaction",
    "recordActivity",
    "revalidatePath",
    "emitTasksChanged",
  ]) {
    assertDemoGuardBefore(duplicateTaskActions, "duplicateTaskAction", boundary);
  }
  // WP3 renegotiation (ADR 0001 §9). setParentAction derives the reparented
  // task's own Project; the same-Project invariant it protects is now checked
  // against the child's real Project instead of the cookie's.
  for (const boundary of [
    "scopeForTask",
    "await db",
    "recordActivity",
    "revalidatePath",
    "emitTasksChanged",
  ]) {
    assertDemoGuardBefore(setParentActions, "setParentAction", boundary);
  }
  // WP3 renegotiation (ADR 0001 §9), same reasoning: all three resource
  // paths derive the owning task's Project. removeResourceAction matters most
  // — it has two destructive branches, and the proof is now a separate
  // statement ahead of both, so no empty result decides that a delete may
  // proceed.
  for (const boundary of [
    "scopeForTask",
    "await db",
  ]) {
    assertDemoGuardBefore(resourceActions, "listTaskResourcesAction", boundary);
  }
  for (const boundary of [
    "scopeForTask",
    "getCurrentUser",
    "await db",
    "recordActivity",
    "revalidatePath",
    "emitTasksChanged",
  ]) {
    assertDemoGuardBefore(resourceActions, "addLinkResourceAction", boundary);
  }
  assertDemoGuardBefore(resourceActions, "removeResourceAction", "scopeForTask");
  // WP3 renegotiation (ADR 0001 §9). sendNudgeAction derives the nudged
  // task's own Project. It sends outbound email, so a wrong Project here does
  // not merely drop a write — the ordering this guard pins matters more, not
  // less, and it is preserved.
  for (const boundary of [
    "scopeForTask",
    "getCurrentUser",
    "await db",
  ]) {
    assertDemoGuardBefore(nudgeActions, "sendNudgeAction", boundary);
  }
  // WP3 renegotiation (ADR 0001 §9). Both AI narration paths are object
  // operations: they prove the narrated task's own Project rather than
  // comparing it against the cookie. Ordering invariant unchanged, and it
  // matters here — these stream a task's content to a model.
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
      "scopeForTask",
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
    // WP3 renegotiation, with the invariant intact. This list names the
    // production boundaries that must sit AFTER the demo guard; the accessor
    // is one example of such a boundary, not the property being protected.
    // /app/inbox resolved its Project through `getActiveWorkspace`, whose
    // third fallback returns LEGACY_WORKSPACE_ID without a membership proof
    // (DECISIONS D-005). It now uses `requireRouteProjectId()`, which fails
    // closed. Same position, same ordering requirement, same test — only the
    // name of the boundary changed. Updated rather than dropped: removing the
    // entry would have silently stopped checking this page's DB access.
    "requireRouteProjectId()",
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
    // Same WP3 renegotiation as the inbox list above. /app/import is the
    // stronger case: its Project is a WRITE destination, so an unproved one
    // here is a destination nobody authorized.
    "requireRouteProjectId()",
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
  // The read-only boundary moved INSIDE SettingsApp (wave 7.3): inert around
  // the whole app killed the section navigation with the forms, leaving eight
  // sections unreachable. The demo page now declares readOnly and the app
  // applies inert to the section content only — so the guard pins both
  // halves: the page passes the flag, and the app turns the flag into inert.
  assert.match(settingsPage, /<SettingsApp[\s\S]{0,40}readOnly/);
  const settingsApp = readFileSync(
    join(serverDir, "..", "components", "app", "settings", "settings-app.tsx"),
    "utf8",
  );
  assert.match(
    settingsApp,
    /<div inert=\{readOnly \|\| undefined\} aria-disabled=\{readOnly \|\| undefined\}>/,
  );

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

// ── Phase 2 invite-hardening regression guards ───────────────────────────────

const settingsActions = readFileSync(
  join(serverDir, "actions", "settings.ts"),
  "utf8",
);

const securityActions = readFileSync(
  join(serverDir, "actions", "security.ts"),
  "utf8",
);

test("acceptInviteAction validates before writing membership row", () => {
  // All validation (invite exists, not accepted, not expired, email match, cap)
  // must appear before the INSERT OR IGNORE into workspace_members.
  const start = settingsActions.indexOf("export async function acceptInviteAction");
  const end = settingsActions.indexOf("\nexport async function ", start + 1);
  const body = settingsActions.slice(start, end === -1 ? settingsActions.length : end);

  const inviteLoad = body.indexOf("select({");
  const emailCheck = body.indexOf("clerkEmail.toLowerCase() !== invite.email.toLowerCase()");
  const capCheck = body.indexOf("canAddMemberByWorkspace(");
  const memberInsert = body.indexOf("INSERT OR IGNORE INTO workspace_members");
  const tokenBurn = body.indexOf(".set({ acceptedAt:");

  assert.ok(inviteLoad >= 0, "acceptInviteAction must load the invite row");
  assert.ok(emailCheck >= 0, "acceptInviteAction must check email match against Clerk verified email");
  assert.ok(capCheck >= 0, "acceptInviteAction must re-check member cap");
  assert.ok(memberInsert >= 0, "acceptInviteAction must insert workspace_members row");
  assert.ok(tokenBurn >= 0, "acceptInviteAction must burn the token");

  assert.ok(emailCheck < memberInsert, "email validation must precede membership write");
  assert.ok(capCheck < memberInsert, "cap check must precede membership write");
  assert.ok(body.indexOf("db.transaction(") < tokenBurn, "claim and membership must commit atomically");
  assert.ok(tokenBurn < memberInsert, "claim a still-live invite before granting membership");
  assert.match(body, /isNull\(pendingInvites\.acceptedAt\)/);
  assert.match(body, /gt\(pendingInvites\.expiresAt, new Date\(\)\)/);
});

test("acceptInviteAction writes invite role not hardcoded member", () => {
  const start = settingsActions.indexOf("export async function acceptInviteAction");
  const end = settingsActions.indexOf("\nexport async function ", start + 1);
  const body = settingsActions.slice(start, end === -1 ? settingsActions.length : end);

  // Must read the role from the invite row
  assert.match(body, /role:\s*pendingInvites\.role/, "must select role from pendingInvites");
  // Must clamp the role defensively
  assert.match(body, /grantedRole/, "must use a grantedRole variable");
  // Must pass grantedRole (not literal 'member') to INSERT
  assert.match(body, /VALUES.*grantedRole/, "must pass grantedRole to workspace_members INSERT");
  // Must NOT hardcode 'member' in the INSERT statement
  assert.doesNotMatch(
    body.slice(body.indexOf("INSERT OR IGNORE INTO workspace_members")),
    /'member'\s*\)/,
    "must not hardcode 'member' in workspace_members INSERT",
  );
});

test("invite actions insert workspace_events rows", () => {
  // inviteMemberByEmailAction writes an inviteSent event
  const inviteStart = settingsActions.indexOf("export async function inviteMemberByEmailAction");
  const inviteEnd = settingsActions.indexOf("\nexport async function ", inviteStart + 1);
  const inviteBody = settingsActions.slice(inviteStart, inviteEnd === -1 ? settingsActions.length : inviteEnd);
  assert.match(inviteBody, /workspaceEvents/, "inviteMemberByEmailAction must insert into workspaceEvents");
  assert.match(inviteBody, /kind.*inviteSent/, "inviteMemberByEmailAction must write inviteSent kind");
  // No email in payload
  assert.doesNotMatch(inviteBody, /payload.*trimmed/, "inviteSent payload must not include the email address");

  // acceptInviteAction writes an inviteAccepted event
  const acceptStart = settingsActions.indexOf("export async function acceptInviteAction");
  const acceptEnd = settingsActions.indexOf("\nexport async function ", acceptStart + 1);
  const acceptBody = settingsActions.slice(acceptStart, acceptEnd === -1 ? settingsActions.length : acceptEnd);
  assert.match(acceptBody, /workspaceEvents/, "acceptInviteAction must insert into workspaceEvents");
  assert.match(acceptBody, /kind.*inviteAccepted/, "acceptInviteAction must write inviteAccepted kind");
});

// ── Phase 2.3/2.4 security actions regression guards ────────────────────────

test("revokeSessionAction lists owned sessions before revoking", () => {
  // Ownership check: getSessionList must precede revokeSession in the
  // function body. The list result is matched against the caller's
  // userId so a session belonging to another user cannot be revoked.
  const fnStart = securityActions.indexOf("export async function revokeSessionAction");
  const fnEnd = securityActions.indexOf("\nexport async function ", fnStart + 1);
  const body = securityActions.slice(fnStart, fnEnd === -1 ? securityActions.length : fnEnd);

  const authGuard = body.indexOf("await auth()");
  const listCall = body.indexOf("getSessionList(");
  const ownedCheck = body.indexOf(".some((s) => s.id === sessionId)");
  const revokeCall = body.indexOf("revokeSession(sessionId)");

  assert.ok(authGuard >= 0, "revokeSessionAction must call auth() to resolve the caller");
  assert.ok(listCall >= 0, "revokeSessionAction must call getSessionList before revoking");
  assert.ok(ownedCheck >= 0, "revokeSessionAction must verify session ownership via list match");
  assert.ok(revokeCall >= 0, "revokeSessionAction must call revokeSession");

  assert.ok(authGuard < listCall, "auth() resolution must precede getSessionList");
  assert.ok(listCall < ownedCheck, "getSessionList must precede the ownership check");
  assert.ok(ownedCheck < revokeCall, "ownership check must precede revokeSession call");
});

test("revokeOtherSessionsAction lists owned sessions before revoking", () => {
  const fnStart = securityActions.indexOf("export async function revokeOtherSessionsAction");
  const fnEnd = securityActions.indexOf("\nexport async function ", fnStart + 1);
  const body = securityActions.slice(fnStart, fnEnd === -1 ? securityActions.length : fnEnd);

  const authGuard = body.indexOf("await auth()");
  const listCall = body.indexOf("getSessionList(");
  const filterCall = body.indexOf(".filter(");
  const revokeAll = body.indexOf("revokeSession(s.id)");

  assert.ok(authGuard >= 0, "revokeOtherSessionsAction must call auth() to resolve the caller");
  assert.ok(listCall >= 0, "revokeOtherSessionsAction must call getSessionList before revoking");
  assert.ok(filterCall >= 0, "revokeOtherSessionsAction must filter out the current session");
  assert.ok(revokeAll >= 0, "revokeOtherSessionsAction must call revokeSession");

  assert.ok(authGuard < listCall, "auth() resolution must precede getSessionList");
  assert.ok(listCall < filterCall, "getSessionList must precede the filter step");
  assert.ok(filterCall < revokeAll, "filter must precede revokeSession calls");
});

test("security.ts server reads are guarded before Clerk or DB calls", () => {
  // getSecurityData must resolve currentUser/auth before any Clerk or DB call.
  const fnStart = securityActions.indexOf("export async function getSecurityData");
  const fnEnd = securityActions.indexOf("\nexport async function ", fnStart + 1);
  const body = securityActions.slice(fnStart, fnEnd === -1 ? securityActions.length : fnEnd);

  const demoGuard = body.indexOf("isDemoMode()");
  const clerkCheck = body.indexOf("clerkConfigured()");
  const userGuard = body.indexOf("currentUser()");
  const clerkClientCall = body.indexOf("clerkClient()");
  const dbCall = body.indexOf("await db");

  assert.ok(demoGuard >= 0, "getSecurityData must guard demo mode");
  assert.ok(clerkCheck >= 0, "getSecurityData must guard when Clerk is unconfigured");
  assert.ok(userGuard >= 0, "getSecurityData must call currentUser() before Clerk/DB access");
  assert.ok(clerkClientCall >= 0, "getSecurityData must call clerkClient() to list sessions");
  assert.ok(dbCall >= 0, "getSecurityData must read workspace_events from DB");

  assert.ok(demoGuard < clerkClientCall, "demo guard must precede clerkClient() call");
  assert.ok(clerkCheck < clerkClientCall, "clerkConfigured() check must precede clerkClient() call");
  assert.ok(userGuard < clerkClientCall, "currentUser() resolution must precede clerkClient() call");
  assert.ok(userGuard < dbCall, "currentUser() resolution must precede DB access");
});

test("createShareLinkAction clamps mode to view", () => {
  // D-020: mode must be clamped server-side to 'view' regardless of input
  const createStart = shareActions.indexOf("export async function createShareLinkAction");
  const createEnd = shareActions.indexOf("\nexport async function ", createStart + 1);
  const createBody = shareActions.slice(createStart, createEnd === -1 ? shareActions.length : createEnd);

  // Must have an explicit clamp
  assert.match(createBody, /const mode.*=.*"view"/, "createShareLinkAction must clamp mode to 'view'");
  // Must use the clamped variable in the insert, not input.mode directly
  assert.match(createBody, /mode,/, "createShareLinkAction must pass the clamped mode variable");
  assert.doesNotMatch(
    createBody.slice(createBody.indexOf("db.insert(")),
    /input\.mode/,
    "createShareLinkAction must not pass input.mode directly to the insert",
  );
});
