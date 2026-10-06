import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { eq, inArray, like } from "drizzle-orm";
import { freshFileDb } from "../db/memory-test-db";
import {
  activities,
  comments,
  conversationOutbox,
  entitlements,
  meta,
  notifications,
  pendingInvites,
  resources,
  shareLinks,
  suiteOutbox,
  taskCommentOutbox,
  tasks,
  users,
  workspaceMembers,
  workspaceSponsorships,
  workspaces,
} from "../db/schema";
import {
  SAMPLE_NAME_MARKER,
  SAMPLE_SET_IDS,
  assertSampleSetWithinLimits,
  sampleProjectDescription,
  sampleProjectName,
  summariseSampleSet,
  type SampleSetId,
} from "../../lib/sample-data/model";
import { SAMPLE_SETS } from "../../lib/sample-data/sets";
import { addConfirmation, removeAllConfirmation, removeConfirmation, seedOutcome } from "../../lib/sample-data/copy";

/**
 * Operator sample data against the real schema, in a disposable database.
 *
 * The seeder and the Project deletion service are the real modules. The only
 * replaced edges are the ones a test must own: the database handle, who is
 * signed in, the access mode, and the email sender, which is swapped for a
 * counter before anything loads so a single call from anywhere would show.
 */

const require = createRequire(import.meta.url);
const root = process.cwd();
const NOW = new Date("2026-10-05T10:30:00.000Z");

const emailCalls: unknown[] = [];
let seeder: typeof import("./seeder");
let deletion: typeof import("../connections/project-drive-project-deletion");

before(async () => {
  // Bind the app's own database module to its process-local empty store, the
  // same way the template tests do. Every write below goes to the fixture
  // database passed in explicitly.
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  process.env.ADMIN_USER_IDS = "operator, second-operator";

  // The email sender, replaced before the seeder's module graph loads. Any
  // module that reaches for it gets this counter instead of Resend.
  const emailPath = require.resolve(resolve(root, "src/server/email.ts"));
  const stub = {
    emailConfigured: true,
    sendEmail: async (message: unknown) => {
      emailCalls.push(message);
      return { ok: true };
    },
    digestEmailHtml: () => "",
  };
  require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: stub } as unknown as NodeJS.Module;

  seeder = await import("./seeder");
  deletion = await import("../connections/project-drive-project-deletion");
});

const disposals: Array<() => void> = [];
after(() => {
  for (const dispose of disposals.splice(0)) dispose();
});

const SENDER_TABLES = {
  notifications,
  comments,
  pendingInvites,
  shareLinks,
  suiteOutbox,
  taskCommentOutbox,
  conversationOutbox,
  entitlements,
  workspaceSponsorships,
} as const;

/**
 * One database file for the whole run, emptied before each test. Opening and
 * closing a libSQL file per test can take the process down on Windows as it
 * exits, so there is a single client and a single close.
 */
let shared: Awaited<ReturnType<typeof freshFileDb>> | null = null;
async function fixture() {
  if (!shared) {
    shared = await freshFileDb();
    disposals.push(shared.cleanup);
  }
  const local = shared;
  await local.client.execute("DROP TRIGGER IF EXISTS fail_sample");
  const tables = await local.client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
  // One script on one connection: the wipe is not a cascade, it empties every table.
  await local.client.executeMultiple(
    ["PRAGMA foreign_keys = OFF", ...tables.rows.map((row) => `DELETE FROM "${String(row.name)}"`)].join("; ") + ";",
  );
  for (const id of ["operator", "second-operator", "member", "stranger"]) {
    await local.db.insert(users).values({ id, clerkId: id, handle: id, name: id, email: `${id}@example.test`, initials: "FX", color: "fixture" });
  }
  const deleted: string[] = [];
  const deps = (actorUserId = "operator") => ({
    database: local.db,
    actorUserId,
    now: () => NOW,
    // The product's deletion service, on the fixture database. It re-proves
    // primary ownership itself; no Drive grant exists to revoke.
    deleteProject: async (input: { actorUserId: string; projectId: string }) => {
      deleted.push(input.projectId);
      return deletion
        .createProjectDriveProjectDeletionService({
          database: local.db as never,
          revokeExactGrant: async () => {
            throw new Error("no Drive grant should exist for sample data");
          },
        })
        .delete({ workspaceId: input.projectId, actorUserId: input.actorUserId });
    },
  });
  const counts = async () => ({
    workspaces: (await local.db.select({ id: workspaces.id }).from(workspaces)).length,
    members: (await local.db.select({ id: workspaceMembers.workspaceId }).from(workspaceMembers)).length,
    tasks: (await local.db.select({ id: tasks.id }).from(tasks)).length,
    activities: (await local.db.select({ id: activities.id }).from(activities)).length,
    resources: (await local.db.select({ id: resources.id }).from(resources)).length,
    meta: (await local.db.select({ key: meta.key }).from(meta)).length,
  });
  const senderRows = async () => {
    const out: Record<string, number> = {};
    for (const [name, table] of Object.entries(SENDER_TABLES)) {
      out[name] = (await local.db.select().from(table)).length;
    }
    return out;
  };
  return { ...local, cleanup: () => undefined, deps, deleted, counts, senderRows };
}

