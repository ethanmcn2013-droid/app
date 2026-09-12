import { randomBytes } from "node:crypto";
import { createClient, type Client } from "@libsql/client";

export const RECIPIENT_PROJECT_ID = "recipient-proof-b";
export const RECIPIENT_PROJECT_NAME = "Recipient proof B";
export const RECIPIENT_TASK_ID = "recipient-proof-task";
export const RECIPIENT_TASK_TITLE = "Confirm the final guest count";
export const PRIVATE_PROJECT_ID = "recipient-proof-private";
export const PRIVATE_TASK_TITLE = "Creator private planning note";

type Identity = Readonly<{ clerkId: string; email: string; verified: boolean }>;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function userId(clerkId: string): string {
  if (!/^user_[A-Za-z0-9]+$/.test(clerkId)) throw new Error("Clerk returned an invalid user identifier.");
  return `proof-${clerkId.slice(-16)}`;
}

function tasksClient(): Client {
  return createClient({ url: required("TASKS_DATABASE_URL") });
}

function signalClient(): Client {
  return createClient({ url: required("SIGNAL_DATABASE_URL") });
}

async function resolveFixtureUser(
  client: Client,
  identity: Identity,
  expectedEmail: string,
  profile: Readonly<{
    handlePrefix: string;
    name: string;
    color: string;
    initials: string;
  }>,
): Promise<string> {
  const id = userId(identity.clerkId);
  await client.execute({
    sql: "INSERT INTO users (id, clerk_id, email, handle, name, color, initials) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(clerk_id) DO NOTHING",
    args: [
      id,
      identity.clerkId,
      expectedEmail,
      `${profile.handlePrefix}-${id.slice(-8)}`,
      profile.name,
      profile.color,
      profile.initials,
    ],
  });

  let resolved = await client.execute({
    sql: "SELECT id, email FROM users WHERE clerk_id = ?",
    args: [identity.clerkId],
  });
  let row = resolved.rows[0];
  if (!row) throw new Error("Clerk identity was not provisioned in the fixture database.");
  const resolvedId = String(row.id ?? "");
  if (!resolvedId) throw new Error("Provisioned Clerk identity has no internal user id.");

  if (row.email == null) {
    await client.execute({
      sql: "UPDATE users SET email = ? WHERE id = ? AND clerk_id = ? AND email IS NULL",
      args: [expectedEmail, resolvedId, identity.clerkId],
    });
    resolved = await client.execute({
      sql: "SELECT id, email FROM users WHERE clerk_id = ?",
      args: [identity.clerkId],
    });
    row = resolved.rows[0];
  }

  const storedEmail = row?.email == null ? null : String(row.email);
  if (
    String(row?.id ?? "") !== resolvedId ||
    storedEmail === null ||
    storedEmail.toLowerCase() !== expectedEmail.toLowerCase()
  ) {
    throw new Error(
      "Provisioned Clerk identity does not match the verified account email.",
    );
  }
  return resolvedId;
}

