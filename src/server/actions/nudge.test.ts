import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { and, eq } from "drizzle-orm";
import { freshMemoryDb } from "../db/memory-test-db";
import { activities, notificationPrefs, notifications, tasks, users, workspaceMembers, workspaces } from "../db/schema";

/**
 * The nudge action against the real schema, in a disposable in-memory
 * database. The action file itself is loaded, with only its outside edges
 * replaced: who is signed in, the access mode, the Project capability proof
 * and the email sender. Nothing here touches a configured database or sends
 * anything.
 */

const require = createRequire(import.meta.url);
const root = process.cwd();

type Sent = { to: string; subject: string; html: string; text: string };

async function fixture(options: { demo?: boolean; actor?: string } = {}) {
  const local = await freshMemoryDb();
  const person = (id: string, name: string | null, email: string) =>
    local.db.insert(users).values({ id, clerkId: id, handle: id, name, email, initials: "FX", color: "fixture" });
  await person("orla", "Orla Byrne", "orla@example.test");
  await person("aoife", "Aoife Brennan", "aoife@example.test");
  await person("tom", null, "tom.reilly@example.test"); // no name: shown by handle
  await person("former", "Former Member", "former@example.test");

  await local.db.insert(workspaces).values([
    { id: "p-a", slug: "p-a", name: "p-a", ownerUserId: "orla" },
    { id: "p-b", slug: "p-b", name: "p-b", ownerUserId: "former" },
  ]);
  // "former" was removed from p-a and is still a member of p-b.
  await local.db.insert(workspaceMembers).values([
    { workspaceId: "p-a", userId: "orla", role: "owner" },
    { workspaceId: "p-a", userId: "aoife", role: "member" },
    { workspaceId: "p-a", userId: "tom", role: "member" },
    { workspaceId: "p-b", userId: "former", role: "owner" },
  ]);
  const task = (id: string, title: string, assignees: string[]) =>
    local.db.insert(tasks).values({ id, workspaceId: "p-a", title, lane: "todo", priority: "p2", assignees });
  await task("t-mixed", "Book the band", ["orla", "former", "aoife", "tom"]);
  await task("t-former", "Order the marquee", ["former"]);
  await task("t-mine", "Chase the florist", ["orla"]);

  const sent: Sent[] = [];
  const state = { demo: options.demo ?? false, actor: options.actor ?? "orla" };
  const cache = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    if (cache.has(file)) return cache.get(file)!;
    const exports: Record<string, unknown> = {};
    cache.set(file, exports);
    const boundaries: Record<string, unknown> = {
      "server-only": {},
      "@/server/db": { db: local.db },
      "./index": { db: local.db },
      "@/server/auth": { getCurrentUser: async () => state.actor },
      "@/lib/access-mode": { isDemoMode: () => state.demo },
      "@/server/email": {
        emailConfigured: true,
        sendEmail: async (message: Sent) => {
          sent.push(message);
        },
      },
      // The capability proof has its own tests. Here it is the plain rule it
      // enforces for this action: the caller is a member of the task's Project.
      "@/server/actions/project-authz": {
        scopeForTask: async (taskId: string, actor: string) => {
          const [target] = await local.db.select({ ws: tasks.workspaceId }).from(tasks).where(eq(tasks.id, taskId));
          if (!target?.ws) return { ok: false, reason: "no-such-task" };
          const [member] = await local.db
            .select({ userId: workspaceMembers.userId })
            .from(workspaceMembers)
            .where(and(eq(workspaceMembers.workspaceId, target.ws), eq(workspaceMembers.userId, actor)));
          return member ? { ok: true, ws: target.ws } : { ok: false, reason: "refused" };
        },
      },
    };
    const injected: Record<string, string> = { "@/server/db/activity": "src/server/db/activity.ts" };
    const actual = new Set(["drizzle-orm", "./schema", "@/server/db/schema", "@/lib/product-urls", "@/lib/user-display-name"]);
    const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, {
      exports,
      Date,
      console,
      require: (id: string) => {
        if (Object.hasOwn(boundaries, id)) return boundaries[id];
        if (Object.hasOwn(injected, id)) return load(injected[id]!);
        assert.ok(actual.has(id), `Unexpected nudge fixture import ${id}`);
        return require(id === "./schema" ? resolve(root, "src/server/db/schema.ts") : id.startsWith("@/") ? resolve(root, "src", id.slice(2)) : id);
      },
    });
    return exports;
  }
  const { sendNudgeAction } = load("src/server/actions/nudge.ts") as unknown as typeof import("./nudge");

  const notified = async () => (await local.db.select({ userId: notifications.userId }).from(notifications)).map((row) => row.userId).sort();
  const audited = async () =>
    (await local.db.select({ payload: activities.payload }).from(activities).where(eq(activities.kind, "nudgeSent")))
      .map((row) => (row.payload as { toUserId: string }).toUserId)
      .sort();
  const emailed = () => sent.map((message) => message.to).sort();
  return { ...local, state, sent, sendNudgeAction, notified, audited, emailed };
}