const NOTHING_SENT = Object.fromEntries(Object.keys(SENDER_TABLES).map((name) => [name, 0]));

function expectedIds(actor: string, setId: SampleSetId): string[] {
  return SAMPLE_SETS[setId].projects.map((project) => seeder.sampleProjectId(actor, setId, project.key));
}

// ── Content ──────────────────────────────────────────────────────────

test("the three sets are bounded, plainly written and cover every status and every kind of date", () => {
  let rows = 0;
  for (const setId of SAMPLE_SET_IDS) {
    const set = SAMPLE_SETS[setId];
    assertSampleSetWithinLimits(set);
    const summary = summariseSampleSet(set);
    rows += summary.tasks + summary.steps;
    for (const status of ["todo", "doing", "review", "waiting", "done"] as const) {
      assert.ok(summary.byStatus[status] > 0, `${setId} has no ${status} task`);
    }
    for (const project of set.projects) {
      assert.ok(sampleProjectName(project).endsWith(`· ${SAMPLE_NAME_MARKER}`));
      const description = sampleProjectDescription(set, project);
      assert.ok(description.includes(set.name) && description.length <= 200);
      const open = project.tasks.filter((task) => task.status !== "done" && task.due !== null);
      assert.ok(open.some((task) => task.due! < 0), `${project.key} has nothing late`);
      assert.ok(open.some((task) => task.due === 0), `${project.key} has nothing due today`);
      assert.ok(open.some((task) => task.due! > 0 && task.due! <= 6), `${project.key} has nothing due this week`);
      assert.ok(open.some((task) => task.due! > 6), `${project.key} has nothing later`);
      assert.ok(project.tasks.some((task) => task.status === "done"), `${project.key} has nothing done`);
      assert.ok(project.tasks.some((task) => task.bigDate), `${project.key} has no big date`);
      const words = [
        project.name, project.about, project.mainDate?.label ?? "",
        ...project.labels.map((label) => label.name),
        ...project.tasks.flatMap((task) => [task.title, task.notes ?? "", task.link?.title ?? "", ...(task.steps ?? []).map((step) => step.title)]),
      ].filter(Boolean);
      for (const text of words) {
        assert.ok(!/[!\u{2014}\u{2013}]/u.test(text),`"${text}" uses an exclamation mark or a dash`);
        assert.ok(!/@|https?:/i.test(text), `"${text}" carries an address`);
        assert.match(text, /^[A-Z0-9]/, `"${text}" does not start with a capital`);
        // Sentence case: after the first word, only names and initialisms are capitalised.
        assert.ok(text.split(" ").slice(1).filter((word) => /^[A-Z][a-z]/.test(word)).length <= 3, `"${text}" reads as title case`);
      }
    }
  }
  assert.ok(rows >= 200 && rows <= 400, `a few hundred rows in total, not ${rows}`);
});

test("the teacher set has five projects of 12 to 25 tasks, the student set six modules with two assignments and two exams each", () => {
  const teacher = SAMPLE_SETS.teacher;
  assert.equal(teacher.projects.length, 5);
  for (const project of teacher.projects) {
    assert.ok(project.tasks.length >= 12 && project.tasks.length <= 25, `${project.key}: ${project.tasks.length}`);
  }
  const student = SAMPLE_SETS.student;
  assert.equal(student.projects.length, 6);
  const bigDateDays: number[] = [];
  for (const project of student.projects) {
    const big = project.tasks.filter((task) => task.bigDate);
    assert.equal(big.length, 4, project.key);
    assert.equal(big.filter((task) => task.labels?.includes("Assignment")).length, 2, project.key);
    assert.equal(big.filter((task) => task.labels?.includes("Exam")).length, 2, project.key);
    bigDateDays.push(...big.map((task) => task.due!));
  }
  assert.equal(summariseSampleSet(student).bigDates, 24);
  // Some weeks collide: at least one seven-day window holds three or more.
  assert.ok(bigDateDays.some((day) => bigDateDays.filter((other) => other >= day && other < day + 7).length >= 3));
  assert.equal(SAMPLE_SETS.wedding.projects.length, 4);
  assert.ok(SAMPLE_SETS.wedding.projects.flatMap((project) => project.tasks).filter((task) => task.euros).length >= 15);
});

// ── Seed ─────────────────────────────────────────────────────────────

