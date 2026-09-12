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

export async function seedRecipientJourney(creator: Identity, recipient: Identity): Promise<string> {
  const expectedCreator = required("SIGNAL_RECIPIENT_CREATOR_EMAIL").toLowerCase();
  const expectedRecipient = required("SIGNAL_RECIPIENT_RECIPIENT_EMAIL").toLowerCase();
  if (!creator.verified || !recipient.verified) {
    throw new Error("Both controlled Clerk accounts must have verified primary email addresses.");
  }
  if (creator.email.toLowerCase() !== expectedCreator || recipient.email.toLowerCase() !== expectedRecipient) {
    throw new Error("Clerk identities do not match the two confirmed account labels.");
  }

  const creatorId = userId(creator.clerkId);
  const recipientId = userId(recipient.clerkId);
  const token = randomBytes(24).toString("base64url");
  const tasks = tasksClient();
  const signal = signalClient();
  try {
    await tasks.batch([
      { sql: "INSERT INTO users (id, clerk_id, email, handle, name, color, initials) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [creatorId, creator.clerkId, expectedCreator, `creator-${creatorId.slice(-8)}`, "Proof creator", "#44536A", "PC"] },
      { sql: "INSERT INTO users (id, clerk_id, email, handle, name, color, initials) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [recipientId, recipient.clerkId, expectedRecipient, `recipient-${recipientId.slice(-8)}`, "Proof recipient", "#496A5B", "PR"] },
      { sql: "INSERT INTO workspaces (id, slug, name, owner_user_id, context_type, position, active_domain) VALUES (?, ?, ?, ?, 'project', 1000, 'Wedding')", args: [RECIPIENT_PROJECT_ID, RECIPIENT_PROJECT_ID, RECIPIENT_PROJECT_NAME, creatorId] },
      { sql: "INSERT INTO workspaces (id, slug, name, owner_user_id, context_type, position, active_domain) VALUES (?, ?, 'Creator private project', ?, 'project', 2000, 'Wedding')", args: [PRIVATE_PROJECT_ID, PRIVATE_PROJECT_ID, creatorId] },
      { sql: "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')", args: [RECIPIENT_PROJECT_ID, creatorId] },
      { sql: "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')", args: [PRIVATE_PROJECT_ID, creatorId] },
      { sql: "INSERT INTO tasks (id, workspace_id, seq, title, lane, priority, assignees, due, position) VALUES (?, ?, 1, ?, 'todo', 'p2', ?, 'Today', 1000)", args: [RECIPIENT_TASK_ID, RECIPIENT_PROJECT_ID, RECIPIENT_TASK_TITLE, JSON.stringify([recipientId])] },
      { sql: "INSERT INTO tasks (id, workspace_id, seq, title, lane, priority, assignees, position) VALUES ('recipient-proof-private-task', ?, 1, ?, 'todo', 'p2', ?, 1000)", args: [PRIVATE_PROJECT_ID, PRIVATE_TASK_TITLE, JSON.stringify([creatorId])] },
      { sql: "INSERT INTO pending_invites (token, workspace_id, email, invited_by_user_id, role, expires_at) VALUES (?, ?, ?, ?, 'member', unixepoch() + 604800)", args: [token, RECIPIENT_PROJECT_ID, expectedRecipient, creatorId] },
    ], "write");
    await signal.batch([
      { sql: "INSERT INTO analytics_users (clerk_id, linked_workspace_id, scope_kind, timezone) VALUES (?, ?, 'workspace', 'UTC')", args: [creator.clerkId, RECIPIENT_PROJECT_ID] },
      { sql: "INSERT INTO analytics_users (clerk_id, linked_workspace_id, scope_kind, timezone) VALUES (?, ?, 'workspace', 'UTC')", args: [recipient.clerkId, RECIPIENT_PROJECT_ID] },
    ], "write");
  } finally {
    tasks.close();
    signal.close();
  }
  return token;
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
