import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { tasks, users, workspaceMembers, workspaces } from "@/server/db/schema";

/**
 * Cross-repo Notes -> Tasks extract endpoint (Cycle 9.4b second half,
 * 2026-05-12). Notes calls this from its server action when a user
 * presses "Send to Tasks" on a drafted extract. The body is the
 * creator-authored extract wording — never the raw note body.
 *
 * Auth: shared bearer secret + userId in body. First-party service-
 * to-service pattern; the Notes server is the only legitimate caller.
 * If the deploy environment later supports Clerk session forwarding
 * across origins, swap this for Clerk's authenticateRequest() and
 * drop the userId-from-body trust.
 *
 * Idempotency: the (ownerUserId, noteId) tuple is unique per task via
 * tasks.source_note_id. A repeat call with the same noteId returns
 * the existing task; never creates a duplicate. Notes can retry safely.
 *
 * Workspace selection: the user's first membership wins. If the user
 * has none, return 404 — Notes should surface this to the user as
 * "create a workspace in Tasks first."
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExtractPayload = {
  userId: string;
  noteId: string;
  body: string;
};

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "https://tasks.signalstudio.ie"
  ).replace(/\/+$/, "");
}

export async function POST(req: Request) {
  const expected = process.env.NOTES_TO_TASKS_SECRET;
  if (!expected) {
    return bad("Server is not configured for cross-repo extracts", 500);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match || match[1] !== expected) {
    return bad("Unauthorized", 401);
  }

  let payload: Partial<ExtractPayload>;
  try {
    payload = (await req.json()) as Partial<ExtractPayload>;
  } catch {
    return bad("Invalid JSON body");
  }

  const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
  const noteId = typeof payload.noteId === "string" ? payload.noteId.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  if (!userId) return bad("Missing required field: userId");
  if (!noteId) return bad("Missing required field: noteId");
  if (!body) return bad("Missing required field: body");
  if (body.length > 280) return bad("body is longer than 280 characters");

  const sourceNoteId = `${userId}:${noteId}`;

  // Idempotency: existing task for this (userId, noteId)?
  const [existing] = await db
    .select({
      id: tasks.id,
      workspaceId: tasks.workspaceId,
    })
    .from(tasks)
    .where(eq(tasks.sourceNoteId, sourceNoteId))
    .limit(1);

  if (existing) {
    const ws = await loadWorkspaceMeta(existing.workspaceId);
    return NextResponse.json({
      taskId: existing.id,
      workspaceName: ws?.name ?? "Tasks",
      workspaceSlug: ws?.slug ?? "",
      taskUrl: `${siteOrigin()}/app/board?taskId=${encodeURIComponent(existing.id)}`,
      created: false,
    });
  }

  // First workspace membership wins. If the user is brand-new and the
  // Clerk webhook hasn't provisioned a workspace yet, fail with a
  // surfaced reason so Notes can tell the user what to do.
  const [member] = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .limit(1);

  if (!member) {
    // The user might exist in the users table but have no workspaces
    // — handle that as a separate case from "user doesn't exist at
    // all" for nicer error surfacing.
    const [userRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!userRow) {
      return bad("User not found in Tasks — sign in to tasks.signalstudio.ie first", 404);
    }
    return bad("No workspace yet — create one in Tasks before sending extracts", 404);
  }

  const workspaceId = member.workspaceId;
  const ws = await loadWorkspaceMeta(workspaceId);

  // Next position in the default "todo" lane.
  const [maxRow] = await db
    .select({ max: sql<number | null>`MAX(${tasks.position})` })
    .from(tasks)
    .where(and(eq(tasks.lane, "todo"), eq(tasks.workspaceId, workspaceId)));
  const position = (maxRow?.max ?? 0) + 1.0;

  const taskId = `t-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)}`;

  await db.insert(tasks).values({
    id: taskId,
    workspaceId,
    title: body,
    description: "Drafted from a private note in Signal Notes.",
    lane: "todo",
    priority: "p2",
    assignees: [],
    position,
    sourceNoteId,
  });

  return NextResponse.json({
    taskId,
    workspaceName: ws?.name ?? "Tasks",
    workspaceSlug: ws?.slug ?? "",
    taskUrl: `${siteOrigin()}/app/board?taskId=${encodeURIComponent(taskId)}`,
    created: true,
  });
}

async function loadWorkspaceMeta(workspaceId: string | null) {
  if (!workspaceId) return null;
  const [row] = await db
    .select({ name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return row ?? null;
}