for (const setId of SAMPLE_SET_IDS) {
  test(`adding the ${setId} set creates its projects and tasks, owned by and scoped to the operator, and sends nothing`, async () => {
    const f = await fixture();
    try {
      const summary = summariseSampleSet(SAMPLE_SETS[setId]);
      const result = await seeder.seedSampleSet(f.deps(), setId);
      assert.deepEqual(result, {
        ok: true, set: setId, created: summary.projectNames, alreadyPresent: [],
        tasks: summary.tasks, steps: summary.steps, links: summary.links,
      });

      const ids = expectedIds("operator", setId);
      const projects = await f.db.select().from(workspaces);
      assert.deepEqual(projects.map((project) => project.id).sort(), [...ids].sort());
      for (const project of projects) {
        assert.equal(project.ownerUserId, "operator");
        assert.equal(project.publishedAt, null);
        assert.equal(project.archivedAt, null);
        assert.equal(project.planningPeriodId, null);
        assert.equal(project.templateId, null);
        assert.ok(project.name.endsWith("· sample"));
        assert.ok(project.description?.startsWith(`Sample data: ${SAMPLE_SETS[setId].name}.`));
      }
      // The only member of every sample project is its owner, the operator.
      assert.deepEqual(
        (await f.db.select().from(workspaceMembers)).map((member) => [member.userId, member.role]),
        ids.map(() => ["operator", "owner"]),
      );

      const rows = await f.db.select().from(tasks);
      assert.equal(rows.length, summary.tasks + summary.steps);
      const top = rows.filter((row) => row.parentTaskId === null);
      assert.equal(top.length, summary.tasks);
      for (const row of rows) {
        assert.ok(ids.includes(row.workspaceId!), "every task belongs to a sample project");
        assert.ok(row.assignees.every((assignee) => assignee === "operator"), "assignees are the operator or nobody");
        assert.equal(row.externalContactEmail, null);
        assert.equal(row.externalContactName, null);
        assert.equal(row.sourceNoteId, null);
        assert.equal(row.archivedAt, null);
        assert.ok(row.seq !== null && row.position !== null);
        // Done is honest: finished at the moment of creation, never backdated.
        assert.equal(row.completedAt?.getTime() ?? null, row.lane === "done" ? NOW.getTime() : null);
        assert.equal(row.createdAt.getTime() > 0, true);
      }
      // Per-project task numbers are unique and gap-free.
      for (const id of ids) {
        const seqs = rows.filter((row) => row.workspaceId === id).map((row) => row.seq!).sort((a, b) => a - b);
        assert.deepEqual(seqs, seqs.map((_, index) => index + 1));
      }
      assert.equal(top.filter((row) => row.isMilestone).length, summary.bigDates);
      assert.equal(top.filter((row) => row.boardColumnKey === "waiting" && row.lane === "doing").length, summary.byStatus.waiting);
      assert.equal(top.filter((row) => row.lane === "done").length, summary.byStatus.done);
      assert.equal(top.filter((row) => row.lane === "review").length, summary.byStatus.review);
      assert.equal(top.filter((row) => row.lane === "todo").length, summary.byStatus.todo);
      // Dates count from the run day: something late, something today.
      const today = Date.parse("2026-10-05T00:00:00.000Z");
      assert.ok(top.some((row) => row.lane !== "done" && row.dueAt && row.dueAt.getTime() < today));
      assert.ok(top.some((row) => row.dueAt?.getTime() === today && row.due === "Today"));

      // One audit entry per task, authored by the operator, in the task's project.
      const events = await f.db.select().from(activities);
      assert.equal(events.filter((event) => event.kind === "taskAdd").length, rows.length);
      assert.equal(events.filter((event) => event.kind === "resourceAdd").length, summary.links);
      assert.ok(events.every((event) => event.userId === "operator" && ids.includes(event.workspaceId!)));

      const links = await f.db.select().from(resources);
      assert.equal(links.length, summary.links);
      assert.ok(links.every((link) => link.kind === "link" && link.url?.startsWith("https://example.com/sample/") && link.addedByUserId === "operator" && ids.includes(link.workspaceId)));

      // Every project carries the mark and a label registry in its own namespace.
      for (const id of ids) {
        const [mark] = await f.db.select().from(meta).where(eq(meta.key, `board:${id}:sample-set`));
        assert.equal(JSON.parse(mark.value).set, setId);
        assert.equal(JSON.parse(mark.value).by, "operator");
        const [tags] = await f.db.select().from(meta).where(eq(meta.key, `board:${id}:tags`));
        assert.ok(JSON.parse(tags.value).length >= 3);
      }
      // No lease is left behind, and no meta row lives outside a sample project.
      const metaRows = await f.db.select().from(meta);
      assert.ok(metaRows.every((row) => ids.some((id) =>
        row.key.startsWith(`board:${id}:`) || row.key === `project-status:${id}` || row.key === `project-target-date:${id}`)));
      // Every project has a target date the Timeline can read, on its main date.
      for (const project of projects) {
        const [target] = await f.db.select().from(meta).where(eq(meta.key, `project-target-date:${project.id}`));
        assert.equal(target.value, project.primaryDate);
      }
      const statuses = (await f.db.select().from(meta).where(like(meta.key, "project-status:%"))).map((row) => row.value);
      assert.ok(statuses.length >= 3 && statuses.every((value) => ["on-track", "at-risk", "paused", "complete"].includes(value)));
      assert.ok(!metaRows.some((row) => row.key.endsWith(":sample-run")));

      assert.deepEqual(await f.senderRows(), NOTHING_SENT);
      assert.equal(emailCalls.length, 0);
      assert.deepEqual(f.deleted, []);
    } finally {
      f.cleanup();
    }
  });
}