/** Results cross a vm boundary, so compare them as plain data. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test("a removed member still listed as an assignee is not notified, emailed or named", async () => {
  const f = await fixture();
  const result = plain(await f.sendNudgeAction("t-mixed"));

  assert.deepEqual(result, {
    ok: true,
    nudgedCount: 2,
    lastNudgedAt: null,
    nudged: [
      { id: "aoife", name: "Aoife Brennan" },
      { id: "tom", name: "tom" },
    ],
    alreadyNudged: [],
  });
  // Current members are reached; the caller and the removed member are not.
  assert.deepEqual(await f.notified(), ["aoife", "tom"]);
  assert.deepEqual(f.emailed(), ["aoife@example.test", "tom.reilly@example.test"]);
  assert.deepEqual(await f.audited(), ["aoife", "tom"]);
  assert.ok(!JSON.stringify(result).includes("former"));
  assert.ok(f.sent.every((message) => message.subject.includes("Orla Byrne") && message.subject.includes("Book the band")));
});

test("a task whose only other assignee was removed answers exactly like one with nobody else on it", async () => {
  const f = await fixture();
  const removedOnly = plain(await f.sendNudgeAction("t-former"));
  const selfOnly = plain(await f.sendNudgeAction("t-mine"));

  assert.deepEqual(removedOnly, { ok: false, reason: "No other assignee to nudge." });
  assert.deepEqual(removedOnly, selfOnly);
  assert.deepEqual(await f.notified(), []);
  assert.deepEqual(await f.audited(), []);
  assert.deepEqual(f.emailed(), []);
});

test("a second nudge the same day reaches nobody and says who had already been nudged", async () => {
  const f = await fixture();
  await f.sendNudgeAction("t-mixed");
  const again = plain(await f.sendNudgeAction("t-mixed"));

  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.nudgedCount, 0);
  assert.deepEqual(again.nudged, []);
  assert.deepEqual(again.alreadyNudged.map((person) => person.id), ["aoife", "tom"]);
  assert.equal(typeof again.lastNudgedAt, "string");
  assert.deepEqual(await f.notified(), ["aoife", "tom"]);
  assert.equal(f.sent.length, 2);
});

test("when one assignee was nudged earlier, the result lists only the people this call reached", async () => {
  const f = await fixture();
  await f.db.insert(activities).values({
    id: "a-earlier",
    workspaceId: "p-a",
    taskId: "t-mixed",
    userId: "orla",
    kind: "nudgeSent",
    payload: { kind: "nudgeSent", toUserId: "aoife" },
    createdAt: new Date(Date.now() - 3_600_000),
  });
  const result = plain(await f.sendNudgeAction("t-mixed"));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.nudged, [{ id: "tom", name: "tom" }]);
  assert.deepEqual(result.alreadyNudged, [{ id: "aoife", name: "Aoife Brennan" }]);
  assert.equal(result.nudgedCount, 1);
  assert.equal(result.lastNudgedAt, null);
  assert.deepEqual(await f.notified(), ["tom"]);
  assert.deepEqual(f.emailed(), ["tom.reilly@example.test"]);
});

test("a member who muted nudges is counted, audited and left alone", async () => {
  const f = await fixture();
  await f.db.insert(notificationPrefs).values({ userId: "tom", nudges: false });
  const result = plain(await f.sendNudgeAction("t-mixed"));

  assert.equal(result.ok && result.nudgedCount, 2);
  assert.deepEqual(await f.notified(), ["aoife"]);
  assert.deepEqual(f.emailed(), ["aoife@example.test"]);
  assert.deepEqual(await f.audited(), ["aoife", "tom"]);
});

test("someone outside the project cannot nudge its task", async () => {
  const f = await fixture({ actor: "former" });
  const result = plain(await f.sendNudgeAction("t-mixed"));

  assert.deepEqual(result, { ok: false, reason: "Task not found in active workspace." });
  assert.deepEqual(await f.notified(), []);
  assert.deepEqual(f.emailed(), []);
});

test("demo mode returns before anything is read or sent", async () => {
  const f = await fixture({ demo: true });
  const result = plain(await f.sendNudgeAction("t-mixed"));

  assert.deepEqual(result, { ok: false, reason: "demo" });
  assert.deepEqual(await f.notified(), []);
  assert.deepEqual(await f.audited(), []);
  assert.deepEqual(f.emailed(), []);
});