export async function seedRecipientJourneyWithClients(
  creator: Identity,
  recipient: Identity,
  clients: Readonly<{ tasks: Client; signal: Client }>,
): Promise<string> {
  const expectedCreator = required("SIGNAL_RECIPIENT_CREATOR_EMAIL").toLowerCase();
  const expectedRecipient = required("SIGNAL_RECIPIENT_RECIPIENT_EMAIL").toLowerCase();
  if (!creator.verified || !recipient.verified) {
    throw new Error("Both controlled Clerk accounts must have verified primary email addresses.");
  }
  if (creator.email.toLowerCase() !== expectedCreator || recipient.email.toLowerCase() !== expectedRecipient) {
    throw new Error("Clerk identities do not match the two confirmed account labels.");
  }

  const token = randomBytes(24).toString("base64url");
  const creatorId = await resolveFixtureUser(
    clients.tasks,
    creator,
    expectedCreator,
    {
      handlePrefix: "creator",
      name: "Proof creator",
      color: "#44536A",
      initials: "PC",
    },
  );
  const recipientId = await resolveFixtureUser(
    clients.tasks,
    recipient,
    expectedRecipient,
    {
      handlePrefix: "recipient",
      name: "Proof recipient",
      color: "#496A5B",
      initials: "PR",
    },
  );
  await clients.tasks.batch([
    { sql: "INSERT INTO workspaces (id, slug, name, owner_user_id, context_type, position, active_domain) VALUES (?, ?, ?, ?, 'project', 1000, 'Wedding')", args: [RECIPIENT_PROJECT_ID, RECIPIENT_PROJECT_ID, RECIPIENT_PROJECT_NAME, creatorId] },
    { sql: "INSERT INTO workspaces (id, slug, name, owner_user_id, context_type, position, active_domain) VALUES (?, ?, 'Creator private project', ?, 'project', 2000, 'Wedding')", args: [PRIVATE_PROJECT_ID, PRIVATE_PROJECT_ID, creatorId] },
    { sql: "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')", args: [RECIPIENT_PROJECT_ID, creatorId] },
    { sql: "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')", args: [PRIVATE_PROJECT_ID, creatorId] },
    { sql: "INSERT INTO tasks (id, workspace_id, seq, title, lane, priority, assignees, due, position) VALUES (?, ?, 1, ?, 'todo', 'p2', ?, 'Today', 1000)", args: [RECIPIENT_TASK_ID, RECIPIENT_PROJECT_ID, RECIPIENT_TASK_TITLE, JSON.stringify([recipientId])] },
    { sql: "INSERT INTO tasks (id, workspace_id, seq, title, lane, priority, assignees, position) VALUES ('recipient-proof-private-task', ?, 1, ?, 'todo', 'p2', ?, 1000)", args: [PRIVATE_PROJECT_ID, PRIVATE_TASK_TITLE, JSON.stringify([creatorId])] },
    { sql: "INSERT INTO pending_invites (token, workspace_id, email, invited_by_user_id, role, expires_at) VALUES (?, ?, ?, ?, 'member', unixepoch() + 604800)", args: [token, RECIPIENT_PROJECT_ID, expectedRecipient, creatorId] },
  ], "write");
  await clients.signal.batch([
    { sql: "INSERT INTO analytics_users (clerk_id, linked_workspace_id, scope_kind, planning_period_id, timezone) VALUES (?, ?, 'workspace', NULL, 'UTC') ON CONFLICT(clerk_id) DO UPDATE SET linked_workspace_id = excluded.linked_workspace_id, scope_kind = excluded.scope_kind, planning_period_id = NULL, timezone = excluded.timezone", args: [creator.clerkId, RECIPIENT_PROJECT_ID] },
    { sql: "INSERT INTO analytics_users (clerk_id, linked_workspace_id, scope_kind, planning_period_id, timezone) VALUES (?, ?, 'workspace', NULL, 'UTC') ON CONFLICT(clerk_id) DO UPDATE SET linked_workspace_id = excluded.linked_workspace_id, scope_kind = excluded.scope_kind, planning_period_id = NULL, timezone = excluded.timezone", args: [recipient.clerkId, RECIPIENT_PROJECT_ID] },
  ], "write");
  return token;
}

export async function seedRecipientJourney(creator: Identity, recipient: Identity): Promise<string> {
  const tasks = tasksClient();
  const signal = signalClient();
  try {
    return await seedRecipientJourneyWithClients(creator, recipient, {
      tasks,
      signal,
    });
  } finally {
    tasks.close();
    signal.close();
  }
}

export async function readRecipientJourneyState() {
  const client = tasksClient();
  try {
    const task = await client.execute({ sql: "SELECT lane, completed_at FROM tasks WHERE id = ?", args: [RECIPIENT_TASK_ID] });
    const invite = await client.execute({ sql: "SELECT accepted_at, accepted_by_user_id FROM pending_invites WHERE workspace_id = ?", args: [RECIPIENT_PROJECT_ID] });
    return {
      task: task.rows[0] ?? null,
      invite: invite.rows[0] ?? null,
    };
  } finally {
    client.close();
  }
}

export async function removeRecipientMembership(clerkId: string): Promise<void> {
  const client = tasksClient();
  try {
    await client.execute({
      sql: "DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = (SELECT id FROM users WHERE clerk_id = ?)",
      args: [RECIPIENT_PROJECT_ID, clerkId],
    });
  } finally {
    client.close();
  }
}