test("the wedding set carries amounts in cents, a euro budget and a main date counted from the run day", async () => {
  const f = await fixture();
  try {
    await seeder.seedSampleSet(f.deps(), "wedding");
    const [wedding] = await f.db.select().from(workspaces).where(eq(workspaces.id, seeder.sampleProjectId("operator", "wedding", "the-wedding")));
    assert.equal(wedding.currency, "EUR");
    assert.equal(wedding.budgetCents, 2_800_000);
    assert.equal(wedding.primaryDate, "2026-12-19");
    assert.equal(wedding.primaryDateLabel, "The day");
    assert.equal(wedding.activeDomain, "wedding");
    const [status] = await f.db.select().from(meta).where(eq(meta.key, `project-status:${wedding.id}`));
    assert.equal(status.value, "on-track");
    const rows = await f.db.select().from(tasks).where(eq(tasks.workspaceId, wedding.id));
    const venue = rows.find((row) => row.title === "Final payment to the venue")!;
    assert.equal(venue.cents, 950_000);
    assert.deepEqual(venue.tags, ["Venue"]);
    const day = rows.find((row) => row.title === "The day")!;
    assert.equal(day.isMilestone, true);
    assert.equal(day.dueAt?.toISOString(), "2026-12-19T00:00:00.000Z");
    const invitations = rows.find((row) => row.title === "Send invitations")!;
    const steps = rows.filter((row) => row.parentTaskId === invitations.id);
    assert.deepEqual(steps.map((step) => step.lane).sort(), ["done", "done", "todo", "todo"]);
    assert.deepEqual(invitations.assignees, ["operator"]);
  } finally {
    f.cleanup();
  }
});

test("a second run creates nothing new", async () => {
  const f = await fixture();
  try {
    await seeder.seedSampleSet(f.deps(), "teacher");
    const first = await f.counts();
    const again = await seeder.seedSampleSet(f.deps(), "teacher");
    assert.deepEqual(again, {
      ok: true, set: "teacher", created: [],
      alreadyPresent: summariseSampleSet(SAMPLE_SETS.teacher).projectNames,
      tasks: 0, steps: 0, links: 0,
    });
    assert.deepEqual(await f.counts(), first);
    // A later day does not re-date or duplicate what is already there.
    await seeder.seedSampleSet({ ...f.deps(), now: () => new Date("2026-11-20T09:00:00.000Z") }, "teacher");
    assert.deepEqual(await f.counts(), first);
    assert.equal(seedOutcome(again).title, "Already added");
  } finally {
    f.cleanup();
  }
});

test("two operators each get their own projects and cannot see or remove the other's", async () => {
  const f = await fixture();
  try {
    await seeder.seedSampleSet(f.deps("operator"), "wedding");
    await seeder.seedSampleSet(f.deps("second-operator"), "wedding");
    const mine = expectedIds("operator", "wedding");
    const theirs = expectedIds("second-operator", "wedding");
    assert.equal(mine.some((id) => theirs.includes(id)), false);
    const status = await seeder.listSampleData({ database: f.db, actorUserId: "second-operator" });
    assert.deepEqual(status.find((set) => set.summary.id === "wedding")!.present.map((project) => project.id), theirs);

    const removed = await seeder.removeSampleSet(f.deps("second-operator"), "wedding");
    assert.equal(removed.ok && removed.removed.length, 4);
    assert.deepEqual((await f.db.select({ id: workspaces.id }).from(workspaces)).map((row) => row.id).sort(), [...mine].sort());
    assert.deepEqual([...f.deleted].sort(), [...theirs].sort());
  } finally {
    f.cleanup();
  }
});

// ── Remove ───────────────────────────────────────────────────────────

