import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url).pathname.replace(/^\//, "").replaceAll("/", "\\");
const read = (relative) => fs.readFileSync(`${root}${relative}`, "utf8");

test("destructive workspace mutations require the server-side owner boundary", () => {
  const settings = read("src\\server\\actions\\settings.ts");
  const seed = read("src\\server\\actions\\seed.ts");
  assert.match(settings, /updateWorkspaceAction[\s\S]*requireActiveWorkspaceOwner/);
  assert.match(seed, /clearAllTasksAction[\s\S]*requireActiveWorkspaceOwner/);
  assert.match(seed, /seedDomainAction[\s\S]*requireActiveWorkspaceOwner/);
});

test("pending invite listing is an owner-only safe projection", () => {
  const settings = read("src\\server\\actions\\settings.ts");
  const section = settings.slice(settings.indexOf("export type PendingInviteRead"), settings.indexOf("export async function revokePendingInviteAction"));
  assert.match(section, /requireActiveWorkspaceOwner/);
  assert.doesNotMatch(section, /token:\s*pendingInvites\.token/);
  assert.doesNotMatch(section, /token:\s*r\.token/);
});

test("production checkout fails closed when Stripe is unavailable", () => {
  const billing = read("src\\server\\actions\\billing.ts");
  assert.match(billing, /if \(process\.env\.NODE_ENV === "production"\)/);
  assert.match(billing, /Billing is unavailable until Stripe is configured/);
});

test("private calendar responses cannot be shared through a CDN", () => {
  const calendar = read("src\\app\\api\\calendar\\[workspaceId]\\route.ts");
  assert.match(calendar, /Cache-Control.*private, no-store/);
  assert.doesNotMatch(calendar, /Cache-Control.*public/);
});

test("operator roadmap feed uses the operator principal, not authentication alone", () => {
  const route = read("src\\app\\api\\roadmap.ics\\route.ts");
  assert.match(route, /requireAdmin/);
  assert.doesNotMatch(route, /getCurrentUserOrNull/);
});

test("share-card OG route does not enumerate private workspaces by ID", () => {
  const route = read("src\\app\\share-card\\[workspaceId]\\opengraph-image.tsx");
  assert.match(route, /Raw workspace IDs are not public authorization/);
  assert.match(route, /ws = undefined/);
});

test("attachment server actions return a safe projection without storedPath", () => {
  const actions = read("src\\server\\actions\\attachments.ts");
  assert.match(actions, /PublicAttachment = Pick</);
  const projection = actions.match(/function toPublicAttachment[\s\S]*?\r?\n}\r?\n/)?.[0] ?? "";
  assert.ok(projection, "safe attachment projection must remain explicit");
  assert.doesNotMatch(projection, /workspaceId|taskId|storedPath/);
  assert.match(actions, /return toPublicAttachment\(/);
  assert.match(actions, /map\(toPublicAttachment\)/);
});

test("workspace onboarding and segment changes require the owner boundary", () => {
  const onboarding = read("src\\server\\actions\\onboarding.ts");
  for (const action of [
    "completeOnboardingAction",
    "skipOnboardingAction",
    "updateSegmentAction",
  ]) {
    assert.match(
      onboarding,
      new RegExp(`export async function ${action}[\\s\\S]*?requireActiveWorkspaceOwner`),
    );
  }
});

test("digest cron binds user and workspace selectors to a fresh membership", () => {
  const route = read("src\\app\\api\\cron\\digest\\route.ts");
  const membership = route.indexOf("const [membership]");
  const compile = route.indexOf("compileDailyDigest(userParam, workspaceId)");
  assert.ok(membership >= 0 && membership < compile);
  assert.match(route, /eq\(workspaceMembers\.userId, userParam\)/);
  assert.match(route, /eq\(workspaceMembers\.workspaceId, workspaceId\)/);
  assert.doesNotMatch(route, /first\?\.workspaceId \?\? "ws-legacy"/);
});

test("weekly digest cron requires a current user/workspace membership tuple", () => {
  const route = read("src\\app\\api\\cron\\weekly-digest\\route.ts");
  const membership = route.indexOf("const [membership]");
  const snapshot = route.indexOf("buildWeeklySnapshotFor(overrideWorkspace)");
  assert.ok(membership >= 0 && membership < snapshot);
  assert.match(route, /eq\(workspaceMembers\.userId, overrideUser\)/);
  assert.match(route, /eq\(workspaceMembers\.workspaceId, overrideWorkspace\)/);
  assert.match(route, /!overrideWorkspace \|\| !overrideUser/);
});

test("comp-code failures never attach the bearer value to Sentry", () => {
  const comp = read("src\\server\\actions\\comp.ts");
  const capture = comp.match(/Sentry\.captureException\([\s\S]*?\);/)?.[0] ?? "";
  assert.ok(capture, "missing comp-code error capture");
  assert.match(capture, /action: "redeem-comp-code"/);
  assert.doesNotMatch(capture, /code:/);
});

test("error routes return stable codes without raw exception messages", () => {
  const deletion = read("src\\app\\api\\account\\delete\\route.ts");
  const reconcile = read("src\\app\\api\\internal\\reconcile-entitlements\\route.ts");
  assert.doesNotMatch(deletion, /message\s*}/);
  assert.match(deletion, /{ error: "delete_failed" }/);
  assert.doesNotMatch(reconcile, /err instanceof Error \? err\.message/);
  assert.match(reconcile, /error: "reconcile-failed"/);
});

test("cost-bearing rate limits fail closed in production", () => {
  const limiter = read("src\\lib\\ratelimit.ts");
  assert.match(limiter, /unavailableDecision = process\.env\.NODE_ENV !== "production"/);
  assert.doesNotMatch(limiter, /if \(!url \|\| !token\) return true/);
  assert.doesNotMatch(limiter, /catch \{\s*return true/);
});

test("analytics capture is bounded, allowlisted and rate limited", () => {
  const route = read("src\\app\\api\\analytics\\capture\\route.ts");
  assert.match(route, /MAX_BODY_BYTES = 8 \* 1024/);
  assert.match(route, /allow\("analytics", limiterId, 60, "1 m"\)/);
  assert.match(route, /ALLOWED_EVENTS\.has\(event\)/);
  assert.match(route, /ALLOWED_PROPERTIES\.has\(k\)/);
  assert.doesNotMatch(route, /props\[k\] = String\(v\)/);
  assert.doesNotMatch(route, /"workspace_id"/);
  assert.doesNotMatch(route, /"secondary_context"/);
});

test("student-code issuance is throttled and proves mailbox control", () => {
  const comp = read("src\\server\\actions\\comp.ts");
  const start = comp.indexOf("export async function requestStudentCodeAction");
  const action = comp.slice(start);
  assert.match(action, /allow\("student-code", emailKey, 3, "1 h"\)/);
  assert.match(action, /const delivery = await sendEmail/);
  assert.match(action, /if \(!delivery\.ok\)/);
  assert.doesNotMatch(action, /return \{ ok: true, code/);
});
