import assert from "node:assert/strict";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";
import {
  PRIVATE_PROJECT_ID,
  RECIPIENT_PROJECT_ID,
  RECIPIENT_TASK_ID,
  seedRecipientJourneyWithClients,
} from "./fixture";

const CREATOR = {
  clerkId: "user_FixtureCreator0001",
  email: "creator+clerk_test@example.test",
  verified: true,
};
const RECIPIENT = {
  clerkId: "user_FixtureRecipient01",
  email: "recipient+clerk_test@example.test",
  verified: true,
};

const TASKS_SCHEMA = `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    clerk_id TEXT UNIQUE,
    email TEXT,
    handle TEXT UNIQUE,
    name TEXT,
    color TEXT NOT NULL,
    initials TEXT NOT NULL
  );
  CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE,
    name TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    context_type TEXT,
    position INTEGER,
    active_domain TEXT
  );
  CREATE TABLE workspace_members (
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
  );
  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    title TEXT NOT NULL,
    lane TEXT NOT NULL,
    priority TEXT NOT NULL,
    assignees TEXT,
    due TEXT,
    position INTEGER,
    completed_at INTEGER
  );
  CREATE TABLE pending_invites (
    token TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    email TEXT NOT NULL,
    invited_by_user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    accepted_at INTEGER,
    accepted_by_user_id TEXT
  );
`;

const SIGNAL_SCHEMA = `
  CREATE TABLE analytics_users (
    clerk_id TEXT PRIMARY KEY,
    linked_workspace_id TEXT,
    scope_kind TEXT,
    planning_period_id TEXT,
    timezone TEXT
  );
`;