test("removal deletes exactly the marked sample rows and leaves every real project untouched", async () => {
  const f = await fixture();
  try {
    // Real work that must survive: the operator's own project, a project that
    // only looks like a sample by name, and somebody else's project.
    await f.db.insert(workspaces).values([
      { id: "ws-real", slug: "ws-real", name: "Autumn launch", ownerUserId: "operator" },
      { id: "ws-lookalike", slug: "ws-lookalike", name: "Sports day · sample", ownerUserId: "operator", description: "Sample data: secondary school teacher. Mine." },
      { id: "ws-other", slug: "ws-other", name: "Stranger project", ownerUserId: "stranger" },
    ]);
    await f.db.insert(workspaceMembers).values([
      { workspaceId: "ws-real", userId: "operator", role: "owner" },
      { workspaceId: "ws-real", userId: "member", role: "member" },
      { workspaceId: "ws-lookalike", userId: "operator", role: "owner" },
      { workspaceId: "ws-other", userId: "stranger", role: "owner" },
    ]);
    await f.db.insert(tasks).values([
      { id: "t-real-1", workspaceId: "ws-real", seq: 1, title: "Write the launch note", lane: "todo", priority: "p1", assignees: ["operator", "member"] },
      { id: "t-real-2", workspaceId: "ws-real", seq: 2, title: "Book the room", lane: "done", priority: "p2", assignees: [] },
      { id: "t-look-1", workspaceId: "ws-lookalike", seq: 1, title: "Order medals and ribbons", lane: "doing", priority: "p2", assignees: [] },
      { id: "t-other-1", workspaceId: "ws-other", seq: 1, title: "Private to the stranger", lane: "todo", priority: "p2", assignees: ["stranger"] },
    ]);
    await f.db.insert(activities).values({ id: "a-real", workspaceId: "ws-real", taskId: "t-real-1", userId: "operator", kind: "taskAdd", payload: { kind: "taskAdd", lane: "todo" } });
    await f.db.insert(resources).values({ id: "res-real", workspaceId: "ws-real", taskId: "t-real-1", kind: "link", provider: "url", title: "Brief", url: "https://example.com/brief", addedAt: 1 });
    await f.db.insert(meta).values([
      { key: "project-status:ws-real", value: "at-risk" },
      { key: "project-target-date:ws-real", value: "2026-11-30" },
      { key: "board:ws-real:tags", value: "[]" },
      { key: "board:ws-real:columns", value: "{}" },
      { key: "board:ws-lookalike:name", value: "Mine" },
    ]);
    const realBefore = {
      workspaces: await f.db.select().from(workspaces).where(inArray(workspaces.id, ["ws-real", "ws-lookalike", "ws-other"])),
      members: await f.db.select().from(workspaceMembers).where(inArray(workspaceMembers.workspaceId, ["ws-real", "ws-lookalike", "ws-other"])),
      tasks: await f.db.select().from(tasks).where(inArray(tasks.workspaceId, ["ws-real", "ws-lookalike", "ws-other"])),
      activities: await f.db.select().from(activities).where(eq(activities.workspaceId, "ws-real")),
      resources: await f.db.select().from(resources).where(eq(resources.workspaceId, "ws-real")),
      meta: await f.db.select().from(meta).where(like(meta.key, "board:ws-%")).then((rows) => rows.filter((row) => !row.key.startsWith("board:ws-sample-"))),
    };
    const baseline = await f.counts();

    for (const setId of SAMPLE_SET_IDS) await seeder.seedSampleSet(f.deps(), setId);
    const sampleIds = SAMPLE_SET_IDS.flatMap((setId) => expectedIds("operator", setId));
    assert.equal((await f.counts()).workspaces, baseline.workspaces + 15);

    // One set first: only its projects go.
    const teacher = await seeder.removeSampleSet(f.deps(), "teacher");
    assert.deepEqual(teacher, { ok: true, set: "teacher", removed: summariseSampleSet(SAMPLE_SETS.teacher).projectNames.slice(1).concat(summariseSampleSet(SAMPLE_SETS.teacher).projectNames[0]) });
    assert.deepEqual([...f.deleted].sort(), [...expectedIds("operator", "teacher")].sort());
    assert.equal((await f.counts()).workspaces, baseline.workspaces + 10);

    // Then everything that is left.
    const rest = await seeder.removeAllSampleData(f.deps());
    assert.deepEqual(rest.map((result) => [result.set, result.ok, result.removed.length]), [["teacher", true, 0], ["student", true, 6], ["wedding", true, 4]]);
    // The deletion path was only ever asked to delete marked sample projects.
    assert.deepEqual([...f.deleted].sort(), [...sampleIds].sort());

    assert.deepEqual(await f.counts(), baseline);
    assert.deepEqual(await f.db.select().from(workspaces).where(inArray(workspaces.id, ["ws-real", "ws-lookalike", "ws-other"])), realBefore.workspaces);
    assert.deepEqual(await f.db.select().from(workspaceMembers).where(inArray(workspaceMembers.workspaceId, ["ws-real", "ws-lookalike", "ws-other"])), realBefore.members);
    assert.deepEqual(await f.db.select().from(tasks).where(inArray(tasks.workspaceId, ["ws-real", "ws-lookalike", "ws-other"])), realBefore.tasks);
    assert.deepEqual(await f.db.select().from(activities).where(eq(activities.workspaceId, "ws-real")), realBefore.activities);
    assert.deepEqual(await f.db.select().from(resources).where(eq(resources.workspaceId, "ws-real")), realBefore.resources);
    assert.deepEqual(await f.db.select().from(meta).where(like(meta.key, "board:ws-%")), realBefore.meta);
    assert.equal((await f.db.select().from(meta).where(like(meta.key, "%ws-sample-%"))).length, 0);
    assert.deepEqual(
      (await f.db.select({ key: meta.key, value: meta.value }).from(meta).where(like(meta.key, "project-%:ws-real"))).sort((a, b) => a.key.localeCompare(b.key)),
      [{ key: "project-status:ws-real", value: "at-risk" }, { key: "project-target-date:ws-real", value: "2026-11-30" }],
    );
    assert.equal(emailCalls.length, 0);
    assert.deepEqual(await f.senderRows(), NOTHING_SENT);

    // And the sets can be added again afterwards.
    const again = await seeder.seedSampleSet(f.deps(), "teacher");
    assert.equal(again.ok && again.created.length, 5);
  } finally {
    f.cleanup();
  }
});

