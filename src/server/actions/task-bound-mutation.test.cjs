/* eslint-disable @typescript-eslint/no-require-imports -- Execute actual actions against disposable SQLite. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { eq } = require("drizzle-orm");
const { usageFixture } = require("../sponsored-use/fixture.cjs");

const count = async (f, table) => Number((await f.client.execute(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
const row = async (f, id) => (await f.client.execute({ sql: "SELECT title,lane,workspace_id FROM tasks WHERE id=?", args: [id] })).rows[0];

test("bound mutations use the displayed Project even when the ambient Project differs", async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.client.execute("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('b','owner','member')");
    const actions = f.load("src/server/actions/tasks.ts");
    f.state.ambient = "a";
    const created = await actions.addTaskAction({ id: "bound-b", title: "Before", projectId: "b" }, "b");
    assert.deepEqual(created.map(task => task.id), ["bound-b"]);
    const edited = await actions.updateTaskAction("bound-b", { title: "After" }, "b");
    assert.equal(edited[0].title, "After");
    const completed = await actions.toggleCompleteAction("bound-b", "b");
    assert.equal(completed[0].lane, "done");
    assert.equal((await row(f, "bound-b")).workspace_id, "b");
    assert.equal(await count(f, "activities"), 3);
  } finally { f.close(); }
});

test("bound edit and completion refuse a task in another Project even when both Projects are authorized", async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.client.execute("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('b','owner','member')");
    await f.action({ id: "moved-task", title: "Original", projectId: "b" });
    const actions = f.load("src/server/actions/tasks.ts");
    const refused = f.load("src/server/tasks/mutation-refusal.ts").isTaskMutationRefused;
    const before = await row(f, "moved-task"), activities = await count(f, "activities");
    await assert.rejects(actions.updateTaskAction("moved-task", { title: "Wrong" }, "a"), refused);
    await assert.rejects(actions.toggleCompleteAction("moved-task", "a"), refused);
    await assert.rejects(actions.updateTaskAction("missing", { title: "Wrong" }, "a"), refused);
    assert.deepEqual(await row(f, "moved-task"), before);
    assert.equal(await count(f, "activities"), activities);
    // Legacy callers keep the existing stored-Project behavior.
    await actions.updateTaskAction("moved-task", { title: "Legacy" });
    assert.equal((await row(f, "moved-task")).title, "Legacy");
  } finally { f.close(); }
});

test("invalid explicit scope, create mismatch and bound demo never fall back to ambient data", async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.action({ id: "before-invalid", title: "Original", projectId: "a" });
    const actions = f.load("src/server/actions/tasks.ts");
    const refused = f.load("src/server/tasks/mutation-refusal.ts").isTaskMutationRefused;
    for (const scope of [null, "", [], ["a"], {}, " a", "a/b"]) {
      await assert.rejects(actions.updateTaskAction("before-invalid", { title: "Wrong" }, scope), refused);
      await assert.rejects(actions.toggleCompleteAction("before-invalid", scope), refused);
      await assert.rejects(actions.addTaskAction({ id: "invalid-new", title: "Wrong", projectId: "a" }, scope), refused);
    }
    await assert.rejects(actions.addTaskAction({ id: "wrong-create", title: "Wrong", projectId: "b" }, "a"), refused);
    assert.equal(await count(f, "tasks"), 1);
    assert.equal(await count(f, "activities"), 1);
    f.state.demo = true;
    assert.deepEqual(await actions.toggleCompleteAction("before-invalid"), []);
    await assert.rejects(actions.toggleCompleteAction("before-invalid", "a"), refused);
    await assert.rejects(actions.updateTaskAction("before-invalid", { title: "Wrong" }, "a"), refused);
    await assert.rejects(actions.addTaskAction({ title: "Wrong", projectId: "a" }, "a"), refused);
  } finally { f.close(); }
});

test("revoked membership is a resolved bound refusal with no write or activity", async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.action({ id: "revoked-task", title: "Original", projectId: "a" });
    const actions = f.load("src/server/actions/tasks.ts");
    const refused = f.load("src/server/tasks/mutation-refusal.ts").isTaskMutationRefused;
    f.state.actor = "member";
    await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='a' AND user_id='member'");
    await assert.rejects(actions.updateTaskAction("revoked-task", { title: "Wrong" }, "a"), refused);
    await assert.rejects(actions.toggleCompleteAction("revoked-task", "a"), refused);
    await assert.rejects(actions.addTaskAction({ id: "revoked-new", title: "Wrong", projectId: "a" }, "a"), refused);
    assert.equal((await row(f, "revoked-task")).title, "Original");
    assert.equal(await count(f, "tasks"), 1);
    assert.equal(await count(f, "activities"), 1);
    assert.deepEqual(await actions.updateTaskAction("revoked-task", { title: "Legacy refused" }), []);
  } finally { f.close(); }
});

test("a confirmed zero-row update is refused without activity", async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.action({ id: "zero-row-task", title: "Original", projectId: "a" });
    const schema = f.load("src/server/db/schema.ts");
    const original = f.db.transaction;
    f.db.transaction = function (work, options) {
      return original.call(this, async tx => {
        const update = tx.update.bind(tx);
        tx.update = table => {
          const statement = update(table);
          if (table !== schema.tasks) return statement;
          const set = statement.set.bind(statement);
          statement.set = value => {
            const query = set(value), where = query.where.bind(query);
            query.where = () => where(eq(schema.tasks.id, "nonexistent-zero-row-target"));
            return query;
          };
          return statement;
        };
        return work(tx);
      }, options);
    };
    const actions = f.load("src/server/actions/tasks.ts");
    const refused = f.load("src/server/tasks/mutation-refusal.ts").isTaskMutationRefused;
    await assert.rejects(actions.updateTaskAction("zero-row-task", { title: "Wrong" }, "a"), refused);
    assert.equal((await row(f, "zero-row-task")).title, "Original");
    assert.equal(await count(f, "activities"), 1);
  } finally { f.close(); }
});

test("a post-commit snapshot failure remains unknown and never replays the write", async () => {
  const f = await usageFixture({ seedClaim: false });
  try {
    await f.action({ id: "postcommit-task", title: "Before", projectId: "a" });
    const schema = f.load("src/server/db/schema.ts");
    const transaction = f.db.transaction, select = f.db.select;
    let committed = false, transactions = 0;
    f.db.transaction = async function (work, options) {
      transactions++;
      const result = await transaction.call(this, work, options);
      committed = true;
      return result;
    };
    f.db.select = function (...args) {
      const query = select.apply(this, args), from = query.from.bind(query);
      query.from = table => {
        if (committed && table === schema.tasks) throw new Error("injected final task snapshot failure");
        return from(table);
      };
      return query;
    };
    const actions = f.load("src/server/actions/tasks.ts");
    const refused = f.load("src/server/tasks/mutation-refusal.ts").isTaskMutationRefused;
    await assert.rejects(actions.updateTaskAction("postcommit-task", { title: "Saved" }, "a"), error => {
      assert.equal(refused(error), false);
      return /injected final task snapshot failure/.test(error.message);
    });
    assert.equal((await row(f, "postcommit-task")).title, "Saved");
    assert.equal(await count(f, "activities"), 2);
    assert.equal(transactions, 1);
  } finally { f.close(); }
});