async function withFixtureDatabases(
  run: (tasks: Client, signal: Client) => Promise<void>,
): Promise<void> {
  const tasks = createClient({ url: ":memory:" });
  const signal = createClient({ url: ":memory:" });
  await tasks.executeMultiple(TASKS_SCHEMA);
  await signal.executeMultiple(SIGNAL_SCHEMA);

  const previous = {
    TASKS_DATABASE_URL: process.env.TASKS_DATABASE_URL,
    SIGNAL_DATABASE_URL: process.env.SIGNAL_DATABASE_URL,
    SIGNAL_RECIPIENT_CREATOR_EMAIL:
      process.env.SIGNAL_RECIPIENT_CREATOR_EMAIL,
    SIGNAL_RECIPIENT_RECIPIENT_EMAIL:
      process.env.SIGNAL_RECIPIENT_RECIPIENT_EMAIL,
  };
  process.env.SIGNAL_RECIPIENT_CREATOR_EMAIL = CREATOR.email;
  process.env.SIGNAL_RECIPIENT_RECIPIENT_EMAIL = RECIPIENT.email;

  try {
    await run(tasks, signal);
  } finally {
    tasks.close();
    signal.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("absent identities are inserted and kept in separate fixture roles", async () => {
  await withFixtureDatabases(async (tasks, signal) => {
    await seedRecipientJourneyWithClients(CREATOR, RECIPIENT, {
      tasks,
      signal,
    });
    const users = await tasks.execute(
      "SELECT id, clerk_id FROM users ORDER BY clerk_id",
    );
    assert.equal(users.rows.length, 2);
    const ids = Object.fromEntries(
      users.rows.map((row) => [String(row.clerk_id), String(row.id)]),
    );
    assert.notEqual(ids[CREATOR.clerkId], ids[RECIPIENT.clerkId]);

    const projects = await tasks.execute({
      sql: "SELECT id, owner_user_id FROM workspaces WHERE id IN (?, ?) ORDER BY id",
      args: [RECIPIENT_PROJECT_ID, PRIVATE_PROJECT_ID],
    });
    assert.deepEqual(
      projects.rows.map((row) => String(row.owner_user_id)),
      [ids[CREATOR.clerkId], ids[CREATOR.clerkId]],
    );
    const task = await tasks.execute({
      sql: "SELECT assignees FROM tasks WHERE id = ?",
      args: [RECIPIENT_TASK_ID],
    });
    assert.deepEqual(JSON.parse(String(task.rows[0]?.assignees)), [
      ids[RECIPIENT.clerkId],
    ]);
    const privateTask = await tasks.execute({
      sql: "SELECT assignees FROM tasks WHERE workspace_id = ?",
      args: [PRIVATE_PROJECT_ID],
    });
    assert.deepEqual(JSON.parse(String(privateTask.rows[0]?.assignees)), [
      ids[CREATOR.clerkId],
    ]);
    const invite = await tasks.execute({
      sql: "SELECT email, invited_by_user_id FROM pending_invites WHERE workspace_id = ?",
      args: [RECIPIENT_PROJECT_ID],
    });
    assert.equal(invite.rows[0]?.email, RECIPIENT.email);
    assert.equal(invite.rows[0]?.invited_by_user_id, ids[CREATOR.clerkId]);
  });
});

test("pre-provisioned identities are reused and null email is backfilled", async () => {
  await withFixtureDatabases(async (tasks, signal) => {
    await tasks.batch(
      [
        {
          sql: "INSERT INTO users (id, clerk_id, email, handle, color, initials) VALUES (?, ?, ?, 'creator-existing', '#000000', 'CE')",
          args: ["existing-creator", CREATOR.clerkId, CREATOR.email.toUpperCase()],
        },
        {
          sql: "INSERT INTO users (id, clerk_id, email, handle, color, initials) VALUES (?, ?, NULL, 'recipient-existing', '#000000', 'RE')",
          args: ["existing-recipient", RECIPIENT.clerkId],
        },
      ],
      "write",
    );
    await signal.execute({
      sql: "INSERT INTO analytics_users (clerk_id, linked_workspace_id, scope_kind, planning_period_id, timezone) VALUES (?, 'old-project', 'planningPeriod', 'old-period', 'Europe/Dublin')",
      args: [CREATOR.clerkId],
    });

    await seedRecipientJourneyWithClients(CREATOR, RECIPIENT, {
      tasks,
      signal,
    });

    const users = await tasks.execute(
      "SELECT id, clerk_id, email FROM users ORDER BY clerk_id",
    );
    assert.equal(users.rows.length, 2);
    const byClerk = Object.fromEntries(
      users.rows.map((row) => [String(row.clerk_id), row]),
    );
    assert.equal(byClerk[CREATOR.clerkId]?.id, "existing-creator");
    assert.equal(byClerk[RECIPIENT.clerkId]?.id, "existing-recipient");
    assert.equal(byClerk[RECIPIENT.clerkId]?.email, RECIPIENT.email);

    const project = await tasks.execute({
      sql: "SELECT owner_user_id FROM workspaces WHERE id = ?",
      args: [RECIPIENT_PROJECT_ID],
    });
    assert.equal(project.rows[0]?.owner_user_id, "existing-creator");
    const task = await tasks.execute({
      sql: "SELECT assignees FROM tasks WHERE id = ?",
      args: [RECIPIENT_TASK_ID],
    });
    assert.deepEqual(JSON.parse(String(task.rows[0]?.assignees)), [
      "existing-recipient",
    ]);
    const privateTask = await tasks.execute({
      sql: "SELECT assignees FROM tasks WHERE workspace_id = ?",
      args: [PRIVATE_PROJECT_ID],
    });
    assert.deepEqual(JSON.parse(String(privateTask.rows[0]?.assignees)), [
      "existing-creator",
    ]);
    const invite = await tasks.execute({
      sql: "SELECT email, invited_by_user_id FROM pending_invites WHERE workspace_id = ?",
      args: [RECIPIENT_PROJECT_ID],
    });
    assert.equal(invite.rows[0]?.email, RECIPIENT.email);
    assert.equal(invite.rows[0]?.invited_by_user_id, "existing-creator");

    const analytics = await signal.execute({
      sql: "SELECT linked_workspace_id, scope_kind, planning_period_id, timezone FROM analytics_users WHERE clerk_id = ?",
      args: [CREATOR.clerkId],
    });
    assert.deepEqual(
      {
        linkedWorkspaceId: analytics.rows[0]?.linked_workspace_id,
        scopeKind: analytics.rows[0]?.scope_kind,
        planningPeriodId: analytics.rows[0]?.planning_period_id,
        timezone: analytics.rows[0]?.timezone,
      },
      {
        linkedWorkspaceId: RECIPIENT_PROJECT_ID,
        scopeKind: "workspace",
        planningPeriodId: null,
        timezone: "UTC",
      },
    );
  });
});

test("a pre-provisioned Clerk identity with another email fails closed", async () => {
  await withFixtureDatabases(async (tasks, signal) => {
    await tasks.execute({
      sql: "INSERT INTO users (id, clerk_id, email, handle, color, initials) VALUES ('mismatch', ?, 'other@example.test', 'mismatch', '#000000', 'MM')",
      args: [CREATOR.clerkId],
    });
    await assert.rejects(
      seedRecipientJourneyWithClients(CREATOR, RECIPIENT, {
        tasks,
        signal,
      }),
      /does not match the verified account email/,
    );
    const projects = await tasks.execute("SELECT count(*) AS count FROM workspaces");
    assert.equal(Number(projects.rows[0]?.count), 0);
  });
});

test("a pre-provisioned Clerk identity with an empty email fails closed", async () => {
  await withFixtureDatabases(async (tasks, signal) => {
    await tasks.execute({
      sql: "INSERT INTO users (id, clerk_id, email, handle, color, initials) VALUES ('empty-email', ?, '', 'empty-email', '#000000', 'EE')",
      args: [CREATOR.clerkId],
    });
    await assert.rejects(
      seedRecipientJourneyWithClients(CREATOR, RECIPIENT, { tasks, signal }),
      /does not match the verified account email/,
    );
    const projects = await tasks.execute("SELECT count(*) AS count FROM workspaces");
    assert.equal(Number(projects.rows[0]?.count), 0);
  });
});