test("a removal interrupted after the project was deleted is finished by the next one", async () => {
  const f = await fixture();
  try {
    await seeder.seedSampleSet(f.deps(), "wedding");
    const [first] = expectedIds("operator", "wedding");
    // The deletion path ran but the process stopped before the status and
    // target date rows, which it does not own, were removed.
    await f.deps().deleteProject({ actorUserId: "operator", projectId: first });
    assert.equal((await f.db.select().from(meta).where(like(meta.key, `project-%:${first}`))).length, 2);
    const removed = await seeder.removeSampleSet(f.deps(), "wedding");
    assert.equal(removed.ok && removed.removed.length, 3);
    assert.deepEqual(await f.counts(), { workspaces: 0, members: 0, tasks: 0, activities: 0, resources: 0, meta: 0 });
  } finally {
    f.cleanup();
  }
});

test("a project sitting on a sample id without the mark is never added to and never removed", async () => {
  const f = await fixture();
  try {
    const [squatId, ...others] = expectedIds("operator", "wedding");
    await f.db.insert(workspaces).values({ id: squatId, slug: "squat", name: "The wedding · sample", ownerUserId: "operator" });
    await f.db.insert(workspaceMembers).values({ workspaceId: squatId, userId: "operator", role: "owner" });
    await f.db.insert(tasks).values({ id: "t-squat", workspaceId: squatId, seq: 1, title: "Keep me", lane: "todo", priority: "p2", assignees: [] });
    // A mark for a different operator, set or key does not count either.
    await f.db.insert(meta).values([
      { key: `board:${squatId}:sample-set`, value: JSON.stringify({ v: 1, set: "wedding", project: "the-wedding", by: "second-operator" }) },
      { key: `project-status:${squatId}`, value: "paused" },
    ]);

    const seeded = await seeder.seedSampleSet(f.deps(), "wedding");
    assert.deepEqual(seeded, { ok: false, set: "wedding", reason: "failed", created: [], alreadyPresent: [], failedAt: "The wedding · sample" });
    assert.equal((await f.db.select().from(tasks)).length, 1);

    const status = await seeder.listSampleData({ database: f.db, actorUserId: "operator" });
    assert.deepEqual(status.find((set) => set.summary.id === "wedding")!.present, []);
    const removed = await seeder.removeSampleSet(f.deps(), "wedding");
    assert.deepEqual(removed, { ok: true, set: "wedding", removed: [] });
    assert.deepEqual(f.deleted, []);
    assert.equal((await f.db.select().from(workspaces)).length, 1);
    assert.equal((await f.db.select().from(meta).where(eq(meta.key, `project-status:${squatId}`))).length, 1);
    assert.equal(others.length, 3);
  } finally {
    f.cleanup();
  }
});

test("a failure part way leaves whole projects only, reports them, and a re-run finishes the set", async () => {
  const f = await fixture();
  try {
    const set = SAMPLE_SETS.teacher;
    const names = summariseSampleSet(set).projectNames;
    const third = seeder.sampleProjectId("operator", "teacher", set.projects[2].key);
    await f.client.execute(`CREATE TRIGGER fail_sample BEFORE INSERT ON tasks WHEN NEW.workspace_id = '${third}' AND NEW.seq = 9 BEGIN SELECT RAISE(ABORT, 'fixture task failure'); END`);
    const failed = await seeder.seedSampleSet(f.deps(), "teacher");
    assert.deepEqual(failed, { ok: false, set: "teacher", reason: "failed", created: names.slice(0, 2), alreadyPresent: [], failedAt: names[2] });
    // The failed project rolled back whole: no row, no member, no task, no mark.
    assert.equal((await f.db.select().from(workspaces)).length, 2);
    assert.equal((await f.db.select().from(tasks).where(eq(tasks.workspaceId, third))).length, 0);
    assert.equal((await f.db.select().from(meta).where(like(meta.key, `board:${third}:%`))).length, 0);
    assert.equal((await f.db.select().from(meta).where(like(meta.key, "%:sample-run"))).length, 0, "the lease is released after a failure");
    assert.equal(seedOutcome(failed).title, "Stopped part way");

    await f.client.execute("DROP TRIGGER fail_sample");
    const finished = await seeder.seedSampleSet(f.deps(), "teacher");
    assert.equal(finished.ok, true);
    assert.deepEqual(finished.created, names.slice(2));
    assert.deepEqual(finished.alreadyPresent, names.slice(0, 2));
    const summary = summariseSampleSet(set);
    assert.equal((await f.db.select().from(tasks)).length, summary.tasks + summary.steps);
  } finally {
    f.cleanup();
  }
});

test("one run per set at a time: a held lease refuses a second run and a removal, an expired one does not", async () => {
  const f = await fixture();
  try {
    await seeder.seedSampleSet(f.deps(), "student");
    const before = await f.counts();
    const anchor = expectedIds("operator", "student")[0];
    await f.db.insert(meta).values({ key: `board:${anchor}:sample-run`, value: JSON.stringify({ expiresAt: NOW.getTime() + 60_000 }) });

    const second = await seeder.seedSampleSet(f.deps(), "student");
    assert.equal(second.ok === false && second.reason, "busy");
    const removal = await seeder.removeSampleSet(f.deps(), "student");
    assert.deepEqual(removal, { ok: false, set: "student", reason: "busy", removed: [] });
    assert.deepEqual(f.deleted, []);
    assert.deepEqual(await f.counts(), { ...before, meta: before.meta + 1 });
    // The other sets are not held up by it.
    assert.equal((await seeder.seedSampleSet(f.deps(), "wedding")).ok, true);

    await f.db.update(meta).set({ value: JSON.stringify({ expiresAt: NOW.getTime() - 1 }) }).where(eq(meta.key, `board:${anchor}:sample-run`));
    const after = await seeder.removeSampleSet(f.deps(), "student");
    assert.equal(after.ok && after.removed.length, 6);
  } finally {
    f.cleanup();
  }
});

// ── Actions: who may call them ───────────────────────────────────────

async function actionFixture(options: { actor: string; demo?: boolean }) {
  const f = await fixture();
  const state = { actor: options.actor, demo: options.demo ?? false, identityReads: 0, events: 0, revalidated: 0 };
  const cache = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    if (cache.has(file)) return cache.get(file)!;
    const exports: Record<string, unknown> = {};
    cache.set(file, exports);
    const boundaries: Record<string, unknown> = {
      "server-only": {},
      "next/cache": { revalidatePath: () => { state.revalidated += 1; } },
      "@/server/db": { db: f.db },
      "@/server/auth": { getCurrentUser: async () => { state.identityReads += 1; return state.actor; } },
      "@/lib/access-mode": { isDemoMode: () => state.demo },
      "@/server/events": { emitTasksChanged: () => { state.events += 1; } },
      "@/server/email": { sendEmail: async (message: unknown) => { emailCalls.push(message); } },
      // The Project service's delete, on the fixture database.
      "@/server/projects/service": { deleteProject: f.deps().deleteProject },
      "@/server/sample-data/seeder": seeder,
    };
    // The real operator gate, reading ADMIN_USER_IDS.
    const injected: Record<string, string> = { "@/server/admin": "src/server/admin.ts" };
    const actual = new Set(["@/lib/sample-data/model", "@/lib/sample-data/copy"]);
    const code = ts.transpileModule(readFileSync(resolve(root, file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, {
      exports,
      process,
      require: (id: string) => {
        if (Object.hasOwn(boundaries, id)) return boundaries[id];
        if (Object.hasOwn(injected, id)) return load(injected[id]!);
        assert.ok(actual.has(id), `Unexpected sample data action import ${id}`);
        return require(resolve(root, "src", id.slice(2)));
      },
    });
    return exports;
  }
  const actions = load("src/server/actions/sample-data.ts") as unknown as typeof import("../actions/sample-data");
  return { ...f, state, actions };
}

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test("a non-operator is refused by every action and nothing is written", async () => {
  for (const actor of ["member", "stranger", "david", ""]) {
    const f = await actionFixture({ actor });
    try {
      // An operator's sample data already exists; the caller must not reach it.
      await seeder.seedSampleSet(f.deps("operator"), "wedding");
      const before = await f.counts();
      assert.equal(await f.actions.getSampleDataStatusAction(), null);
      assert.equal(await f.actions.getSampleDataViewAction(), null);
      for (const setId of SAMPLE_SET_IDS) {
        await assert.rejects(f.actions.seedSampleSetAction(setId), /operator-only/);
        await assert.rejects(f.actions.removeSampleSetAction(setId), /operator-only/);
        await assert.rejects(f.actions.runSeedSampleSetAction(setId), /operator-only/);
        await assert.rejects(f.actions.runRemoveSampleSetAction(setId), /operator-only/);
      }
      await assert.rejects(f.actions.removeAllSampleDataAction(), /operator-only/);
      await assert.rejects(f.actions.runRemoveAllSampleDataAction(), /operator-only/);
      assert.deepEqual(await f.counts(), before);
      assert.deepEqual(f.deleted, []);
      assert.equal(f.state.events + f.state.revalidated, 0);
    } finally {
      f.cleanup();
    }
  }
});

test("review and demo mode write nothing and never resolve the caller, even for an operator", async () => {
  const f = await actionFixture({ actor: "operator", demo: true });
  try {
    const before = await f.counts();
    assert.equal(await f.actions.getSampleDataStatusAction(), null);
    assert.deepEqual(plain(await f.actions.seedSampleSetAction("teacher")), { ok: false, reason: "demo" });
    assert.deepEqual(plain(await f.actions.removeSampleSetAction("teacher")), { ok: false, reason: "demo" });
    assert.deepEqual(plain(await f.actions.removeAllSampleDataAction()), { ok: false, reason: "demo" });
    assert.equal(await f.actions.getSampleDataViewAction(), null);
    for (const run of [() => f.actions.runSeedSampleSetAction("wedding"), () => f.actions.runRemoveSampleSetAction("wedding"), () => f.actions.runRemoveAllSampleDataAction()]) {
      const done = plain(await run());
      assert.equal(done.view, null);
      assert.equal(done.outcome.title, "Not available in review");
    }
    assert.deepEqual(await f.counts(), before);
    assert.equal(f.state.identityReads, 0);
    assert.equal(f.state.events + f.state.revalidated, 0);
  } finally {
    f.cleanup();
  }
});

test("an operator can add, read back and remove through the actions, and an unknown set is refused", async () => {
  const f = await actionFixture({ actor: "operator" });
  try {
    await assert.rejects(f.actions.seedSampleSetAction("everything" as SampleSetId), /Unknown sample set/);
    await assert.rejects(f.actions.removeSampleSetAction("__proto__" as SampleSetId), /Unknown sample set/);
    assert.equal((await f.counts()).workspaces, 0);

    const added = plain(await f.actions.seedSampleSetAction("student"));
    assert.equal(added.ok && added.created.length, 6);
    const status = plain(await f.actions.getSampleDataStatusAction())!;
    assert.deepEqual(status.map((set) => [set.summary.id, set.present.length]), [["teacher", 0], ["student", 6], ["wedding", 0]]);
    assert.ok((await f.db.select().from(workspaces)).every((project) => project.ownerUserId === "operator"));

    // The section itself is driven by the run wrappers and the server-built view.
    const view = plain(await f.actions.getSampleDataViewAction())!;
    assert.deepEqual(view.sets.map((set) => [set.id, set.badge?.text ?? null, set.add === null, set.remove === null]), [["teacher", null, false, true], ["student", "Added", true, false], ["wedding", null, false, true]]);
    assert.equal(view.presentIds.length, 6);
    const ran = plain(await f.actions.runSeedSampleSetAction("wedding"));
    assert.equal(ran.outcome.title, "Sample set added");
    assert.equal(ran.view!.presentIds.length, 10);
    const gone = plain(await f.actions.runRemoveSampleSetAction("wedding"));
    assert.equal(gone.outcome.title, "Sample data removed");
    assert.equal(gone.view!.removeAll.confirm!.names.length, 6);

    const removed = plain(await f.actions.removeAllSampleDataAction());
    assert.ok(Array.isArray(removed) && removed.every((result) => result.ok));
    assert.equal((await f.counts()).workspaces, 0);
    assert.equal(emailCalls.length, 0);
    assert.deepEqual(await f.senderRows(), NOTHING_SENT);
  } finally {
    f.cleanup();
  }
});

test("no sender is reachable from the seeder or the action file", () => {
  // Stubbing proves zero calls; this proves there is no call to make. Neither
  // file imports an email, notification, invite, share, outbox or analytics path.
  for (const file of ["src/server/sample-data/seeder.ts", "src/server/actions/sample-data.ts", "src/server/projects/create-project-core.ts"]) {
    const source = readFileSync(resolve(root, file), "utf8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
    for (const specifier of imports) {
      assert.ok(!/email|resend|notif|invite|share|outbox|nudge|digest|analytics|instrumentation|sponsored-use|comments|conversation|stripe|billing/i.test(specifier), `${file} imports ${specifier}`);
    }
  }
  assert.equal(emailCalls.length, 0);
});

// ── Confirmations ────────────────────────────────────────────────────

test("each confirmation says exactly what will be created or removed", async () => {
  const f = await fixture();
  try {
    const empty = await seeder.listSampleData({ database: f.db, actorUserId: "operator" });
    const teacher = empty.find((set) => set.summary.id === "teacher")!;
    const add = addConfirmation(teacher);
    assert.equal(add.title, "Add the secondary school teacher set?");
    assert.deepEqual(add.names, teacher.summary.projectNames);
    assert.ok(add.lead.includes("5 projects") && add.detail.includes(`${teacher.summary.tasks} tasks`) && add.detail.includes(`${teacher.summary.bigDates} big dates`));
    assert.ok(add.detail.includes("Nobody is invited or emailed"));

    await seeder.seedSampleSet(f.deps(), "teacher");
    const full = await seeder.listSampleData({ database: f.db, actorUserId: "operator" });
    const remove = removeConfirmation(full.find((set) => set.summary.id === "teacher")!);
    assert.deepEqual(remove.names, teacher.summary.projectNames);
    assert.ok(remove.lead.includes("these 5 sample projects") && remove.detail.includes("Nothing else in your account is touched"));
    assert.deepEqual(removeAllConfirmation(full).names, teacher.summary.projectNames);
    for (const copy of [add, remove, removeAllConfirmation(full)]) {
      assert.ok(!/[!\u{2014}]/u.test([copy.title, copy.lead, copy.detail, copy.confirm].join(" ")));
    }
  } finally {
    f.cleanup();
  }
});
